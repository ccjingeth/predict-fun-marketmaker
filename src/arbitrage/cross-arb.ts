/**
 * Cross-Platform Arbitrage Detector
 * 跨平台套利检测器 - 检测不同平台间的价差套利机会
 */

import type { ArbitrageOpportunity, CrossPlatformArbitrage } from './types.js';
import type { DepthLevel, PlatformMarket } from '../external/types.js';
import type { CrossPlatformMappingStore } from '../external/mapping.js';
import { calcFeeCost } from './fee-utils.js';
import { estimateBuy, estimateSell } from './orderbook-vwap.js';
import type { OrderbookEntry } from '../types.js';

export class CrossPlatformArbitrageDetector {
  private platforms: string[];
  private minProfitThreshold: number;
  private estimatedTransferCost: number;
  private minSimilarity: number;
  private allowSellBoth: boolean;
  private maxShares: number;
  private slippageBps: number;
  private depthLevels: number;
  private depthUsage: number;
  private minNotionalUsd: number;
  private minProfitUsd: number;

  constructor(
    platforms: string[] = ['Predict', 'Polymarket', 'Opinion'],
    minProfitThreshold: number = 0.02,
    estimatedTransferCost: number = 0.005,
    minSimilarity: number = 0.78,
    allowSellBoth: boolean = false,
    maxShares: number = 200,
    slippageBps: number = 250,
    depthLevels: number = 0,
    depthUsage: number = 0.5,
    minNotionalUsd: number = 0,
    minProfitUsd: number = 0
  ) {
    this.platforms = platforms;
    this.minProfitThreshold = minProfitThreshold;
    this.estimatedTransferCost = estimatedTransferCost;
    this.minSimilarity = minSimilarity;
    this.allowSellBoth = allowSellBoth;
    this.maxShares = maxShares;
    this.slippageBps = slippageBps;
    this.depthLevels = depthLevels;
    this.depthUsage = Math.max(0.05, Math.min(1, depthUsage));
    this.minNotionalUsd = Math.max(0, minNotionalUsd);
    this.minProfitUsd = Math.max(0, minProfitUsd);
  }

  private toEntries(levels?: DepthLevel[]): OrderbookEntry[] {
    if (!levels || levels.length === 0) {
      return [];
    }
    const sliced = this.depthLevels > 0 ? levels.slice(0, this.depthLevels) : levels;
    return sliced.map((level) => ({
      price: String(level.price),
      shares: String(level.shares),
    }));
  }

  private sumLevels(levels?: DepthLevel[]): number {
    if (!levels || levels.length === 0) {
      return 0;
    }
    return levels.reduce((sum, level) => sum + (Number.isFinite(level.shares) ? level.shares : 0), 0);
  }

  private refineBuyCandidate(
    yesLevels: OrderbookEntry[],
    noLevels: OrderbookEntry[],
    feeYes: number,
    feeNo: number,
    feeCurveYes: number | undefined,
    feeCurveNo: number | undefined,
    feeExpYes: number | undefined,
    feeExpNo: number | undefined,
    startSize: number
  ): {
    size: number;
    edge: number;
    costPerShare: number;
    yes: NonNullable<ReturnType<typeof estimateBuy>>;
    no: NonNullable<ReturnType<typeof estimateBuy>>;
  } | null {
    if (startSize <= 0) {
      return null;
    }
    let size = startSize;
    let best: {
      size: number;
      edge: number;
      costPerShare: number;
      yes: NonNullable<ReturnType<typeof estimateBuy>>;
      no: NonNullable<ReturnType<typeof estimateBuy>>;
    } | null = null;
    for (let i = 0; i < 4 && size >= 1; i += 1) {
      const yes = estimateBuy(yesLevels, size, feeYes, feeCurveYes, feeExpYes, this.slippageBps);
      const no = estimateBuy(noLevels, size, feeNo, feeCurveNo, feeExpNo, this.slippageBps);
      if (yes && no) {
        const costPerShare = (yes.totalAllIn + no.totalAllIn) / size;
        const edge = 1 - costPerShare - this.estimatedTransferCost;
        if (!best || edge > best.edge) {
          best = { size, edge, costPerShare, yes, no };
        }
        if (edge >= this.minProfitThreshold) {
          return { size, edge, costPerShare, yes, no };
        }
      }
      size = Math.max(1, Math.floor(size * 0.6));
    }
    return best && best.edge >= this.minProfitThreshold ? best : null;
  }

