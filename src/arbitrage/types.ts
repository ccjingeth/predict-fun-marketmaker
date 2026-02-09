/**
 * Arbitrage Strategy Types
 * 套利策略相关类型定义
 */

/**
 * 套利机会类型
 */
export const ArbitrageType = {
  VALUE_MISMATCH: 'VALUE_MISMATCH',
  IN_PLATFORM: 'IN_PLATFORM',
  CROSS_PLATFORM: 'CROSS_PLATFORM',
  DEPENDENCY: 'DEPENDENCY',
  MULTI_OUTCOME: 'MULTI_OUTCOME',
} as const;

export type ArbitrageType = typeof ArbitrageType[keyof typeof ArbitrageType];

/**
 * 套利机会
 */
export interface ArbitrageOpportunity {
  type: ArbitrageType;
  marketId: string;
  marketQuestion: string;
  timestamp: number;
  confidence: number; // 0-1, 机会可信度

  // 价值错配相关
  estimatedValue?: number;
  marketPrice?: number;
  fairValue?: number;
  edge?: number; // 价格优势百分比

  // 站内套利相关
  yesPrice?: number;
  noPrice?: number;
  yesPlusNo?: number; // Yes + No 总和
  arbitrageProfit?: number; // 套利利润（百分比）
  yesTokenId?: string;
  noTokenId?: string;
  yesBid?: number;
  yesAsk?: number;
  noBid?: number;
  noAsk?: number;

  // 跨平台套利相关
  platformA?: string;
  platformB?: string;
  priceA?: number;
  priceB?: number;
  spread?: number; // 价差

  // 执行建议
  recommendedAction?: 'BUY_YES' | 'BUY_NO' | 'SELL_YES' | 'SELL_NO' | 'BUY_BOTH' | 'SELL_BOTH' | 'HOLD';
  positionSize?: number;
  expectedReturn?: number;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  guaranteedProfit?: number;
  totalCost?: number;
  legs?: {
    platform?: string;
    tokenId: string;
    side: 'BUY' | 'SELL';
    price: number;
    shares: number;
    outcome?: 'YES' | 'NO';
  }[];
}

/**
 * 价值错配分析结果
 */
export interface ValueMismatchAnalysis {
  marketId: string;
  question: string;
  category: string;
  endDate: string;
  // 该 token 的方向（YES/NO）
  tokenOutcome?: 'YES' | 'NO' | 'UNKNOWN';

  // 市场价格
  currentYesPrice: number;
  currentNoPrice: number;
  // 当前 token 价格（YES/NO token）
  currentTokenPrice?: number;

  // 真实概率估算（基于分析/数据）
  estimatedProbability: number;
  // 公允的 token 价格（YES/NO token）
  fairTokenPrice?: number;
  confidence: number;

  // 价值判断
  assessment: 'OVERVALUED' | 'UNDERVALUED' | 'FAIR';
  edge: number; // 价格优势百分比

  // 推荐行动
  action: 'BUY_YES' | 'BUY_NO' | 'SELL_YES' | 'SELL_NO' | 'PASS';
  reasoning: string;
}

/**
 * 站内套利机会
 */
export interface InPlatformArbitrage {
  marketId: string;
  yesTokenId: string;
  noTokenId: string;
  question: string;

  // Yes 和 No 价格
  yesPrice: number;
  noPrice: number;
  yesBid: number;
  yesAsk: number;
  noBid: number;
  noAsk: number;
  yesPlusNo: number; // Yes + No

  // 套利机会
  arbitrageExists: boolean;
  arbitrageType: 'OVER_ONE' | 'UNDER_ONE'; // >1 或 <1

  // 计算利润
  profitPercentage: number;
  maxProfit: number; // 考虑手续费后的最大利润
  depthShares: number;

  // 执行策略
  action: 'SELL_BOTH' | 'BUY_BOTH' | 'NONE';
  recommendedSize: number;
  breakEvenFee: number; // 盈亏平衡的手续费率
}

/**
 * 多结果套利机会
 */
export interface MultiOutcomeArbitrage {
  marketId: string;
  question: string;
  outcomes: {
    tokenId: string;
    price: number;
    askSize: number;
    feeBps: number;
  }[];
  totalCost: number;
  totalFees: number;
  totalSlippage: number;
  guaranteedProfit: number;
  recommendedSize: number;
}

/**
 * 跨平台套利机会
 */
export interface CrossPlatformArbitrage {
  event: string;
  outcome: string; // 事件结果
  action: 'BUY_BOTH' | 'SELL_BOTH';

  platformA: {
    name: string;
    yesPrice: number;
    market: string;
    yesTokenId?: string;
    noTokenId?: string;
    yesBid?: number;
    yesAsk?: number;
    noBid?: number;
    noAsk?: number;
  };

  platformB: {
    name: string;
    yesPrice: number;
    market: string;
    yesTokenId?: string;
    noTokenId?: string;
    yesBid?: number;
    yesAsk?: number;
    noBid?: number;
    noAsk?: number;
  };

  // 价差
  priceDifference: number;
  spreadPercentage: number;

  // 套利计算
  arbitrageExists: boolean;
  minCost: number; // 两边买入的最小成本
  guaranteedPayout: number; // 保底收益
  profitPercentage: number;
  recommendedSize?: number;
  legs?: {
    platform: string;
    tokenId: string;
    side: 'BUY' | 'SELL';
    price: number;
    shares: number;
    outcome?: 'YES' | 'NO';
  }[];

  // 风险评估
  risks: string[];
  eventDescriptionMatch: boolean; // 事件描述是否一致
}

/**
 * 套利执行结果
 */
export interface ArbitrageExecution {
  opportunityId: string;
  type: ArbitrageType;
  timestamp: number;

  // 执行状态
  status: 'PENDING' | 'EXECUTED' | 'FAILED' | 'PROFIT_TAKEN';

  // 交易详情
  trades: {
    market: string;
    side: 'BUY' | 'SELL';
    price: number;
    amount: number;
    cost: number;
  }[];

  // 结果
  totalCost: number;
  expectedProfit: number;
  actualProfit?: number;
  fees: number;

  // 风险管理
  hedgeTrades?: any[]; // 对冲交易
  exitCondition?: string;
}
