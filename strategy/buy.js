import { STRATEGY_OPERATORS, STRATEGY_TYPES } from "../constants/index.js";
import chalk from "chalk";
import { readFileSync, promises, existsSync, writeFileSync } from "fs";
import { getDir } from "../utils/getDir.js";

/**
 * 购买策略
 * 涉及价格，金额的单位统一为 ETH
 */
export const BuyStrategy = {
  operator: STRATEGY_OPERATORS.OR,
  conditions: [
    {
      operator: STRATEGY_OPERATORS.AND,
      conditions: [
        // 价格
        { type: STRATEGY_TYPES.KEY_PRICE, value:  0.000071875 },
        // 推特关注数
        //{ type: STRATEGY_TYPES.TWITTER_FOLLOWERS, value: 500 },
        // 推特文章数
        //{ type: STRATEGY_TYPES.TWITTER_POSTS, value: 20 },
        // 推特平均阅读量(如果关注数设置得比较小，阅读量和 like 量建议设置为 0，因为这类蓝V可能获取不到阅读数)
        //{ type: STRATEGY_TYPES.TWITTER_VIEWS, value: 0 },
        // 推特推特平均 Like 量
        //{ type: STRATEGY_TYPES.TWITTER_FAVS, value: 0 },
      ],
    },
    {
      operator: STRATEGY_OPERATORS.AND,
      conditions: [
        // 价格
        { type: STRATEGY_TYPES.KEY_PRICE, value: 0.00008 },
        // 推特关注数
        //{ type: STRATEGY_TYPES.TWITTER_FOLLOWERS, value: 1000 },
        // 推特文章数
        //{ type: STRATEGY_TYPES.TWITTER_POSTS, value: 100 },
        // 推特平均阅读量
        //{ type: STRATEGY_TYPES.TWITTER_VIEWS, value: 500 },
        // 推特推特平均 Like 量
        //{ type: STRATEGY_TYPES.TWITTER_FAVS, value: 30 },
      ],
    },
    {
      // 白名单
      type: STRATEGY_TYPES.WHITELIST,
      whitelist: [
        
      ],
    },
  ],
  //onlyBuyBlueVerified: true,
  // 如果一个 key 是由 bots 列表内的地址出售的，不考虑买入
  //skipSoldByBot: true,
  // 禁止多次买入同一个 share
  disabledMultiBuy: true,
};
/** 不自动购买的地址, 可以把一些假号或者买过了知道会亏的放这里面 */
const notBuyList = [];

export const BOT_JUDGED_NONCE = 300;

export const couldBeBought = ({ subject, trader, isBuy }, bots) => {
  const blockList = notBuyList.concat(bots);
/*  const isInBlockList = blockList.some((address) => {
    const isBlock = address.toLowerCase() === subject.toLowerCase();
    const isSoldByBot =
      BuyStrategy.skipSoldByBot &&
      !isBuy &&
      trader &&
      trader.toLowerCase() === address.toLowerCase();
    if (isBlock) {
      console.log(chalk.yellow(`${subject} in block list, skip...`));
    }
    if (isSoldByBot) {
      console.log(chalk.yellow(`bot ${subject} sold, skip...`));
    }
    return isBlock || isSoldByBot;
  });
*/
  let holdings = [];
  if (existsSync(getDir("holdings.json"))) {
    const rawData = readFileSync(getDir("holdings.json"), "utf-8");
    holdings = JSON.parse(rawData);
  }
  const alreadyBuy =
    BuyStrategy.disabledMultiBuy && holdings.find((f) => f.share === subject);

  console.log("isAlreadyBuy", alreadyBuy ? true : false);
  return !isInBlockList && !alreadyBuy;
};