  private refineSellCandidate(
    yesLevels: OrderbookEntry[],
    noLevels: OrderbookEntry[],
    feeYes: number,
    feeNo: number,
    feeCurveYes: number | undefined,
    feeCurveNo: number | undefined,
    feeExpYes: number | undefined,
    feeExpNo: number | undefined,
    startSize: number
  ): {
    size: number;
    edge: number;
    proceedsPerShare: number;
    yes: NonNullable<ReturnType<typeof estimateSell>>;
    no: NonNullable<ReturnType<typeof estimateSell>>;
  } | null {
    if (startSize <= 0) {
      return null;
    }
    let size = startSize;
    let best: {
      size: number;
      edge: number;
      proceedsPerShare: number;
      yes: NonNullable<ReturnType<typeof estimateSell>>;
      no: NonNullable<ReturnType<typeof estimateSell>>;
    } | null = null;
    for (let i = 0; i < 4 && size >= 1; i += 1) {
      const yes = estimateSell(yesLevels, size, feeYes, feeCurveYes, feeExpYes, this.slippageBps);
      const no = estimateSell(noLevels, size, feeNo, feeCurveNo, feeExpNo, this.slippageBps);
      if (yes && no) {
        const proceedsPerShare = (yes.totalAllIn + no.totalAllIn) / size;
        const edge = proceedsPerShare - 1 - this.estimatedTransferCost;
        if (!best || edge > best.edge) {
          best = { size, edge, proceedsPerShare, yes, no };
        }
        if (edge >= this.minProfitThreshold) {
          return { size, edge, proceedsPerShare, yes, no };
        }
      }
      size = Math.max(1, Math.floor(size * 0.6));
    }
    return best && best.edge >= this.minProfitThreshold ? best : null;
  }