const evaluateCondition = (condition, shareInfo) => {
  switch (condition.type) {
    //case STRATEGY_TYPES.TWITTER_VIEWS:
      //return twitterInfo.viewAvg >= condition.value;
    //case STRATEGY_TYPES.TWITTER_FAVS:
      //return twitterInfo.favoriteAvg >= condition.value;
    //case STRATEGY_TYPES.TWITTER_FOLLOWERS:
      //return twitterInfo.followers >= condition.value;
    //case STRATEGY_TYPES.TWITTER_POSTS:
      //return twitterInfo.posts >= condition.value;
    case STRATEGY_TYPES.KEY_PRICE:
      return shareInfo.price < condition.value;
    case STRATEGY_TYPES.WHITELIST:
      const user = condition.whitelist.find(
        (u) => u.username === shareInfo.username
      );
      return user && shareInfo.price <= user.maxPrice;
    default:
      throw new Error("Unknown condition type");
  }
};

const evaluateStrategy = (strategy, shareInfo) => {
  if (strategy.operator) {
    if (strategy.operator === STRATEGY_OPERATORS.AND) {
      return strategy.conditions.every((condition) =>
        evaluateStrategy(condition, shareInfo)
      );
    } else if (strategy.operator === STRATEGY_OPERATORS.OR) {
      return strategy.conditions.some((condition) =>
        evaluateStrategy(condition, shareInfo)
      );
    } else {
      throw new Error("Unknown operator");
    }
  } else {
    return evaluateCondition(strategy, shareInfo);
  }
};

const extractPricesFromStrategy = (strategy) => {
  let prices = [];

  if (strategy.conditions) {
    for (let condition of strategy.conditions) {
      if (condition.type === STRATEGY_TYPES.KEY_PRICE) {
        prices.push(condition.value);
      } else if (condition.type === STRATEGY_TYPES.WHITELIST) {
        for (let user of condition.whitelist) {
          prices.push(user.maxPrice);
        }
      } else if (condition.operator) {
        // AND or OR conditions
        prices = prices.concat(extractPricesFromStrategy(condition));
      }
    }
  }

  return prices;
};

export const isWhitelisted = (shareInfo) => {
  const whitelistedUser = BuyStrategy.conditions.find(
    (condition) => condition.type === STRATEGY_TYPES.WHITELIST
  );
  if (!whitelistedUser) return false;

  const user = whitelistedUser.whitelist.find(
    (u) => u.username === shareInfo.username
  );

  return user;
};

export const shouldFetchPrice = (shareInfo) => {
  return evaluateStrategy(BuyStrategy, shareInfo);
};

export const shouldBuy = (shareInfo) => {
  return evaluateStrategy(BuyStrategy, shareInfo);
};

export const getMaxPrice = () => {
  const prices = extractPricesFromStrategy(BuyStrategy);
  return Math.max(...prices);
};

/*const containsTwitterConditions = (strategy) => {
  if (strategy.conditions) {
    for (let condition of strategy.conditions) {
      if (
        condition.type === STRATEGY_TYPES.TWITTER_FOLLOWERS ||
        condition.type === STRATEGY_TYPES.TWITTER_POSTS
      ) {
        return true;
      }
      if (condition.operator && containsTwitterConditions(condition)) {
        // 如果是 AND 或 OR 条件
        return true;
      }
    }
  }
  return false;
};*/
/*const containsTwitterViewConditions = (strategy) => {
  if (strategy.conditions) {
    for (let condition of strategy.conditions) {
      if (
        condition.type === STRATEGY_TYPES.TWITTER_VIEWS ||
        condition.type === STRATEGY_TYPES.TWITTER_FAVS
      ) {
        return true;
      }
      if (condition.operator && containsTwitterConditions(condition)) {
        // 如果是 AND 或 OR 条件
        return true;
      }
    }
  }
  return false;
};*/

/*export const shouldFetchTwitterInfo = (accountInfo, shareInfo) => {
  return containsTwitterConditions(BuyStrategy);
};

export const shouldFetchTwitterViewInfo = () => {
  return containsTwitterViewConditions(BuyStrategy);
};*/