  /**
   * 检测跨平台套利机会
   */
  detectArbitrage(marketA: PlatformMarket, marketB: PlatformMarket): CrossPlatformArbitrage | null {
    const similarity = this.calculateSimilarity(marketA.question, marketB.question);

    if (similarity < this.minSimilarity) {
      return null;
    }

    const yesAskA = marketA.yesAsk;
    const yesAskB = marketB.yesAsk;
    const noAskA = marketA.noAsk;
    const noAskB = marketB.noAsk;
    const yesBidA = marketA.yesBid;
    const yesBidB = marketB.yesBid;
    const noBidA = marketA.noBid;
    const noBidB = marketB.noBid;

    if (!yesAskA || !yesAskB || !noAskA || !noAskB || !yesBidA || !yesBidB || !noBidA || !noBidB) {
      return null;
    }

    const feeA = marketA.feeBps || 0;
    const feeB = marketB.feeBps || 0;
    const feeCurveA = marketA.feeCurveRate;
    const feeCurveB = marketB.feeCurveRate;
    const feeExpA = marketA.feeCurveExponent;
    const feeExpB = marketB.feeCurveExponent;

    const depthYesA = this.sumLevels(marketA.yesAsks) || marketA.yesAskSize || 0;
    const depthNoA = this.sumLevels(marketA.noAsks) || marketA.noAskSize || 0;
    const depthYesB = this.sumLevels(marketB.yesAsks) || marketB.yesAskSize || 0;
    const depthNoB = this.sumLevels(marketB.noAsks) || marketB.noAskSize || 0;

    const buyDepthAB = Math.min(depthYesA, depthNoB) * this.depthUsage;
    const buyDepthBA = Math.min(depthYesB, depthNoA) * this.depthUsage;
    const buySizeAB = buyDepthAB > 0 ? Math.max(1, Math.floor(Math.min(buyDepthAB, this.maxShares))) : 0;
    const buySizeBA = buyDepthBA > 0 ? Math.max(1, Math.floor(Math.min(buyDepthBA, this.maxShares))) : 0;

    const yesAskLevelsA = this.toEntries(marketA.yesAsks);
    const noAskLevelsA = this.toEntries(marketA.noAsks);
    const yesAskLevelsB = this.toEntries(marketB.yesAsks);
    const noAskLevelsB = this.toEntries(marketB.noAsks);

    const requireDepth = this.depthLevels > 0;
    const canUseAB = !requireDepth || (yesAskLevelsA.length > 0 && noAskLevelsB.length > 0);
    const canUseBA = !requireDepth || (yesAskLevelsB.length > 0 && noAskLevelsA.length > 0);

    const buyYesA = canUseAB && yesAskLevelsA.length
      ? estimateBuy(yesAskLevelsA, buySizeAB, feeA, feeCurveA, feeExpA, this.slippageBps)
      : null;
    const buyNoB = canUseAB && noAskLevelsB.length
      ? estimateBuy(noAskLevelsB, buySizeAB, feeB, feeCurveB, feeExpB, this.slippageBps)
      : null;

    const buyYesB = canUseBA && yesAskLevelsB.length
      ? estimateBuy(yesAskLevelsB, buySizeBA, feeB, feeCurveB, feeExpB, this.slippageBps)
      : null;
    const buyNoA = canUseBA && noAskLevelsA.length
      ? estimateBuy(noAskLevelsA, buySizeBA, feeA, feeCurveA, feeExpA, this.slippageBps)
      : null;

    const buyCandidateAB = canUseAB && yesAskLevelsA.length && noAskLevelsB.length
      ? this.refineBuyCandidate(
          yesAskLevelsA,
          noAskLevelsB,
          feeA,
          feeB,
          feeCurveA,
          feeCurveB,
          feeExpA,
          feeExpB,
          buySizeAB
        )
      : null;
    const buyCandidateBA = canUseBA && yesAskLevelsB.length && noAskLevelsA.length
      ? this.refineBuyCandidate(
          yesAskLevelsB,
          noAskLevelsA,
          feeB,
          feeA,
          feeCurveB,
          feeCurveA,
          feeExpB,
          feeExpA,
          buySizeBA
        )
      : null;

    let buyNetAB = -Infinity;
    let buyNetBA = -Infinity;
    let buyCostAB = 0;
    let buyCostBA = 0;
    const resolvedBuySizeAB = buyCandidateAB?.size ?? buySizeAB;
    const resolvedBuySizeBA = buyCandidateBA?.size ?? buySizeBA;

    if (buySizeAB > 0 && canUseAB) {
      if (buyCandidateAB) {
        buyCostAB = buyCandidateAB.costPerShare;
        buyNetAB = buyCandidateAB.edge;
      } else {
        buyCostAB = buyYesA && buyNoB
          ? (buyYesA.totalAllIn + buyNoB.totalAllIn) / buySizeAB
          : yesAskA + noAskB;
        const buyFeeAB = buyYesA && buyNoB
          ? 0
          : calcFeeCost(yesAskA, feeA, feeCurveA, feeExpA) +
            calcFeeCost(noAskB, feeB, feeCurveB, feeExpB);
        buyNetAB = 1 - buyCostAB - buyFeeAB - this.estimatedTransferCost;
      }
    }

    if (buySizeBA > 0 && canUseBA) {
      if (buyCandidateBA) {
        buyCostBA = buyCandidateBA.costPerShare;
        buyNetBA = buyCandidateBA.edge;
      } else {
        buyCostBA = buyYesB && buyNoA
          ? (buyYesB.totalAllIn + buyNoA.totalAllIn) / buySizeBA
          : yesAskB + noAskA;
        const buyFeeBA = buyYesB && buyNoA
          ? 0
          : calcFeeCost(yesAskB, feeB, feeCurveB, feeExpB) +
            calcFeeCost(noAskA, feeA, feeCurveA, feeExpA);
        buyNetBA = 1 - buyCostBA - buyFeeBA - this.estimatedTransferCost;
      }
    }

    let action: 'BUY_BOTH' | 'SELL_BOTH' = 'BUY_BOTH';
    let minCost = 0;
    let profitPct = 0;
    let legs: CrossPlatformArbitrage['legs'] = [];
    let depthShares = 0;
    let notionalUsd = 0;
    let profitUsd = 0;

    if (buyNetAB >= buyNetBA && buyNetAB >= this.minProfitThreshold) {
      minCost = buyCostAB;
      profitPct = buyNetAB * 100;
      action = 'BUY_BOTH';
      depthShares = resolvedBuySizeAB;
      notionalUsd = minCost * depthShares;
      profitUsd = Math.max(0, (profitPct / 100) * depthShares);
      legs = [
        {
          platform: marketA.platform,
          tokenId: marketA.yesTokenId || '',
          side: 'BUY',
          price: buyCandidateAB?.yes.avgPrice ?? buyYesA?.avgPrice ?? yesAskA,
          shares: depthShares,
          outcome: 'YES',
        },
        {
          platform: marketB.platform,
          tokenId: marketB.noTokenId || '',
          side: 'BUY',
          price: buyCandidateAB?.no.avgPrice ?? buyNoB?.avgPrice ?? noAskB,
          shares: depthShares,
          outcome: 'NO',
        },
      ];
    } else if (buyNetBA > buyNetAB && buyNetBA >= this.minProfitThreshold) {
      minCost = buyCostBA;
      profitPct = buyNetBA * 100;
      action = 'BUY_BOTH';
      depthShares = resolvedBuySizeBA;
      notionalUsd = minCost * depthShares;
      profitUsd = Math.max(0, (profitPct / 100) * depthShares);
      legs = [
        {
          platform: marketB.platform,
          tokenId: marketB.yesTokenId || '',
          side: 'BUY',
          price: buyCandidateBA?.yes.avgPrice ?? buyYesB?.avgPrice ?? yesAskB,
          shares: depthShares,
          outcome: 'YES',
        },
        {
          platform: marketA.platform,
          tokenId: marketA.noTokenId || '',
          side: 'BUY',
          price: buyCandidateBA?.no.avgPrice ?? buyNoA?.avgPrice ?? noAskA,
          shares: depthShares,
          outcome: 'NO',
        },
      ];
    } else if (this.allowSellBoth) {
      const depthYesBidA = this.sumLevels(marketA.yesBids) || marketA.yesBidSize || 0;
      const depthNoBidA = this.sumLevels(marketA.noBids) || marketA.noBidSize || 0;
      const depthYesBidB = this.sumLevels(marketB.yesBids) || marketB.yesBidSize || 0;
      const depthNoBidB = this.sumLevels(marketB.noBids) || marketB.noBidSize || 0;

      const sellDepthAB = Math.min(depthYesBidA, depthNoBidB) * this.depthUsage;
      const sellDepthBA = Math.min(depthYesBidB, depthNoBidA) * this.depthUsage;
      const sellSizeAB = sellDepthAB > 0 ? Math.max(1, Math.floor(Math.min(sellDepthAB, this.maxShares))) : 0;
      const sellSizeBA = sellDepthBA > 0 ? Math.max(1, Math.floor(Math.min(sellDepthBA, this.maxShares))) : 0;

      const yesBidLevelsA = this.toEntries(marketA.yesBids);
      const noBidLevelsA = this.toEntries(marketA.noBids);
      const yesBidLevelsB = this.toEntries(marketB.yesBids);
      const noBidLevelsB = this.toEntries(marketB.noBids);

      const canSellAB = !requireDepth || (yesBidLevelsA.length > 0 && noBidLevelsB.length > 0);
      const canSellBA = !requireDepth || (yesBidLevelsB.length > 0 && noBidLevelsA.length > 0);

      const sellYesA = canSellAB && yesBidLevelsA.length
        ? estimateSell(yesBidLevelsA, sellSizeAB, feeA, feeCurveA, feeExpA, this.slippageBps)
        : null;
      const sellNoB = canSellAB && noBidLevelsB.length
        ? estimateSell(noBidLevelsB, sellSizeAB, feeB, feeCurveB, feeExpB, this.slippageBps)
        : null;
      const sellYesB = canSellBA && yesBidLevelsB.length
        ? estimateSell(yesBidLevelsB, sellSizeBA, feeB, feeCurveB, feeExpB, this.slippageBps)
        : null;
      const sellNoA = canSellBA && noBidLevelsA.length
        ? estimateSell(noBidLevelsA, sellSizeBA, feeA, feeCurveA, feeExpA, this.slippageBps)
        : null;

      const sellCandidateAB = canSellAB && yesBidLevelsA.length && noBidLevelsB.length
        ? this.refineSellCandidate(
            yesBidLevelsA,
            noBidLevelsB,
            feeA,
            feeB,
            feeCurveA,
            feeCurveB,
            feeExpA,
            feeExpB,
            sellSizeAB
          )
        : null;
      const sellCandidateBA = canSellBA && yesBidLevelsB.length && noBidLevelsA.length
        ? this.refineSellCandidate(
            yesBidLevelsB,
            noBidLevelsA,
            feeB,
            feeA,
            feeCurveB,
            feeCurveA,
            feeExpB,
            feeExpA,
            sellSizeBA
          )
        : null;

      let sellNetAB = -Infinity;
      let sellNetBA = -Infinity;
      const resolvedSellSizeAB = sellCandidateAB?.size ?? sellSizeAB;
      const resolvedSellSizeBA = sellCandidateBA?.size ?? sellSizeBA;

      if (sellSizeAB > 0 && canSellAB) {
        if (sellCandidateAB) {
          sellNetAB = sellCandidateAB.edge;
        } else {
          const sellProceedsAB = sellYesA && sellNoB
            ? (sellYesA.totalAllIn + sellNoB.totalAllIn) / sellSizeAB
            : yesBidA + noBidB;
          const sellFeeAB = sellYesA && sellNoB
            ? 0
            : calcFeeCost(yesBidA, feeA, feeCurveA, feeExpA) +
              calcFeeCost(noBidB, feeB, feeCurveB, feeExpB);
          sellNetAB = sellProceedsAB - 1 - sellFeeAB - this.estimatedTransferCost;
        }
      }

      if (sellSizeBA > 0 && canSellBA) {
        if (sellCandidateBA) {
          sellNetBA = sellCandidateBA.edge;
        } else {
          const sellProceedsBA = sellYesB && sellNoA
            ? (sellYesB.totalAllIn + sellNoA.totalAllIn) / sellSizeBA
            : yesBidB + noBidA;
          const sellFeeBA = sellYesB && sellNoA
            ? 0
            : calcFeeCost(yesBidB, feeB, feeCurveB, feeExpB) +
              calcFeeCost(noBidA, feeA, feeCurveA, feeExpA);
          sellNetBA = sellProceedsBA - 1 - sellFeeBA - this.estimatedTransferCost;
        }
      }

      if (sellNetAB >= sellNetBA && sellNetAB >= this.minProfitThreshold) {
        minCost = 1;
        profitPct = sellNetAB * 100;
        action = 'SELL_BOTH';
        depthShares = resolvedSellSizeAB;
        const proceedsPerShare =
          sellCandidateAB?.yes.avgAllIn && sellCandidateAB?.no.avgAllIn
            ? sellCandidateAB.yes.avgAllIn + sellCandidateAB.no.avgAllIn
            : sellYesA && sellNoB
              ? (sellYesA.totalAllIn + sellNoB.totalAllIn) / resolvedSellSizeAB
              : 1;
        notionalUsd = proceedsPerShare * depthShares;
        profitUsd = Math.max(0, (profitPct / 100) * depthShares);
        legs = [
          {
            platform: marketA.platform,
            tokenId: marketA.yesTokenId || '',
            side: 'SELL',
            price: sellCandidateAB?.yes.avgPrice ?? sellYesA?.avgPrice ?? yesBidA,
            shares: depthShares,
            outcome: 'YES',
          },
          {
            platform: marketB.platform,
            tokenId: marketB.noTokenId || '',
            side: 'SELL',
            price: sellCandidateAB?.no.avgPrice ?? sellNoB?.avgPrice ?? noBidB,
            shares: depthShares,
            outcome: 'NO',
          },
        ];
      } else if (sellNetBA >= this.minProfitThreshold) {
        minCost = 1;
        profitPct = sellNetBA * 100;
        action = 'SELL_BOTH';
        depthShares = resolvedSellSizeBA;
        const proceedsPerShare =
          sellCandidateBA?.yes.avgAllIn && sellCandidateBA?.no.avgAllIn
            ? sellCandidateBA.yes.avgAllIn + sellCandidateBA.no.avgAllIn
            : sellYesB && sellNoA
              ? (sellYesB.totalAllIn + sellNoA.totalAllIn) / resolvedSellSizeBA
              : 1;
        notionalUsd = proceedsPerShare * depthShares;
        profitUsd = Math.max(0, (profitPct / 100) * depthShares);
        legs = [
          {
            platform: marketB.platform,
            tokenId: marketB.yesTokenId || '',
            side: 'SELL',
            price: sellCandidateBA?.yes.avgPrice ?? sellYesB?.avgPrice ?? yesBidB,
            shares: depthShares,
            outcome: 'YES',
          },
          {
            platform: marketA.platform,
            tokenId: marketA.noTokenId || '',
            side: 'SELL',
            price: sellCandidateBA?.no.avgPrice ?? sellNoA?.avgPrice ?? noBidA,
            shares: depthShares,
            outcome: 'NO',
          },
        ];
      } else {
        return null;
      }
    } else {
      return null;
    }

    if (this.minNotionalUsd > 0 && notionalUsd < this.minNotionalUsd) {
      return null;
    }
    if (this.minProfitUsd > 0 && profitUsd < this.minProfitUsd) {
      return null;
    }

    const risks: string[] = [];
    if (similarity < 0.9) {
      risks.push('Event descriptions may not match exactly');
    }
    if (Math.abs((marketA.yesMid || 0.5) - (marketB.yesMid || 0.5)) > 0.2) {
      risks.push('Large price difference - possible settlement differences');
    }

    if (!Number.isFinite(depthShares) || depthShares <= 0) {
      return null;
    }

    return {
      event: marketA.question.substring(0, 50),
      outcome: 'YES/NO',
      action,
      platformA: {
        name: marketA.platform,
        yesPrice: marketA.yesMid || 0,
        market: marketA.marketId,
        yesTokenId: marketA.yesTokenId,
        noTokenId: marketA.noTokenId,
        yesBid: marketA.yesBid,
        yesAsk: marketA.yesAsk,
        noBid: marketA.noBid,
        noAsk: marketA.noAsk,
      },
      platformB: {
        name: marketB.platform,
        yesPrice: marketB.yesMid || 0,
        market: marketB.marketId,
        yesTokenId: marketB.yesTokenId,
        noTokenId: marketB.noTokenId,
        yesBid: marketB.yesBid,
        yesAsk: marketB.yesAsk,
        noBid: marketB.noBid,
        noAsk: marketB.noAsk,
      },
      priceDifference: (marketA.yesMid || 0) - (marketB.yesMid || 0),
      spreadPercentage: Math.abs((marketA.yesMid || 0) - (marketB.yesMid || 0)) * 100,
      arbitrageExists: true,
      minCost,
      guaranteedPayout: 1,
      profitPercentage: profitPct,
      recommendedSize: depthShares,
      legs,
      risks,
      eventDescriptionMatch: similarity > 0.9,
    };
  }

  /**
   * 计算两个字符串的相似度
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    const words1 = new Set(s1.split(/\s+/));
    const words2 = new Set(s2.split(/\s+/));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * 扫描跨平台套利机会
   */
  scanMarkets(
    allMarkets: Map<string, PlatformMarket[]>,
    mappingStore?: CrossPlatformMappingStore,
    useMapping: boolean = true
  ): CrossPlatformArbitrage[] {
    const opportunities: CrossPlatformArbitrage[] = [];
    const platformNames = Array.from(allMarkets.keys());

    for (let i = 0; i < platformNames.length; i++) {
      for (let j = i + 1; j < platformNames.length; j++) {
        const platformA = platformNames[i];
        const platformB = platformNames[j];

        const marketsA = allMarkets.get(platformA) || [];
        const marketsB = allMarkets.get(platformB) || [];

        for (const marketA of marketsA) {
          let targets = marketsB;
          if (useMapping && mappingStore) {
            if (marketA.platform === 'Predict') {
              const mapped = mappingStore.resolveMatches(marketA, allMarkets);
              if (mapped.length > 0) {
                targets = mapped.filter((m) => m.platform === platformB);
              }
            }
          }

          for (const marketB of targets) {
            const arb = this.detectArbitrage(marketA, marketB);
            if (arb) {
              opportunities.push(arb);
            }
          }
        }
      }
    }

    opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);

    return opportunities;
  }

  /**
   * 转换为通用套利机会格式
   */
  toOpportunity(arb: CrossPlatformArbitrage): ArbitrageOpportunity {
    return {
      type: 'CROSS_PLATFORM',
      marketId: arb.platformA.market,
      marketQuestion: arb.event,
      timestamp: Date.now(),
      confidence: arb.eventDescriptionMatch ? 0.8 : 0.5,
      platformA: arb.platformA.name,
      platformB: arb.platformB.name,
      priceA: arb.platformA.yesPrice,
      priceB: arb.platformB.yesPrice,
      spread: Math.abs(arb.priceDifference),
      expectedReturn: arb.profitPercentage,
      riskLevel: arb.risks.length > 0 ? 'HIGH' : 'MEDIUM',
      recommendedAction: arb.action,
      positionSize: arb.recommendedSize,
      legs: arb.legs?.map((leg) => ({
        platform: leg.platform,
        tokenId: leg.tokenId,
        side: leg.side,
        price: leg.price,
        shares: leg.shares,
        outcome: leg.outcome,
      })),
    };
  }

  /**
   * 打印跨平台套利报告
   */
  printReport(arbitrages: CrossPlatformArbitrage[]): void {
    console.log('\n🌐 Cross-Platform Arbitrage Opportunities:');
    console.log('─'.repeat(80));

    if (arbitrages.length === 0) {
      console.log('No cross-platform arbitrage opportunities found.');
      console.log('Prices are aligned across platforms (within threshold).\n');
      return;
    }

    for (let i = 0; i < Math.min(10, arbitrages.length); i++) {
      const arb = arbitrages[i];
      console.log(`\n#${i + 1} ${arb.event}`);
      console.log(`   ${arb.platformA.name}: ${arb.platformA.yesPrice.toFixed(2)}¢ (${arb.platformA.market})`);
      console.log(`   ${arb.platformB.name}: ${arb.platformB.yesPrice.toFixed(2)}¢ (${arb.platformB.market})`);
      console.log(`   Action: ${arb.action}`);
      console.log(`   Price Difference: ${arb.priceDifference.toFixed(2)}¢ (${arb.spreadPercentage.toFixed(2)}%)`);
      console.log(`   Min Cost: ${arb.minCost.toFixed(2)}¢ per $1`);
      console.log(`   Profit: ${arb.profitPercentage.toFixed(2)}%`);
      console.log(`   Events Match: ${arb.eventDescriptionMatch ? '✅' : '⚠️'}`);

      if (arb.risks.length > 0) {
        console.log(`   Risks: ${arb.risks.join(', ')}`);
      }
    }

    console.log('\n' + '─'.repeat(80));
  }
}
