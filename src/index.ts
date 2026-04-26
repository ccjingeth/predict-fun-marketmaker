/**
 * Predict.fun Market Maker Bot
 * Main entry point
 */

import fs from 'node:fs';
import path from 'node:path';
import { Wallet } from 'ethers';
import { loadConfig, printConfig } from './config.js';
import { PredictAPI } from './api/client.js';
import { PolymarketAPI } from './api/polymarket-client.js';
import { MarketSelector, evaluatePolymarketEventRisk } from './market-selector.js';
import { MarketMaker } from './market-maker.js';
import { applyLiquidityRules } from './markets-config.js';
import { PredictWebSocketFeed } from './external/predict-ws.js';
import { PolymarketWebSocketFeed } from './external/polymarket-ws.js';
import { PolymarketOrderManager } from './order-manager-polymarket.js';
import type { Market, Orderbook } from './types.js';
import { setupLogger } from './utils/logger.js';

// 启动日志系统（最早，确保所有console输出都落盘）
setupLogger();

// ==================== JWT 自动获取 ====================
function upsertEnvVar(envContent: string, key: string, value: string): string {
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  const line = `${key}=${value}`;
  if (pattern.test(envContent)) {
    return envContent.replace(pattern, line);
  }
  return `${envContent.trimEnd()}\n${line}\n`;
}

async function autoFetchJwt(config: ReturnType<typeof loadConfig>): Promise<string | undefined> {
  if (!config.apiKey) {
    console.log('⚠️  API_KEY 未配置，无法自动获取 JWT');
    return undefined;
  }
  if (!config.privateKey || config.privateKey === '0x0000000000000000000000000000000000000000000000000000000000000001') {
    console.log('⚠️  PRIVATE_KEY 未配置或为占位符，无法自动获取 JWT');
    return undefined;
  }

  console.log('🔐 检测到 JWT_TOKEN 缺失，尝试自动获取...');

  // 重试包装函数
  async function retry<T>(fn: () => Promise<T>, retries = 3, delayMs = 2000): Promise<T> {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (err: any) {
        if (i === retries - 1) throw err;
        console.log(`[JWT] 重试 ${i + 1}/${retries - 1} (${err?.message || 'unknown error'})...`);
        await new Promise(r => setTimeout(r, delayMs * (i + 1))); // 指数退避
      }
    }
    throw new Error('Retry exhausted');
  }

  try {
    // 动态导入以避免不必要的依赖加载
    const axios = (await import('axios')).default;
    const { JsonRpcProvider } = await import('ethers');
    const { ChainId, OrderBuilder } = await import('@predictdotfun/sdk');

    const baseUrl = config.apiBaseUrl.replace(/\/+$/, '');
    const http = axios.create({
      baseURL: baseUrl,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
      },
    });

    // Step 1: Get auth message (带重试)
    let message = '';
    try {
      const res = await retry(() => http.get('/v1/auth/message'));
      const payload = res.data?.data ?? res.data;
      message = typeof payload === 'string' ? payload : String(payload?.message || '');
    } catch {
      const res = await retry(() => http.get('/auth/message'));
      const payload = res.data?.data ?? res.data;
      message = typeof payload === 'string' ? payload : String(payload?.message || '');
    }

    if (!message) {
      console.log('❌ 自动获取 JWT 失败: 无法获取 auth message');
      return undefined;
    }

    // Step 2: Sign message
    const wallet = config.rpcUrl
      ? new Wallet(config.privateKey, new JsonRpcProvider(config.rpcUrl))
      : new Wallet(config.privateKey);

    const signerAddress = config.predictAccountAddress || wallet.address;
    let signature = '';

    if (config.predictAccountAddress) {
      const chainId = config.predictChainId ?? ChainId.BnbMainnet;
      const orderBuilder = await OrderBuilder.make(chainId, wallet, {
        predictAccount: config.predictAccountAddress,
      });
      signature = await orderBuilder.signPredictAccountMessage(message);
    } else {
      signature = await wallet.signMessage(message);
    }

    // Step 3: Exchange for JWT (带重试)
    let token = '';
    try {
      const res = await retry(() => http.post('/v1/auth', { signer: signerAddress, signature, message }));
      const data = res.data?.data ?? res.data;
      token = data?.token || data?.jwt || data?.accessToken || '';
    } catch {
      const res = await retry(() => http.post('/auth', { signer: signerAddress, signature, message }));
      const data = res.data?.data ?? res.data;
      token = data?.token || data?.jwt || data?.accessToken || '';
    }

    if (!token) {
      console.log('❌ 自动获取 JWT 失败: auth 成功但未返回 token');
      return undefined;
    }

    // Step 4: Write to .env
    const envPath = process.env.ENV_PATH || path.join(process.cwd(), '.env');
    const oldContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    const updated = upsertEnvVar(oldContent, 'JWT_TOKEN', token);
    fs.writeFileSync(envPath, updated, 'utf8');

    console.log(`✅ JWT token 自动获取成功! Signer: ${signerAddress}`);
    return token;
  } catch (error: any) {
    console.log(`❌ 自动获取 JWT 失败: ${error?.message || error}`);
    return undefined;
  }
}

function sortMarketsByLiquidityAndVolume(markets: Market[]): Market[] {
  const scoreMarket = (market: Market): number => {
    const liquidity = Math.log10(Number(market.liquidity_24h || 0) + 1) * 4;
    const volume = Math.log10(Number(market.volume_24h || 0) + 1) * 2.5;
    const rewardDaily = Number(market.polymarket_reward_daily_rate || 0);
    const rewardMaxSpread = Number(market.polymarket_reward_max_spread || 0);
    const rewardScore = market.polymarket_rewards_enabled
      ? 6 + Math.log10(rewardDaily + 1) * 5 + Math.min(3, rewardMaxSpread * 60)
      : 0;
    return liquidity + volume + rewardScore;
  };

  return [...markets].sort((a, b) => scoreMarket(b) - scoreMarket(a));
}

function loadRecentPolymarketRiskPenalty(
  metricsPath: string | undefined,
  cwd: string,
  pauseConfig: {
    rewardPauseMs: number;
    postOnlyPauseMs: number;
    adverseFillPauseMs: number;
    positionLossPauseMs: number;
  },
  marketRiskConfig: {
    cancelRatePenaltyStart: number;
    cancelRatePenaltyMax: number;
    minAvgOrderLifetimeMs: number;
    shortLifetimePenaltyMax: number;
  },
  lookbackMs: number = 6 * 60 * 60 * 1000,
  maxPenalty: number = 16
): Map<
  string,
  {
    penalty: number;
    reason: string;
    cooldownRemainingMs?: number;
    cooldownReason?: string;
    fillPenaltyBps?: number;
    riskThrottleFactor?: number;
    cancelRate?: number;
    avgCancelLifetimeMs?: number;
    avgFillLifetimeMs?: number;
    cancelPenalty?: number;
    lifetimePenalty?: number;
    cancelNearTouch?: number;
    cancelRefresh?: number;
    cancelVwap?: number;
    cancelAggressive?: number;
    cancelUnsafe?: number;
  }
> {
  type RecentPenaltyEntry = {
    penalty: number;
    reason: string;
    cooldownRemainingMs?: number;
    cooldownReason?: string;
    fillPenaltyBps?: number;
    riskThrottleFactor?: number;
    cancelRate?: number;
    avgCancelLifetimeMs?: number;
    avgFillLifetimeMs?: number;
    cancelPenalty?: number;
    lifetimePenalty?: number;
    cancelNearTouch?: number;
    cancelRefresh?: number;
    cancelVwap?: number;
    cancelAggressive?: number;
    cancelUnsafe?: number;
  };
  type RecentPenaltyScoreState = {
    penalty: number;
    adverse: number;
    pauses: number;
    postOnly: number;
    cooldownRemainingMs: number;
    cooldownReason: string;
    fillPenaltyBps: number;
    riskThrottleFactor: number;
    cancelRate: number;
    avgCancelLifetimeMs: number;
    avgFillLifetimeMs: number;
    cancelPenalty: number;
    lifetimePenalty: number;
    cancelNearTouch: number;
    cancelRefresh: number;
    cancelVwap: number;
    cancelAggressive: number;
    cancelUnsafe: number;
  };

  const penalties = new Map<string, RecentPenaltyEntry>();
  if (!metricsPath) {
    return penalties;
  }

  try {
    const resolved = path.isAbsolute(metricsPath) ? metricsPath : path.resolve(cwd, metricsPath);
    if (!fs.existsSync(resolved)) {
      return penalties;
    }
    const raw = JSON.parse(fs.readFileSync(resolved, 'utf8')) as {
      ts?: number;
      events?: Array<{ ts?: number; type?: string; tokenId?: string; message?: string }>;
      markets?: Array<{
        tokenId?: string;
        fillPenaltyBps?: number;
        riskThrottleFactor?: number;
        cancelRate?: number;
        avgCancelLifetimeMs?: number;
        avgFillLifetimeMs?: number;
        cancelPenalty?: number;
        lifetimePenalty?: number;
        cancelNearTouch?: number;
        cancelRefresh?: number;
        cancelVwap?: number;
        cancelAggressive?: number;
        cancelUnsafe?: number;
      }>;
    };
    const cutoff = Date.now() - lookbackMs;
    const scores = new Map<string, RecentPenaltyScoreState>();

    const getPauseDurationMs = (type: string, message: string): number => {
      if (type === 'POLYMARKET_POST_ONLY_FUSE' || message.includes('polymarket-post-only')) {
        return pauseConfig.postOnlyPauseMs;
      }
      if (type === 'POLYMARKET_ADVERSE_FILL' || message.includes('polymarket-adverse-fill')) {
        return pauseConfig.adverseFillPauseMs;
      }
      if (message.includes('polymarket-position-loss')) {
        return pauseConfig.positionLossPauseMs;
      }
      if (message.includes('polymarket-reward-gate')) {
        return pauseConfig.rewardPauseMs;
      }
      return 0;
    };

    for (const event of raw.events || []) {
      const tokenId = String(event.tokenId || '');
      if (!tokenId) continue;
      const ts = Number(event.ts || 0);
      if (!Number.isFinite(ts) || ts < cutoff) continue;
      const type = String(event.type || '');
      const message = String(event.message || '');
      const entry: RecentPenaltyScoreState = scores.get(tokenId) || {
        penalty: 0,
        adverse: 0,
        pauses: 0,
        postOnly: 0,
        cooldownRemainingMs: 0,
        cooldownReason: '',
        fillPenaltyBps: 0,
        riskThrottleFactor: 1,
        cancelRate: 0,
        avgCancelLifetimeMs: 0,
        avgFillLifetimeMs: 0,
        cancelPenalty: 0,
        lifetimePenalty: 0,
        cancelNearTouch: 0,
        cancelRefresh: 0,
        cancelVwap: 0,
        cancelAggressive: 0,
        cancelUnsafe: 0,
      };
      if (type === 'POLYMARKET_ADVERSE_FILL') {
        entry.penalty += 2;
        entry.adverse += 1;
      } else if (type === 'POLYMARKET_POST_ONLY_FUSE') {
        entry.penalty += 4;
        entry.postOnly += 1;
      } else if (type === 'MARKET_PAUSE' && message.includes('polymarket-')) {
        entry.penalty += 5;
        entry.pauses += 1;
      }
      const pauseDurationMs = getPauseDurationMs(type, message);
      if (pauseDurationMs > 0) {
        const remainingMs = Math.max(0, ts + pauseDurationMs - Date.now());
        if (remainingMs > entry.cooldownRemainingMs) {
          entry.cooldownRemainingMs = remainingMs;
          entry.cooldownReason = message || type;
        }
      }
      scores.set(tokenId, entry);
    }

    for (const metric of raw.markets || []) {
      const tokenId = String(metric.tokenId || '');
      if (!tokenId) continue;
      const entry: RecentPenaltyScoreState = scores.get(tokenId) || {
        penalty: 0,
        adverse: 0,
        pauses: 0,
        postOnly: 0,
        cooldownRemainingMs: 0,
        cooldownReason: '',
        fillPenaltyBps: 0,
        riskThrottleFactor: 1,
        cancelRate: 0,
        avgCancelLifetimeMs: 0,
        avgFillLifetimeMs: 0,
        cancelPenalty: 0,
        lifetimePenalty: 0,
        cancelNearTouch: 0,
        cancelRefresh: 0,
        cancelVwap: 0,
        cancelAggressive: 0,
        cancelUnsafe: 0,
      };
      const fillPenaltyBps = Number(metric.fillPenaltyBps || 0);
      const riskThrottleFactor = Number(metric.riskThrottleFactor || 1);
      const cancelRate = Number(metric.cancelRate || 0);
      const avgCancelLifetimeMs = Number(metric.avgCancelLifetimeMs || 0);
      const avgFillLifetimeMs = Number(metric.avgFillLifetimeMs || 0);
      const derivedCancelPenalty = Number(metric.cancelPenalty || 0);
      const derivedLifetimePenalty = Number(metric.lifetimePenalty || 0);
      const cancelNearTouch = Number(metric.cancelNearTouch || 0);
      const cancelRefresh = Number(metric.cancelRefresh || 0);
      const cancelVwap = Number(metric.cancelVwap || 0);
      const cancelAggressive = Number(metric.cancelAggressive || 0);
      const cancelUnsafe = Number(metric.cancelUnsafe || 0);
      if (Number.isFinite(fillPenaltyBps) && fillPenaltyBps > 0) {
        entry.penalty += Math.min(4, fillPenaltyBps / 6);
        entry.fillPenaltyBps = Math.max(entry.fillPenaltyBps, fillPenaltyBps);
      }
      if (Number.isFinite(riskThrottleFactor) && riskThrottleFactor > 0 && riskThrottleFactor < 1) {
        entry.penalty += Math.min(4, (1 - riskThrottleFactor) * 6);
        entry.riskThrottleFactor = Math.min(entry.riskThrottleFactor, riskThrottleFactor);
      }
      if (Number.isFinite(cancelRate) && cancelRate > 0) {
        const cancelPenalty =
          derivedCancelPenalty > 0
            ? derivedCancelPenalty
            : cancelRate <= marketRiskConfig.cancelRatePenaltyStart
              ? 0
              : Math.min(
                  marketRiskConfig.cancelRatePenaltyMax,
                  ((cancelRate - marketRiskConfig.cancelRatePenaltyStart) /
                    Math.max(0.01, 1 - marketRiskConfig.cancelRatePenaltyStart)) *
                    marketRiskConfig.cancelRatePenaltyMax
                );
        entry.penalty += cancelPenalty;
        entry.cancelRate = Math.max(entry.cancelRate, cancelRate);
        entry.cancelPenalty = Math.max(entry.cancelPenalty, cancelPenalty);
      }
      const totalCancelReasons = cancelNearTouch + cancelRefresh + cancelVwap + cancelAggressive + cancelUnsafe;
      if (Number.isFinite(totalCancelReasons) && totalCancelReasons >= 3) {
        const reasonPenalty =
          Math.min(4, (cancelNearTouch / totalCancelReasons) * 3.5) +
          Math.min(4, (cancelAggressive / totalCancelReasons) * 4) +
          Math.min(3, (cancelUnsafe / totalCancelReasons) * 2.5) +
          Math.min(2, (cancelVwap / totalCancelReasons) * 1.5) +
          Math.min(1.5, (cancelRefresh / totalCancelReasons) * 1);
        entry.penalty += reasonPenalty;
      }
      entry.cancelNearTouch = Math.max(entry.cancelNearTouch, cancelNearTouch);
      entry.cancelRefresh = Math.max(entry.cancelRefresh, cancelRefresh);
      entry.cancelVwap = Math.max(entry.cancelVwap, cancelVwap);
      entry.cancelAggressive = Math.max(entry.cancelAggressive, cancelAggressive);
      entry.cancelUnsafe = Math.max(entry.cancelUnsafe, cancelUnsafe);
      if (Number.isFinite(avgCancelLifetimeMs) && avgCancelLifetimeMs > 0) {
        entry.avgCancelLifetimeMs =
          entry.avgCancelLifetimeMs > 0 ? Math.min(entry.avgCancelLifetimeMs, avgCancelLifetimeMs) : avgCancelLifetimeMs;
      }
      if (Number.isFinite(avgFillLifetimeMs) && avgFillLifetimeMs > 0) {
        entry.avgFillLifetimeMs =
          entry.avgFillLifetimeMs > 0 ? Math.min(entry.avgFillLifetimeMs, avgFillLifetimeMs) : avgFillLifetimeMs;
      }
      const comparableLifetimeMs = avgCancelLifetimeMs > 0 ? avgCancelLifetimeMs : avgFillLifetimeMs;
      if (Number.isFinite(comparableLifetimeMs) && comparableLifetimeMs > 0) {
        const lifetimePenalty =
          derivedLifetimePenalty > 0
            ? derivedLifetimePenalty
            : Math.max(
                0,
                Math.min(
                  marketRiskConfig.shortLifetimePenaltyMax,
                  ((marketRiskConfig.minAvgOrderLifetimeMs - comparableLifetimeMs) /
                    Math.max(1, marketRiskConfig.minAvgOrderLifetimeMs)) *
                    marketRiskConfig.shortLifetimePenaltyMax
                )
              );
        entry.penalty += lifetimePenalty;
        entry.lifetimePenalty = Math.max(entry.lifetimePenalty, lifetimePenalty);
      }
      scores.set(tokenId, entry);
    }

    for (const [tokenId, entry] of scores) {
      const penalty = Math.min(maxPenalty, entry.penalty);
      if (penalty <= 0) continue;
      const reasonParts: string[] = [];
      if (entry.adverse > 0) reasonParts.push(`不利成交${entry.adverse}次`);
      if (entry.postOnly > 0) reasonParts.push(`postOnly熔断${entry.postOnly}次`);
      if (entry.pauses > 0) reasonParts.push(`风控暂停${entry.pauses}次`);
      if (entry.cancelRate > 0) reasonParts.push(`撤单率${(entry.cancelRate * 100).toFixed(0)}%`);
      if (entry.avgCancelLifetimeMs > 0) reasonParts.push(`平均撤单寿命${Math.round(entry.avgCancelLifetimeMs / 1000)}s`);
      if (entry.cancelNearTouch > 0) reasonParts.push(`近触撤单${entry.cancelNearTouch}次`);
      if (entry.cancelAggressive > 0) reasonParts.push(`追价撤单${entry.cancelAggressive}次`);
      if (entry.cancelUnsafe > 0) reasonParts.push(`风控撤单${entry.cancelUnsafe}次`);
      penalties.set(tokenId, {
        penalty,
        reason: `${reasonParts.join(' / ') || '近期风险'} (-${penalty.toFixed(1)})`,
        cooldownRemainingMs: entry.cooldownRemainingMs > 0 ? entry.cooldownRemainingMs : undefined,
        cooldownReason: entry.cooldownReason || undefined,
        fillPenaltyBps: entry.fillPenaltyBps > 0 ? entry.fillPenaltyBps : undefined,
        riskThrottleFactor: entry.riskThrottleFactor > 0 && entry.riskThrottleFactor < 1 ? entry.riskThrottleFactor : undefined,
        cancelRate: entry.cancelRate > 0 ? entry.cancelRate : undefined,
        avgCancelLifetimeMs: entry.avgCancelLifetimeMs > 0 ? entry.avgCancelLifetimeMs : undefined,
        avgFillLifetimeMs: entry.avgFillLifetimeMs > 0 ? entry.avgFillLifetimeMs : undefined,
        cancelPenalty: entry.cancelPenalty > 0 ? entry.cancelPenalty : undefined,
        lifetimePenalty: entry.lifetimePenalty > 0 ? entry.lifetimePenalty : undefined,
        cancelNearTouch: entry.cancelNearTouch > 0 ? entry.cancelNearTouch : undefined,
        cancelRefresh: entry.cancelRefresh > 0 ? entry.cancelRefresh : undefined,
        cancelVwap: entry.cancelVwap > 0 ? entry.cancelVwap : undefined,
        cancelAggressive: entry.cancelAggressive > 0 ? entry.cancelAggressive : undefined,
        cancelUnsafe: entry.cancelUnsafe > 0 ? entry.cancelUnsafe : undefined,
      });
    }
  } catch (error) {
    console.warn('⚠️ 读取近期风险记忆失败，忽略:', error);
  }

  return penalties;
}

function resolvePolymarketPatternMemoryPath(metricsPath: string | undefined, cwd: string): string | null {
  if (!metricsPath) {
    return null;
  }
  const resolved = path.isAbsolute(metricsPath) ? metricsPath : path.resolve(cwd, metricsPath);
  return resolved.endsWith('.json')
    ? resolved.replace(/\.json$/i, '.polymarket-pattern-memory.json')
    : `${resolved}.polymarket-pattern-memory.json`;
}

function loadPolymarketPatternMemory(
  metricsPath: string | undefined,
  cwd: string,
  ttlMs: number = 7 * 24 * 60 * 60 * 1000,
  maxPenalty: number = 8
): Map<
  string,
  {
    penalty: number;
    reason: string;
    dominance?: number;
    dominantReason?: string;
    ageMs?: number;
    ttlRemainingMs?: number;
    decayFactor?: number;
    reasonMix?: Record<string, number>;
    learnedRetreatMix?: Record<string, number>;
    learnedSizeMix?: Record<string, number>;
    learnedRetreat?: number;
    learnedSize?: number;
  }
> {
  const penalties = new Map<
    string,
    {
      penalty: number;
      reason: string;
      dominance?: number;
      dominantReason?: string;
      ageMs?: number;
      ttlRemainingMs?: number;
      decayFactor?: number;
      reasonMix?: Record<string, number>;
      learnedRetreatMix?: Record<string, number>;
      learnedSizeMix?: Record<string, number>;
      learnedRetreat?: number;
      learnedSize?: number;
    }
  >();
  const memoryPath = resolvePolymarketPatternMemoryPath(metricsPath, cwd);
  if (!memoryPath) {
    return penalties;
  }
  try {
    if (!fs.existsSync(memoryPath)) {
      return penalties;
    }
    const raw = JSON.parse(fs.readFileSync(memoryPath, 'utf8')) as {
      markets?: Array<{
        tokenId?: string;
        updatedAt?: number;
        penalty?: number;
        dominance?: number;
        dominantReason?: string;
        reasonMix?: Record<string, number>;
        learnedRetreatMix?: Record<string, number>;
        learnedSizeMix?: Record<string, number>;
        learnedRetreat?: number;
        learnedSize?: number;
      }>;
    };
    const now = Date.now();
    for (const entry of raw.markets || []) {
      const tokenId = String(entry.tokenId || '');
      if (!tokenId) continue;
      const updatedAt = Number(entry.updatedAt || 0);
      if (!Number.isFinite(updatedAt) || now - updatedAt > ttlMs) continue;
      const penalty = Math.min(maxPenalty, Math.max(0, Number(entry.penalty || 0)));
      if (penalty <= 0) continue;
      const ageMs = Math.max(0, now - updatedAt);
      const ttlRemainingMs = Math.max(0, updatedAt + ttlMs - now);
      const decayFactor = ttlMs > 0 ? Math.max(0, Math.min(1, 1 - ageMs / ttlMs)) : 1;
      const dominance = Math.max(0, Math.min(1, Number(entry.dominance || 0)));
      const dominantReason = String(entry.dominantReason || '');
      const reasonLabel =
        dominantReason === 'aggressive'
          ? '激进走势撤单'
          : dominantReason === 'unsafe'
            ? '不安全盘口撤单'
            : dominantReason === 'nearTouch'
              ? '近触撤单'
              : dominantReason === 'vwap'
                ? 'VWAP 风控撤单'
                : dominantReason === 'refresh'
                  ? '追价撤单'
                  : dominantReason || '撤单模式';
      penalties.set(tokenId, {
        penalty,
        reason: `长期撤单模式: ${reasonLabel} ${(dominance * 100).toFixed(0)}% (-${penalty.toFixed(1)})`,
        dominance: dominance > 0 ? dominance : undefined,
        dominantReason: dominantReason || undefined,
        ageMs,
        ttlRemainingMs,
        decayFactor,
        reasonMix: entry.reasonMix && typeof entry.reasonMix === 'object' ? entry.reasonMix : undefined,
        learnedRetreatMix:
          entry.learnedRetreatMix && typeof entry.learnedRetreatMix === 'object' ? entry.learnedRetreatMix : undefined,
        learnedSizeMix:
          entry.learnedSizeMix && typeof entry.learnedSizeMix === 'object' ? entry.learnedSizeMix : undefined,
        learnedRetreat: Number.isFinite(Number(entry.learnedRetreat)) ? Number(entry.learnedRetreat) : undefined,
        learnedSize: Number.isFinite(Number(entry.learnedSize)) ? Number(entry.learnedSize) : undefined,
      });
    }
  } catch (error) {
    console.warn('⚠️ 读取 Polymarket 撤单模式长期记忆失败，忽略:', error);
  }
  return penalties;
}

function loadPolymarketHourRiskPenalty(
  metricsPath: string | undefined,
  cwd: string,
  lookbackDays: number = 7,
  maxPenalty: number = 8
): { penalty: number; reason: string; hour: number } {
  const currentHour = new Date().getHours();
  if (!metricsPath) {
    return { penalty: 0, reason: '', hour: currentHour };
  }

  try {
    const resolved = path.isAbsolute(metricsPath) ? metricsPath : path.resolve(cwd, metricsPath);
    if (!fs.existsSync(resolved)) {
      return { penalty: 0, reason: '', hour: currentHour };
    }
    const raw = JSON.parse(fs.readFileSync(resolved, 'utf8')) as {
      events?: Array<{ ts?: number; type?: string; tokenId?: string; message?: string }>;
    };
    const cutoff = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;
    let penalty = 0;
    let adverse = 0;
    let postOnly = 0;
    let pauses = 0;

    for (const event of raw.events || []) {
      const ts = Number(event.ts || 0);
      if (!Number.isFinite(ts) || ts < cutoff) continue;
      const date = new Date(ts);
      if (date.getHours() !== currentHour) continue;
      const type = String(event.type || '');
      const message = String(event.message || '');
      if (type === 'POLYMARKET_ADVERSE_FILL') {
        penalty += 1.5;
        adverse += 1;
      } else if (type === 'POLYMARKET_POST_ONLY_FUSE') {
        penalty += 2;
        postOnly += 1;
      } else if (type === 'MARKET_PAUSE' && message.includes('polymarket-')) {
        penalty += 1.25;
        pauses += 1;
      }
    }

    const bounded = Math.min(maxPenalty, penalty);
    if (bounded <= 0) {
      return { penalty: 0, reason: '', hour: currentHour };
    }
    const parts: string[] = [];
    if (adverse > 0) parts.push(`不利成交${adverse}次`);
    if (postOnly > 0) parts.push(`postOnly熔断${postOnly}次`);
    if (pauses > 0) parts.push(`风控暂停${pauses}次`);
    return {
      penalty: bounded,
      reason: `${currentHour}点时段近期偏危险: ${parts.join(' / ') || '风险偏高'} (-${bounded.toFixed(1)})`,
      hour: currentHour,
    };
  } catch (error) {
    console.warn('⚠️ 读取 Polymarket 分时段风险失败，忽略:', error);
    return { penalty: 0, reason: '', hour: currentHour };
  }
}

function loadPolymarketObservedQueueStats(
  metricsPath: string | undefined,
  cwd: string
): Map<string, { filled?: number; cancelRate?: number; avgFillLifetimeMs?: number }> {
  const observed = new Map<string, { filled?: number; cancelRate?: number; avgFillLifetimeMs?: number }>();
  if (!metricsPath) {
    return observed;
  }
  try {
    const resolved = path.isAbsolute(metricsPath) ? metricsPath : path.resolve(cwd, metricsPath);
    if (!fs.existsSync(resolved)) {
      return observed;
    }
    const raw = JSON.parse(fs.readFileSync(resolved, 'utf8')) as {
      markets?: Array<{ tokenId?: string; filled?: number; cancelRate?: number; avgFillLifetimeMs?: number }>;
    };
    for (const metric of raw.markets || []) {
      const tokenId = String(metric.tokenId || '').trim();
      if (!tokenId) continue;
      const filled = Number(metric.filled || 0);
      const cancelRate = Number(metric.cancelRate || 0);
      const avgFillLifetimeMs = Number(metric.avgFillLifetimeMs || 0);
      if (filled <= 0 && avgFillLifetimeMs <= 0) continue;
      observed.set(tokenId, {
        filled: filled > 0 ? filled : undefined,
        cancelRate: Number.isFinite(cancelRate) ? cancelRate : undefined,
        avgFillLifetimeMs: avgFillLifetimeMs > 0 ? avgFillLifetimeMs : undefined,
      });
    }
  } catch (error) {
    console.error('[Polymarket] 读取观测队列速度失败，已忽略:', error);
  }
  return observed;
}

function loadPolymarketHourlyMarketRisk(
  metricsPath: string | undefined,
  cwd: string,
  lookbackDays: number = 7,
  maxPenalty: number = 8
): Map<string, { penalty: number; reason: string; hour: number }> {
  const currentHour = new Date().getHours();
  const penalties = new Map<string, { penalty: number; reason: string; hour: number }>();
  if (!metricsPath) {
    return penalties;
  }

  try {
    const resolved = path.isAbsolute(metricsPath) ? metricsPath : path.resolve(cwd, metricsPath);
    if (!fs.existsSync(resolved)) {
      return penalties;
    }
    const raw = JSON.parse(fs.readFileSync(resolved, 'utf8')) as {
      events?: Array<{ ts?: number; type?: string; tokenId?: string; message?: string }>;
    };
    const cutoff = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;
    const scores = new Map<string, { penalty: number; adverse: number; postOnly: number; pauses: number }>();

    for (const event of raw.events || []) {
      const tokenId = String(event.tokenId || '');
      if (!tokenId) continue;
      const ts = Number(event.ts || 0);
      if (!Number.isFinite(ts) || ts < cutoff) continue;
      const date = new Date(ts);
      if (date.getHours() !== currentHour) continue;
      const type = String(event.type || '');
      const message = String(event.message || '');
      const entry = scores.get(tokenId) || { penalty: 0, adverse: 0, postOnly: 0, pauses: 0 };
      if (type === 'POLYMARKET_ADVERSE_FILL') {
        entry.penalty += 1.75;
        entry.adverse += 1;
      } else if (type === 'POLYMARKET_POST_ONLY_FUSE') {
        entry.penalty += 2.25;
        entry.postOnly += 1;
      } else if (type === 'MARKET_PAUSE' && message.includes('polymarket-')) {
        entry.penalty += 1.5;
        entry.pauses += 1;
      }
      scores.set(tokenId, entry);
    }

    for (const [tokenId, score] of scores.entries()) {
      const bounded = Math.min(maxPenalty, score.penalty);
      if (bounded <= 0) continue;
      const parts: string[] = [];
      if (score.adverse > 0) parts.push(`不利成交${score.adverse}次`);
      if (score.postOnly > 0) parts.push(`postOnly熔断${score.postOnly}次`);
      if (score.pauses > 0) parts.push(`风控暂停${score.pauses}次`);
      penalties.set(tokenId, {
        penalty: bounded,
        reason: `${currentHour}点该市场时段偏危险: ${parts.join(' / ') || '风险偏高'} (-${bounded.toFixed(1)})`,
        hour: currentHour,
      });
    }
  } catch (error) {
    console.warn('⚠️ 读取 Polymarket 分市场时段风险失败，忽略:', error);
  }

  return penalties;
}

async function populateOrderbooksWithConcurrency(
  markets: Market[],
  concurrency: number,
  fetcher: (tokenId: string) => Promise<Orderbook>
): Promise<Map<string, Orderbook>> {
  const orderbooks = new Map<string, Orderbook>();
  const batchSize = Math.max(1, concurrency);

  for (let i = 0; i < markets.length; i += batchSize) {
    const batch = markets.slice(i, i + batchSize);
    const settled = await Promise.allSettled(
      batch.map(async (market) => {
        const orderbook = await fetcher(market.token_id);
        orderbooks.set(market.token_id, orderbook);
        market.best_bid = orderbook.best_bid;
        market.best_ask = orderbook.best_ask;
        market.spread_pct = orderbook.spread_pct;
        market.total_orders = (orderbook.bids?.length || 0) + (orderbook.asks?.length || 0);
      })
    );

    settled.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Error fetching orderbook for ${batch[index]?.token_id}:`, result.reason);
      }
    });
  }

  return orderbooks;
}

export class PredictMarketMakerBot {
  private static readonly PREDICT_SAFE_MAX_SPREAD = 0.06;
  private static readonly PREDICT_SAFE_MIN_L1_NOTIONAL = 25;
  private static readonly PREDICT_SAFE_MIN_L2_NOTIONAL = 10;
  private static readonly PREDICT_SAFE_MIN_PRICE = 0.08;
  private static readonly PREDICT_SAFE_MAX_PRICE = 0.92;
  private static readonly PREDICT_SAFE_MAX_LEVEL_GAP = 0.02;
  private static readonly PREDICT_SAFE_MIN_L2_TO_L1_RATIO = 0.25;
  private api: PredictAPI;
  private marketSelector: MarketSelector;
  private marketMaker: MarketMaker;
  private config: any;
  private wallet: Wallet;
  private running = false;
  private selectedMarkets: Market[] = [];
  private marketByToken: Map<string, Market> = new Map();
  private wsFeed?: PredictWebSocketFeed;
  private wsDirtyTokens: Set<string> = new Set();
  private wsDirtyUnsub?: () => void;
  private wsLastCancelAt: Map<string, number> = new Map();
  private wsFallbackAt: Map<string, number> = new Map();
  private wsBadCount: Map<string, number> = new Map();
  private wsGapUntil: Map<string, number> = new Map();
  private wsHealthScore = 100;
  private lastStateUpdate = 0;
  private consecutiveLoopErrors = 0;
  private wsHealthTarget = 100;
  private wsHealthUpdatedAt = 0;
  private warnedMissingJwt = false;

  private getAccountAddressForQueries(): string {
    return this.config.predictAccountAddress || this.wallet.address;
  }

  private getPredictSafetyConfig() {
    return {
      maxSpread: this.config.predictSafeMaxSpread ?? PredictMarketMakerBot.PREDICT_SAFE_MAX_SPREAD,
      minL1Notional: this.config.predictSafeMinL1Notional ?? PredictMarketMakerBot.PREDICT_SAFE_MIN_L1_NOTIONAL,
      minL2Notional: this.config.predictSafeMinL2Notional ?? PredictMarketMakerBot.PREDICT_SAFE_MIN_L2_NOTIONAL,
      minPrice: this.config.predictSafeMinPrice ?? PredictMarketMakerBot.PREDICT_SAFE_MIN_PRICE,
      maxPrice: this.config.predictSafeMaxPrice ?? PredictMarketMakerBot.PREDICT_SAFE_MAX_PRICE,
      maxLevelGap: this.config.predictSafeMaxLevelGap ?? PredictMarketMakerBot.PREDICT_SAFE_MAX_LEVEL_GAP,
      minL2ToL1Ratio:
        this.config.predictSafeMinL2ToL1Ratio ?? PredictMarketMakerBot.PREDICT_SAFE_MIN_L2_TO_L1_RATIO,
    };
  }

  constructor() {
    // Load configuration
    this.config = loadConfig();
    printConfig(this.config);

    // Initialize wallet
    this.wallet = new Wallet(this.config.privateKey);
    console.log(`🔐 Wallet: ${this.wallet.address}\n`);
    if (this.config.predictAccountAddress) {
      console.log(`🏦 Predict Account (query target): ${this.config.predictAccountAddress}\n`);
    }

    // Initialize API client
    this.api = new PredictAPI(this.config.apiBaseUrl, this.config.apiKey, this.config.jwtToken);

    // Initialize market selector
    this.marketSelector = new MarketSelector(
      0, // minLiquidity
      0, // minVolume24h
      this.getPredictSafetyConfig().maxSpread, // maxSpread
      0 // minOrders
    );

    // Initialize market maker
    this.marketMaker = new MarketMaker(this.api, this.config);
  }

  /**
   * Initialize the bot
   */
  async initialize(): Promise<void> {
    const initStart = Date.now();
    console.log('🚀 Initializing Predict.fun Market Maker Bot...\n');

    // Test API connection
    const connected = await this.api.testConnection();
    if (!connected) {
      throw new Error('Failed to connect to Predict.fun API');
    }

    // Auto-fetch JWT if missing
    if (!this.config.jwtToken) {
      console.log('⚠️  JWT_TOKEN 未配置，尝试自动获取...');
      const fetchedToken = await autoFetchJwt(this.config);
      if (fetchedToken) {
        // Update config and recreate API client with JWT
        (this.config as any).jwtToken = fetchedToken;
        this.api = new PredictAPI(this.config.apiBaseUrl, this.config.apiKey, fetchedToken);
        this.marketMaker = new MarketMaker(this.api, this.config);
      } else {
        console.log('⚠️  JWT 获取失败，将只能使用公共接口（无法下单）');
        console.log('   手动获取: npm run auth:jwt');
      }
    }

    // Select markets to trade
    await this.selectMarkets();

    await this.marketMaker.initialize();
    this.setupMarketWs();

    // Update initial state (private endpoint requires JWT)
    if (this.config.jwtToken) {
      await this.marketMaker.updateState(this.getAccountAddressForQueries());
    } else if (!this.warnedMissingJwt) {
      console.log('⚠️  JWT_TOKEN missing, skip orders/positions sync');
      this.warnedMissingJwt = true;
    }

    console.log(`✅ Initialization complete (${((Date.now() - initStart) / 1000).toFixed(1)}s)\n`);
  }

  /**
   * Select markets to trade
   */
  async selectMarkets(): Promise<void> {
    console.log('🔍 Scanning markets...\n');

    const allMarkets = await this.api.getMarkets({ status: 'OPEN' });

    // Apply manual liquidity activation rules from config
    const marketsWithRules = applyLiquidityRules(allMarkets);
    const rulesApplied = marketsWithRules.filter((m) => m.liquidity_activation?.active).length;
    if (rulesApplied > 0) {
      console.log(`✅ Applied liquidity rules to ${rulesApplied} market(s)\n`);
    }

    const prioritizedMarkets = new Map<string, Market>();
    if (this.config.marketTokenIds && this.config.marketTokenIds.length > 0) {
      for (const tokenId of this.config.marketTokenIds) {
        const matched = marketsWithRules.find((m) => String(m.token_id) === String(tokenId));
        if (matched) {
          prioritizedMarkets.set(matched.token_id, matched);
        }
      }
    }
    for (const market of sortMarketsByLiquidityAndVolume(marketsWithRules)) {
      prioritizedMarkets.set(market.token_id, market);
    }

    const orderbookCandidates = Array.from(prioritizedMarkets.values()).slice(
      0,
      Math.max(36, (this.config.marketTokenIds?.length || 0) * 12)
    );
    const orderbooks = await populateOrderbooksWithConcurrency(
      orderbookCandidates,
      3,
      async (tokenId) => this.api.getOrderbook(tokenId)
    );
    console.log(`📘 Predict orderbooks fetched: ${orderbooks.size}/${orderbookCandidates.length}`);

    // Score and select markets
    let scoredMarkets = this.marketSelector.selectMarkets(marketsWithRules, orderbooks);
    if (scoredMarkets.length === 0 && orderbooks.size > 0) {
      const relaxedSelector = new MarketSelector(0, 0, this.getPredictSafetyConfig().maxSpread, 0);
      const relaxed = relaxedSelector.selectMarkets(marketsWithRules, orderbooks);
      if (relaxed.length > 0) {
        console.log(`ℹ️  Strict selector returned 0, fallback to relaxed selector (${relaxed.length})`);
        scoredMarkets = relaxed;
      }
    }
    if (scoredMarkets.length === 0 && orderbooks.size > 0) {
      scoredMarkets = marketsWithRules
        .filter((market) => orderbooks.has(market.token_id))
        .map((market) => {
          const orderbook = orderbooks.get(market.token_id)!;
          const l1Bid = Number(orderbook.best_bid || 0);
          const l1Ask = Number(orderbook.best_ask || 0);
          const spreadPenalty =
            l1Bid > 0 && l1Ask > 0 && Number.isFinite(orderbook.spread_pct ?? 0) ? Math.max(0, orderbook.spread_pct ?? 0) : 1;
          return {
            market,
            score:
              Number(market.liquidity_24h || 0) * 0.2 +
              Number(market.volume_24h || 0) * 0.05 +
              (l1Bid + l1Ask) * 100 -
              spreadPenalty * 50,
            reasons: ['Predict fallback: official orderbook available'],
          };
        })
        .sort((a, b) => b.score - a.score);
      if (scoredMarkets.length > 0) {
        console.log(`ℹ️  Fallback ranking enabled with ${scoredMarkets.length} markets`);
      }
    }

    // Filter by user-specified markets if provided
    if (this.config.marketTokenIds && this.config.marketTokenIds.length > 0) {
      scoredMarkets = scoredMarkets.filter((s) =>
        this.config.marketTokenIds.includes(s.market.token_id)
      );
    }

    // Print analysis
    this.marketSelector.printAnalysis(scoredMarkets);

    // Select top markets
    this.selectedMarkets = this.marketSelector.getTopMarkets(scoredMarkets, 10);
    this.marketByToken.clear();
    for (const market of this.selectedMarkets) {
      this.marketByToken.set(market.token_id, market);
    }

    console.log(`\n✅ Selected ${this.selectedMarkets.length} markets for market making\n`);
  }

  private setupMarketWs(): void {
    if (!this.config.mmWsEnabled) {
      return;
    }
    const wsUrl = this.config.predictWsUrl || 'wss://ws.predict.fun/ws';
    this.wsFeed = new PredictWebSocketFeed({
      url: wsUrl,
      apiKey: this.config.predictWsApiKey || this.config.apiKey,
      topicKey: this.config.predictWsTopicKey || 'token_id',
      staleTimeoutMs: this.config.predictWsStaleMs || 0,
      resetOnReconnect: this.config.predictWsResetOnReconnect !== false,
    });
    this.wsFeed.subscribeMarkets(this.selectedMarkets);
    this.wsDirtyUnsub = this.wsFeed.onOrderbook((tokenId) => {
      if (this.marketByToken.has(tokenId)) {
        this.wsDirtyTokens.add(tokenId);
        // v20: 防抖 — 同一token 500ms内只撤一次
        const now = Date.now();
        const lastCancel = this.wsLastCancelAt.get(tokenId) ?? 0;
        if (now - lastCancel >= 150) {  // v24: 从500ms降到150ms
          this.wsLastCancelAt.set(tokenId, now);
          this.marketMaker.cancelOrdersForMarket(tokenId).catch((e) => {
            console.warn(`⚠️ WS cancel-on-dirty失败(${tokenId.slice(0,8)}): ${e instanceof Error ? e.message : String(e)}`);
          });
        }
        // v16 FIX: 也撤YES/NO子token的订单，WS可能推送的是父token但挂单在子token上
        const market = this.marketByToken.get(tokenId);
        if (market?.outcomes) {
          for (const outcome of market.outcomes) {
            if (outcome.onChainId && outcome.onChainId !== tokenId) {
              const subLastCancel = this.wsLastCancelAt.get(outcome.onChainId) ?? 0;
              if (now - subLastCancel >= 500) {
                this.wsLastCancelAt.set(outcome.onChainId, now);
                this.marketMaker.cancelOrdersForMarket(outcome.onChainId).catch(() => {});
              }
            }
          }
        }
      }
    });
    this.wsFeed.start();
    console.log(`📡 Market Maker WS enabled (${wsUrl}) — cancel-on-dirty active`);
  }

  private resolveMmWsMaxAgeMs(): number {
    const explicit = Number(this.config.mmWsMaxAgeMs || 0);
    if (explicit > 0) {
      return explicit;
    }
    const fallback = Number(this.config.predictWsStaleMs || 0);
    if (fallback > 0) {
      return fallback;
    }
    return 5000;
  }

  private updateWsHealth(): void {
    if (!this.config.mmWsEnabled || !this.wsFeed) {
      this.wsHealthScore = 100;
      this.wsHealthTarget = 100;
      this.wsHealthUpdatedAt = Date.now();
      this.marketMaker.setWsHealthScore(100);
      return;
    }
    const status = this.wsFeed.getStatus();
    const maxAge = this.resolveMmWsMaxAgeMs();
    if (!status.connected || !status.lastMessageAt) {
      this.wsHealthTarget = 0;
    } else {
      const age = Math.max(0, Date.now() - status.lastMessageAt);
      if (maxAge <= 0) {
        this.wsHealthTarget = 100;
      } else {
        const ratio = Math.min(1, age / maxAge);
        this.wsHealthTarget = Math.max(0, Math.round(100 * (1 - ratio)));
      }
    }
    const now = Date.now();
    if (!this.wsHealthUpdatedAt) {
      this.wsHealthScore = this.wsHealthTarget;
    } else if (this.wsHealthTarget < this.wsHealthScore) {
      this.wsHealthScore = this.wsHealthTarget;
    } else if (this.wsHealthTarget > this.wsHealthScore) {
      const recoverMs = Math.max(0, Number(this.config.mmWsHealthRecoverMs || 0));
      if (recoverMs <= 0) {
        this.wsHealthScore = this.wsHealthTarget;
      } else {
        const elapsed = Math.max(1, now - this.wsHealthUpdatedAt);
        const step = Math.min(1, elapsed / recoverMs);
        this.wsHealthScore = this.wsHealthScore + (this.wsHealthTarget - this.wsHealthScore) * step;
      }
    }
    this.wsHealthUpdatedAt = now;
    this.marketMaker.setWsHealthScore(Math.round(this.wsHealthScore));
  }

  private isOrderbookValid(orderbook: Orderbook | null | undefined): boolean {
    if (!orderbook) {
      return false;
    }
    const bestBid = orderbook.best_bid ?? 0;
    const bestAsk = orderbook.best_ask ?? 0;
    if (!Number.isFinite(bestBid) || !Number.isFinite(bestAsk)) {
      return false;
    }
    if (bestBid <= 0 || bestAsk <= 0 || bestBid >= bestAsk) {
      return false;
    }
    const maxSpread =
      this.config.mmVenue === 'predict' ? this.getPredictSafetyConfig().maxSpread : 0.2;
    if (bestAsk - bestBid > maxSpread) {
      return false;
    }
    if (this.config.mmVenue === 'predict') {
      const safety = this.getPredictSafetyConfig();
      const mid = Number(orderbook.mid_price ?? (bestBid + bestAsk) / 2);
      if (
        !Number.isFinite(mid) ||
        mid < safety.minPrice ||
        mid > safety.maxPrice
      ) {
        return false;
      }
      const bid1 = this.getLevelNotional(orderbook.bids, 0, 'bids');
      const ask1 = this.getLevelNotional(orderbook.asks, 0, 'asks');
      const bid2 = this.getLevelNotional(orderbook.bids, 1, 'bids');
      const ask2 = this.getLevelNotional(orderbook.asks, 1, 'asks');
      if (
        Math.min(bid1, ask1) < safety.minL1Notional ||
        Math.min(bid2, ask2) < safety.minL2Notional
      ) {
        return false;
      }
      if (
        this.getSupportRatio(orderbook.bids, 'bids') < safety.minL2ToL1Ratio ||
        this.getSupportRatio(orderbook.asks, 'asks') < safety.minL2ToL1Ratio
      ) {
        return false;
      }
      const bidGap = this.getLevelGap(orderbook.bids, 'bids');
      const askGap = this.getLevelGap(orderbook.asks, 'asks');
      if (
        bidGap > safety.maxLevelGap ||
        askGap > safety.maxLevelGap
      ) {
        return false;
      }
    }
    return true;
  }

  private getLevelNotional(levels: any[] | undefined, index: number, side: 'bids' | 'asks'): number {
    if (!Array.isArray(levels) || levels.length <= index) {
      return 0;
    }
    const sorted = [...levels].sort((a, b) => {
      const ap = Number(a?.price || 0);
      const bp = Number(b?.price || 0);
      return side === 'bids' ? bp - ap : ap - bp;
    });
    const level = sorted[index];
    const price = Number(level?.price || 0);
    const shares = Number(level?.shares || 0);
    if (!Number.isFinite(price) || !Number.isFinite(shares) || price <= 0 || shares <= 0) {
      return 0;
    }
    return price * shares;
  }

  private getLevelGap(levels: any[] | undefined, side: 'bids' | 'asks'): number {
    if (!Array.isArray(levels) || levels.length < 2) {
      return Number.POSITIVE_INFINITY;
    }
    const sorted = [...levels].sort((a, b) => {
      const ap = Number(a?.price || 0);
      const bp = Number(b?.price || 0);
      return side === 'bids' ? bp - ap : ap - bp;
    });
    const first = Number(sorted[0]?.price || 0);
    const second = Number(sorted[1]?.price || 0);
    if (!Number.isFinite(first) || !Number.isFinite(second) || first <= 0 || second <= 0) {
      return Number.POSITIVE_INFINITY;
    }
    return side === 'bids' ? first - second : second - first;
  }

  private getSupportRatio(levels: any[] | undefined, side: 'bids' | 'asks'): number {
    if (!Array.isArray(levels) || levels.length < 2) {
      return 0;
    }
    const sorted = [...levels].sort((a, b) => {
      const ap = Number(a?.price || 0);
      const bp = Number(b?.price || 0);
      return side === 'bids' ? bp - ap : ap - bp;
    });
    const first = Number(sorted[0]?.shares || 0);
    const second = Number(sorted[1]?.shares || 0);
    if (!Number.isFinite(first) || !Number.isFinite(second) || first <= 0 || second <= 0) {
      return 0;
    }
    return second / first;
  }

  private async getOrderbookForMarket(market: Market): Promise<Orderbook | null> {
    if (this.wsFeed && this.config.mmWsEnabled) {
      const gapUntil = this.wsGapUntil.get(market.token_id) || 0;
      if (gapUntil && Date.now() < gapUntil) {
        if (this.config.mmWsFallbackRest !== false) {
          return await this.api.getOrderbook(market.token_id);
        }
        return null;
      }
      const maxAge = this.resolveMmWsMaxAgeMs();
      const cached = this.wsFeed.getOrderbook(market.token_id, maxAge);
      if (cached && this.isOrderbookValid(cached)) {
        this.wsBadCount.delete(market.token_id);
        return cached;
      }
      if (cached) {
        const bad = (this.wsBadCount.get(market.token_id) || 0) + 1;
        this.wsBadCount.set(market.token_id, bad);
        const maxBad = Math.max(0, Number(this.config.mmWsGapMax || 0));
        if (maxBad > 0 && bad >= maxBad) {
          const cooldown = Math.max(0, Number(this.config.mmWsGapCooldownMs || 0));
          if (cooldown > 0) {
            this.wsGapUntil.set(market.token_id, Date.now() + cooldown);
          }
          this.wsBadCount.delete(market.token_id);
          if (this.config.mmWsGapReconnect && this.wsFeed) {
            this.wsFeed.stop();
            this.wsFeed.start();
          }
        }
      }
      if (this.config.mmWsFallbackRest !== false) {
        const minInterval = Math.max(0, Number(this.config.mmWsFallbackMinIntervalMs || 0));
        const last = this.wsFallbackAt.get(market.token_id) || 0;
        if (minInterval > 0 && Date.now() - last < minInterval) {
          return null;
        }
        this.wsFallbackAt.set(market.token_id, Date.now());
        const restBook = await this.api.getOrderbook(market.token_id);
        return this.isOrderbookValid(restBook) ? restBook : null;
      }
      return null;
    }
    const restBook = await this.api.getOrderbook(market.token_id);
    return this.isOrderbookValid(restBook) ? restBook : null;
  }

  private drainDirtyMarkets(): Market[] {
    if (!this.config.mmWsOnlyDirty || !this.config.mmWsEnabled) {
      return this.selectedMarkets;
    }
    if (this.wsDirtyTokens.size === 0) {
      return [];
    }
    const maxBatch = Math.max(0, Number(this.config.mmWsDirtyMaxBatch || 0));
    const tokens = Array.from(this.wsDirtyTokens);
    const batch = maxBatch > 0 ? tokens.slice(0, maxBatch) : tokens;
    for (const token of batch) {
      this.wsDirtyTokens.delete(token);
    }
    return batch
      .map((tokenId) => this.marketByToken.get(tokenId))
      .filter((market): market is Market => Boolean(market));
  }

  private getLoopSleepMs(): number {
    if (!this.config.mmWsOnlyDirty) {
      return this.config.refreshInterval;
    }
    const idle = Math.max(50, Number(this.config.mmWsIdleSleepMs || 0));
    return idle > 0 ? idle : Math.min(200, this.config.refreshInterval);
  }

  /**
   * Main trading loop
   */
  async run(): Promise<void> {
    this.running = true;

    console.log('🎯 Starting market making loop...\n');

    while (this.running) {
      try {
        // 紧急撤单检查（APP一键全撤信号）
        const cancelFlagPath = path.join(process.cwd(), 'emergency-cancel.flag');
        if (fs.existsSync(cancelFlagPath)) {
          console.log('🚨 检测到紧急撤单信号，执行撤单...');
          try {
            await this.marketMaker.cancelAllOpenOrders();
            console.log('✅ 紧急撤单完成');
          } catch (e) {
            console.error('❌ 紧急撤单失败:', e);
          }
          fs.unlinkSync(cancelFlagPath);
        }

        this.updateWsHealth();
        // 维护 WebSocket 健康状态（自动恢复）
        this.marketMaker.maintainWsHealth();
        // Update state (private endpoint requires JWT) — 每30秒同步一次，避免API过于频繁
        if (this.config.jwtToken) {
          const now = Date.now();
          if (now - this.lastStateUpdate > 30_000) {
            await this.marketMaker.updateState(this.getAccountAddressForQueries());
            this.lastStateUpdate = now;
          }
        }

        const marketsToProcess = this.drainDirtyMarkets();
        if (marketsToProcess.length === 0) {
          await this.sleep(this.getLoopSleepMs());
          continue;
        }

        // Process each market
        for (const market of marketsToProcess) {
          try {
            // Fetch latest orderbook (WS preferred when enabled)
            const orderbook = await this.getOrderbookForMarket(market);
            if (!orderbook) {
              continue;
            }

            // Place/cancel orders as needed
            await this.marketMaker.placeMMOrders(market, orderbook);
          } catch (error) {
            console.error(`Error processing market ${market.token_id}:`, error instanceof Error ? error.message : error);
          }
        }

        // 成功处理一轮后重置错误计数
        this.consecutiveLoopErrors = 0;

        // Print status
        this.marketMaker.printStatus();

        // Wait for next iteration
        await this.sleep(this.getLoopSleepMs());
      } catch (error) {
        this.consecutiveLoopErrors++;
        // 指数退避：连续错误时逐步增大等待时间（最多60秒）
        const backoff = Math.min(60_000, this.getLoopSleepMs() * Math.pow(2, Math.min(this.consecutiveLoopErrors, 6)));
        console.error(`Error in main loop (x${this.consecutiveLoopErrors}, ${Math.round(backoff/1000)}s backoff):`, error instanceof Error ? error.message : error);
        await this.sleep(backoff);
      }
    }
  }

  /**
   * Start the bot
   */
  async start(): Promise<void> {
    if (this.running) {
      throw new Error('Bot is already running');
    }
    await this.run();
    // 启动状态快照定时器
    if (this.marketMaker) {
      const { startSnapshotTimer } = await import('./utils/snapshot.js');
      startSnapshotTimer(this.marketMaker);
    }
  }

  /**
   * Stop the bot
   */
  async stop(): Promise<void> {
    console.log('\n\ud83d\uded1 Stopping bot...');
    this.running = false;

    // P1 FIX: 撤销所有挂单 — 等待完成再退出，否则订单会一直挂在盘口
    try {
      if (this.marketMaker && typeof this.marketMaker.cancelAllOpenOrders === 'function') {
        await this.marketMaker.cancelAllOpenOrders();
        console.log('✅ 所有挂单已撤销');
      }
    } catch (e) {
      console.error('⚠️ 停止时撤单异常:', e instanceof Error ? e.message : String(e));
    }

    if (this.wsDirtyUnsub) {
      this.wsDirtyUnsub();
      this.wsDirtyUnsub = undefined;
    }
    if (this.wsFeed) {
      this.wsFeed.stop();
      this.wsFeed = undefined;
    }
    // 停止状态快照定时器
    const { stopSnapshotTimer } = await import('./utils/snapshot.js');
    stopSnapshotTimer();
  }

  /**
   * Get selected markets count
   */
  getSelectedMarketsCount(): number {
    return this.selectedMarkets.length;
  }

  /**
   * Get live status from MarketMaker
   */
  getStatus() {
    return {
      openOrders: this.marketMaker?.getOpenOrdersCount() ?? 0,
      positions: this.marketMaker?.getPositionCount() ?? 0,
      sessionPnL: this.marketMaker?.getSessionPnL() ?? 0,
      markets: this.selectedMarkets.length,
    };
  }

  /**
   * Check if bot is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Polymarket 做市
export class PolymarketMarketMakerBot {
  private static readonly POLYMARKET_REWARD_MIN_FIT_SCORE = 0.6;
  private static readonly POLYMARKET_REWARD_MIN_DAILY_RATE = 0;
  private static readonly POLYMARKET_REWARD_PAUSE_MS = 3 * 60 * 1000;
  private api: PolymarketAPI;
  private marketSelector: MarketSelector;
  private marketMaker: MarketMaker;
  private config: any;
  private wallet: Wallet;
  private running = false;
  private selectedMarkets: Market[] = [];
  private marketByToken: Map<string, Market> = new Map();
  private wsFeed?: PolymarketWebSocketFeed;
  private wsDirtyTokens: Set<string> = new Set();
  private wsDirtyUnsub?: () => void;
  private wsLastCancelAt: Map<string, number> = new Map();
  private wsHealthScore = 100;
  private wsHealthTarget = 100;
  private wsHealthUpdatedAt = 0;
  private warnedStatusSync = false;
  private rewardPauseUntil: Map<string, number> = new Map();
  private lastStateUpdate = 0;
  private consecutiveLoopErrors = 0;

  private getAccountAddressForQueries(): string {
    return this.config.polymarketFunderAddress || this.wallet.address;
  }

  private getPolymarketSafetyConfig() {
    return {
      rewardMinFitScore:
        this.config.polymarketRewardMinFitScore ?? PolymarketMarketMakerBot.POLYMARKET_REWARD_MIN_FIT_SCORE,
      rewardMinDailyRate:
        this.config.polymarketRewardMinDailyRate ?? PolymarketMarketMakerBot.POLYMARKET_REWARD_MIN_DAILY_RATE,
      rewardMinEfficiency: this.config.polymarketRewardMinEfficiency ?? 0.0015,
      rewardMinNetEfficiency: this.config.polymarketRewardMinNetEfficiency ?? 0.0008,
      rewardNetCostBpsMultiplier: this.config.polymarketRewardNetCostBpsMultiplier ?? 1,
      rewardRequireFit: this.config.polymarketRewardRequireFit !== false,
      rewardRequireEnabled: this.config.polymarketRewardRequireEnabled === true,
      rewardMaxQueueMultiple: this.config.polymarketRewardMaxQueueMultiple ?? 12,
      rewardCrowdingPenaltyStart: this.config.polymarketRewardCrowdingPenaltyStart ?? 4,
      rewardCrowdingPenaltyMax: this.config.polymarketRewardCrowdingPenaltyMax ?? 12,
      rewardMinQueueHours: this.config.polymarketRewardMinQueueHours ?? 0.75,
      rewardFastFlowPenaltyMax: this.config.polymarketRewardFastFlowPenaltyMax ?? 8,
      rewardTargetQueueHours: this.config.polymarketRewardTargetQueueHours ?? 1.5,
      rewardTargetQueueTolerance: this.config.polymarketRewardTargetQueueTolerance ?? 0.5,
      rewardTargetPenaltyMax: this.config.polymarketRewardTargetPenaltyMax ?? 6,
      observedQueueMinSamples: this.config.polymarketObservedQueueMinSamples ?? 3,
      observedQueueMaxWeight: this.config.polymarketObservedQueueMaxWeight ?? 0.65,
      recentRiskBlockPenalty: this.config.polymarketRecentRiskBlockPenalty ?? 12,
      patternMemoryMaxPenalty: this.config.polymarketPatternMemoryMaxPenalty ?? 8,
      patternMemoryBlockPenalty: this.config.polymarketPatternMemoryBlockPenalty ?? 6,
      patternMemoryTtlMs: this.config.polymarketPatternMemoryTtlMs ?? 7 * 24 * 60 * 60 * 1000,
      hourRiskPenaltyMax: this.config.polymarketHourRiskPenaltyMax ?? 8,
      hourRiskBlockPenalty: this.config.polymarketHourRiskBlockPenalty ?? 6,
      hourRiskLookbackDays: this.config.polymarketHourRiskLookbackDays ?? 7,
      hourRiskSizeFactorMin: this.config.polymarketHourRiskSizeFactorMin ?? 0.55,
      eventRiskPenaltyWithinMs: this.config.polymarketEventRiskPenaltyWithinMs ?? 4 * 60 * 60 * 1000,
      eventRiskBlockWithinMs: this.config.polymarketEventRiskBlockWithinMs ?? 30 * 60 * 1000,
      eventRiskPenaltyMax: this.config.polymarketEventRiskPenaltyMax ?? 6,
      eventRiskSizeFactorMin: this.config.polymarketEventRiskSizeFactorMin ?? 0.45,
      eventRiskRetreatMaxBps: this.config.polymarketEventRiskRetreatMaxBps ?? 10,
      catalystRiskPenaltyWithinMs: this.config.polymarketCatalystRiskPenaltyWithinMs ?? 90 * 60 * 1000,
      catalystRiskBlockWithinMs: this.config.polymarketCatalystRiskBlockWithinMs ?? 10 * 60 * 1000,
      catalystRiskPenaltyMax: this.config.polymarketCatalystRiskPenaltyMax ?? 7,
      catalystRiskSizeFactorMin: this.config.polymarketCatalystRiskSizeFactorMin ?? 0.35,
      catalystRiskRetreatMaxBps: this.config.polymarketCatalystRiskRetreatMaxBps ?? 14,
      groupMaxExposureFactor: this.config.polymarketGroupMaxExposureFactor ?? 1.4,
      groupSoftExposureStart: this.config.polymarketGroupSoftExposureStart ?? 0.7,
      groupSizeFactorMin: this.config.polymarketGroupSizeFactorMin ?? 0.55,
      groupRetreatMaxBps: this.config.polymarketGroupRetreatMaxBps ?? 12,
      themeMaxExposureFactor: this.config.polymarketThemeMaxExposureFactor ?? 2.2,
      themeSoftExposureStart: this.config.polymarketThemeSoftExposureStart ?? 0.65,
      themeSizeFactorMin: this.config.polymarketThemeSizeFactorMin ?? 0.5,
      themeRetreatMaxBps: this.config.polymarketThemeRetreatMaxBps ?? 10,
      rewardPauseMs: this.config.polymarketRewardPauseMs ?? PolymarketMarketMakerBot.POLYMARKET_REWARD_PAUSE_MS,
    };
  }

  private isRewardPaused(tokenId: string): boolean {
    return (this.rewardPauseUntil.get(tokenId) ?? 0) > Date.now();
  }

  private async pauseRewardMarket(tokenId: string, reason: string): Promise<void> {
    const pauseMs = Math.max(1000, Number(this.getPolymarketSafetyConfig().rewardPauseMs || 0));
    this.rewardPauseUntil.set(tokenId, Date.now() + pauseMs);
    await this.marketMaker.enforceMarketPause(tokenId, pauseMs, reason, 'polymarket-reward-gate', true);
    console.log(`⏸️ Polymarket 奖励门禁暂停 ${tokenId.slice(0, 8)} ${Math.round(pauseMs / 1000)}s: ${reason}`);
  }

  private getPolymarketSelectorOptions() {
    const safety = this.getPolymarketSafetyConfig();
    const recentRiskPenalty = loadRecentPolymarketRiskPenalty(
      this.config.mmMetricsPath,
      process.cwd(),
      {
        rewardPauseMs: this.config.polymarketRewardPauseMs ?? PolymarketMarketMakerBot.POLYMARKET_REWARD_PAUSE_MS,
        postOnlyPauseMs: this.config.polymarketPostOnlyPauseMs ?? 30 * 60 * 1000,
        adverseFillPauseMs: this.config.polymarketAdverseFillPauseMs ?? 45 * 60 * 1000,
        positionLossPauseMs: this.config.polymarketPositionLossPauseMs ?? 30 * 60 * 1000,
      },
      {
        cancelRatePenaltyStart: this.config.polymarketCancelRatePenaltyStart ?? 0.8,
        cancelRatePenaltyMax: this.config.polymarketCancelRatePenaltyMax ?? 6,
        minAvgOrderLifetimeMs: this.config.polymarketMinAvgOrderLifetimeMs ?? 120000,
        shortLifetimePenaltyMax: this.config.polymarketShortLifetimePenaltyMax ?? 5,
      }
    );
    const patternMemoryPenalty = loadPolymarketPatternMemory(
      this.config.mmMetricsPath,
      process.cwd(),
      safety.patternMemoryTtlMs,
      safety.patternMemoryMaxPenalty
    );
    const observedQueueStats = loadPolymarketObservedQueueStats(this.config.mmMetricsPath, process.cwd());
    const hourRiskPenalty = loadPolymarketHourRiskPenalty(
      this.config.mmMetricsPath,
      process.cwd(),
      safety.hourRiskLookbackDays,
      safety.hourRiskPenaltyMax
    );
    const hourlyMarketRiskPenalty = loadPolymarketHourlyMarketRisk(
      this.config.mmMetricsPath,
      process.cwd(),
      safety.hourRiskLookbackDays,
      safety.hourRiskPenaltyMax
    );
    return {
      polymarketRewardMinFitScore: safety.rewardMinFitScore,
      polymarketRewardMinDailyRate: safety.rewardMinDailyRate,
      polymarketRewardMinEfficiency: safety.rewardMinEfficiency,
      polymarketRewardMinNetEfficiency: safety.rewardMinNetEfficiency,
      polymarketRewardNetCostBpsMultiplier: safety.rewardNetCostBpsMultiplier,
      polymarketRewardRequireFit: safety.rewardRequireFit,
      polymarketRewardRequireEnabled: safety.rewardRequireEnabled,
      polymarketRewardMaxQueueMultiple: safety.rewardMaxQueueMultiple,
      polymarketRewardCrowdingPenaltyStart: safety.rewardCrowdingPenaltyStart,
      polymarketRewardCrowdingPenaltyMax: safety.rewardCrowdingPenaltyMax,
      polymarketRewardMinQueueHours: safety.rewardMinQueueHours,
      polymarketRewardFastFlowPenaltyMax: safety.rewardFastFlowPenaltyMax,
      polymarketRewardTargetQueueHours: safety.rewardTargetQueueHours,
      polymarketRewardTargetQueueTolerance: safety.rewardTargetQueueTolerance,
      polymarketRewardTargetPenaltyMax: safety.rewardTargetPenaltyMax,
      polymarketObservedQueueStats: observedQueueStats,
      polymarketObservedQueueMinSamples: safety.observedQueueMinSamples,
      polymarketObservedQueueMaxWeight: safety.observedQueueMaxWeight,
      polymarketRecentRiskBlockPenalty: safety.recentRiskBlockPenalty,
      polymarketRecentRiskPenalty: recentRiskPenalty,
      polymarketPatternMemoryPenalty: patternMemoryPenalty,
      polymarketPatternMemoryBlockPenalty: safety.patternMemoryBlockPenalty,
      polymarketHourRiskPenalty: hourRiskPenalty,
      polymarketHourlyMarketRiskPenalty: hourlyMarketRiskPenalty,
      polymarketHourRiskBlockPenalty: safety.hourRiskBlockPenalty,
      polymarketHourRiskSizeFactorMin: safety.hourRiskSizeFactorMin,
      polymarketEventRiskPenaltyWithinMs: safety.eventRiskPenaltyWithinMs,
      polymarketEventRiskBlockWithinMs: safety.eventRiskBlockWithinMs,
      polymarketEventRiskPenaltyMax: safety.eventRiskPenaltyMax,
      polymarketEventRiskSizeFactorMin: safety.eventRiskSizeFactorMin,
      polymarketCatalystRiskPenaltyWithinMs: safety.catalystRiskPenaltyWithinMs,
      polymarketCatalystRiskBlockWithinMs: safety.catalystRiskBlockWithinMs,
      polymarketCatalystRiskPenaltyMax: safety.catalystRiskPenaltyMax,
      polymarketCatalystRiskSizeFactorMin: safety.catalystRiskSizeFactorMin,
    };
  }

  private evaluateRewardGate(market: Market, orderbook: Orderbook): { skip: boolean; reason?: string } {
    const safety = this.getPolymarketSafetyConfig();
    if (market.polymarket_enable_order_book === false) {
      return { skip: true, reason: 'orderbook 未启用' };
    }
    if (market.polymarket_accepting_orders === false) {
      return { skip: true, reason: '市场当前不接受下单' };
    }
    const eventRisk = evaluatePolymarketEventRisk(market, {
      penaltyWithinMs: safety.eventRiskPenaltyWithinMs,
      blockWithinMs: safety.eventRiskBlockWithinMs,
      penaltyMax: safety.eventRiskPenaltyMax,
      sizeFactorMin: safety.eventRiskSizeFactorMin,
      catalystPenaltyWithinMs: safety.catalystRiskPenaltyWithinMs,
      catalystBlockWithinMs: safety.catalystRiskBlockWithinMs,
      catalystPenaltyMax: safety.catalystRiskPenaltyMax,
      catalystSizeFactorMin: safety.catalystRiskSizeFactorMin,
    });
    if (eventRisk.block) {
      return { skip: true, reason: eventRisk.reason || '临近事件窗口，暂不做市' };
    }
    const profile = this.marketSelector.evaluatePolymarketRewardFit(market, orderbook);
    if (safety.rewardRequireEnabled && !profile.enabled) {
      return { skip: true, reason: '无流动性激励' };
    }
    if (profile.enabled && profile.dailyRate < safety.rewardMinDailyRate) {
      return { skip: true, reason: `激励日速率不足 ${profile.dailyRate.toFixed(0)}` };
    }
    if (profile.enabled && profile.efficiency < safety.rewardMinEfficiency) {
      return { skip: true, reason: `激励效率不足 ${(profile.efficiency * 100).toFixed(2)}%/日` };
    }
    if (profile.enabled && profile.effectiveNetEfficiency < safety.rewardMinNetEfficiency) {
      return { skip: true, reason: `激励有效净效率不足 ${(profile.effectiveNetEfficiency * 100).toFixed(2)}%/日` };
    }
    if (profile.enabled && safety.rewardRequireFit && profile.fitScore < safety.rewardMinFitScore) {
      return { skip: true, reason: `激励适配度不足 ${(profile.fitScore * 100).toFixed(0)}%` };
    }
    if (profile.enabled && profile.crowdingMultiple > safety.rewardMaxQueueMultiple) {
      return { skip: true, reason: `奖励队列过厚 ${profile.crowdingMultiple.toFixed(1)}x` };
    }
    if (profile.enabled && profile.targetQueueFactor < 0.3) {
      return { skip: true, reason: profile.targetQueueReason || '目标排队位置偏离过大' };
    }
    const hourRisk = loadPolymarketHourRiskPenalty(
      this.config.mmMetricsPath,
      process.cwd(),
      safety.hourRiskLookbackDays,
      safety.hourRiskPenaltyMax
    );
    if (hourRisk.penalty >= safety.hourRiskBlockPenalty) {
      return { skip: true, reason: hourRisk.reason };
    }
    const hourlyMarketRisk = loadPolymarketHourlyMarketRisk(
      this.config.mmMetricsPath,
      process.cwd(),
      safety.hourRiskLookbackDays,
      safety.hourRiskPenaltyMax
    ).get(market.token_id);
    if ((hourlyMarketRisk?.penalty || 0) >= safety.hourRiskBlockPenalty) {
      return { skip: true, reason: hourlyMarketRisk?.reason || '该市场当前时段风险过高' };
    }
    return { skip: false };
  }

  private async runPolymarketPreflight(): Promise<void> {
    const signatureType = Number(this.config.polymarketSignatureType ?? 0);
    const explicitFunder = String(this.config.polymarketFunderAddress || '').trim();
    const signer = this.wallet.address;
    const queryAddress = this.getAccountAddressForQueries();
    const orderType = String(this.config.crossPlatformOrderType || 'GTC').toUpperCase();
    const liveMode = this.config.enableTrading === true;

    if (liveMode && !['GTC', 'GTD'].includes(orderType)) {
      throw new Error(`Polymarket 做市要求 resting order type，当前 CROSS_PLATFORM_ORDER_TYPE=${orderType}`);
    }
    if (liveMode && signatureType !== 0 && !explicitFunder) {
      throw new Error('POLYMARKET_FUNDER_ADDRESS is required when POLYMARKET_SIGNATURE_TYPE is non-zero');
    }
    if (liveMode && signatureType === 0 && explicitFunder && explicitFunder.toLowerCase() !== signer.toLowerCase()) {
      throw new Error('EOA 签名模式下，POLYMARKET_FUNDER_ADDRESS 必须与 signer 地址一致');
    }
    if (signatureType !== 0 && explicitFunder && explicitFunder.toLowerCase() === signer.toLowerCase()) {
      console.log('⚠️  Polymarket 配置中 funder/profile 与 signer 相同，请确认这是预期配置');
    }

    const preflight = await this.api.runTradingPreflight(queryAddress);
    console.log(
      `🔧 Polymarket preflight: signer=${preflight.signerAddress} funder=${preflight.funderAddress} ` +
        `sigType=${preflight.signatureType} creds=${preflight.credsReady ? 'ready' : 'missing'} openOrders=${preflight.openOrderCount}`
    );
    if (liveMode && !preflight.credsReady) {
      throw new Error('Polymarket 用户 CLOB API 凭证未就绪。当前脚本不需要 Builder/Relayer key，但需要用户 API key/secret/passphrase，或成功自动派生。请先保持 POLYMARKET_AUTO_DERIVE_API_KEY=true 并执行 Polymarket 预检；若仍失败，再按官方认证文档填写 POLYMARKET_API_KEY / POLYMARKET_API_SECRET / POLYMARKET_API_PASSPHRASE。');
    }
  }

  constructor() {
    this.config = loadConfig();
    printConfig(this.config);

    this.wallet = new Wallet(this.config.polymarketPrivateKey || this.config.privateKey);
    console.log('🔐 Wallet: ' + this.wallet.address + '\n');
    if (this.config.polymarketFunderAddress) {
      console.log('🏦 Polymarket Funder/Profile: ' + this.config.polymarketFunderAddress + '\n');
    }

    this.api = new PolymarketAPI({
      gammaUrl: this.config.polymarketGammaUrl || 'https://gamma-api.polymarket.com',
      clobUrl: this.config.polymarketClobUrl || 'https://clob.polymarket.com',
      privateKey: this.config.polymarketPrivateKey || this.config.privateKey,
      chainId: this.config.polymarketChainId || 137,
      maxMarkets: this.config.polymarketMaxMarkets || 60,
      feeBps: this.config.polymarketFeeBps || 0,
      apiKey: this.config.polymarketApiKey,
      apiSecret: this.config.polymarketApiSecret,
      apiPassphrase: this.config.polymarketApiPassphrase,
      autoDeriveApiKey: this.config.polymarketAutoDeriveApiKey !== false,
      funderAddress: this.config.polymarketFunderAddress || this.wallet.address,
      signatureType: this.config.polymarketSignatureType || 0,
    });

    this.marketSelector = new MarketSelector(0, 0, 0.12, 0, this.getPolymarketSelectorOptions());
    this.marketMaker = new MarketMaker(this.api, this.config, async () => {
      return new PolymarketOrderManager({
        clobUrl: this.config.polymarketClobUrl || 'https://clob.polymarket.com',
        chainId: this.config.polymarketChainId || 137,
        privateKey: this.config.polymarketPrivateKey || this.config.privateKey,
        orderType: this.config.crossPlatformOrderType || 'GTC',
        funderAddress: this.config.polymarketFunderAddress || this.wallet.address,
        signatureType: this.config.polymarketSignatureType || 0,
      });
    });
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Polymarket Market Maker Bot...\n');

    const connected = await this.api.testConnection();
    if (!connected) {
      throw new Error('Failed to connect to Polymarket API');
    }

    await this.runPolymarketPreflight();
    await this.selectMarkets();
    await this.marketMaker.initialize();
    this.setupMarketWs();

    if (!this.warnedStatusSync) {
      console.log('ℹ️  Polymarket 模式使用链上订单，不依赖 Predict JWT，同步基于当前 Profile/Funder 地址');
      this.warnedStatusSync = true;
    }

    console.log('✅ Initialization complete\n');
  }

  async selectMarkets(): Promise<void> {
    console.log('🔍 Scanning markets (Polymarket)...\n');

    const allMarkets = await this.api.getMarkets();
    console.log('Found ' + allMarkets.length + ' active outcome tokens\n');

    const prioritized = new Map<string, Market>();
    if (this.config.marketTokenIds && this.config.marketTokenIds.length > 0) {
      for (const tokenId of this.config.marketTokenIds) {
        const matched = allMarkets.find((market) => String(market.token_id) === String(tokenId));
        if (matched) prioritized.set(matched.token_id, matched);
      }
    }
    for (const market of sortMarketsByLiquidityAndVolume(allMarkets)) {
      prioritized.set(market.token_id, market);
    }

    const candidates = Array.from(prioritized.values()).slice(0, Math.max(48, (this.config.marketTokenIds?.length || 0) * 12));
    const orderbooks = await populateOrderbooksWithConcurrency(candidates, 4, async (tokenId) => this.api.getOrderbook(tokenId));
    console.log('📘 Polymarket orderbooks fetched: ' + orderbooks.size + '/' + candidates.length);

    let scoredMarkets = this.marketSelector.selectMarkets(allMarkets, orderbooks);
    if (scoredMarkets.length === 0 && orderbooks.size > 0) {
      const relaxedSelector = new MarketSelector(0, 0, 0.12, 0, this.getPolymarketSelectorOptions());
      const relaxed = relaxedSelector.selectMarkets(allMarkets, orderbooks);
      if (relaxed.length > 0) {
        console.log('ℹ️  Strict selector returned 0, fallback to relaxed selector (' + relaxed.length + ')');
        scoredMarkets = relaxed;
      }
    }

    if (this.config.marketTokenIds && this.config.marketTokenIds.length > 0) {
      scoredMarkets = scoredMarkets.filter((s) => this.config.marketTokenIds.includes(s.market.token_id));
    }

    this.marketSelector.printAnalysis(scoredMarkets);
    const topCount = Math.max(5, Math.min(20, scoredMarkets.length));
    this.selectedMarkets = this.marketSelector.getTopMarkets(scoredMarkets, topCount);
    this.marketByToken.clear();
    for (const market of this.selectedMarkets) {
      this.marketByToken.set(market.token_id, market);
    }

    console.log('\n✅ Selected ' + this.selectedMarkets.length + ' tokens for market making\n');
  }

  private setupMarketWs(): void {
    if (!this.config.mmWsEnabled || !this.config.polymarketWsEnabled) {
      return;
    }
    this.wsFeed = new PolymarketWebSocketFeed({
      url: this.config.polymarketWsUrl || 'wss://ws-subscriptions-clob.polymarket.com/ws/market',
      customFeatureEnabled: this.config.polymarketWsCustomFeature === true,
      initialDump: this.config.polymarketWsInitialDump !== false,
      staleTimeoutMs: this.config.polymarketWsStaleMs || 0,
      resetOnReconnect: this.config.polymarketWsResetOnReconnect !== false,
      reconnectMinMs: 1000,
      reconnectMaxMs: 15000,
    });
    this.wsFeed.subscribeAssets(this.selectedMarkets.map((market) => market.token_id));
    this.wsDirtyUnsub = this.wsFeed.onOrderbook((tokenId) => {
      if (this.marketByToken.has(tokenId)) {
        this.wsDirtyTokens.add(tokenId);
        // v20: 防抖 — 同一token 500ms内只撤一次
        const now = Date.now();
        const lastCancel = this.wsLastCancelAt.get(tokenId) ?? 0;
        if (now - lastCancel >= 150) {  // v24: 从500ms降到150ms
          this.wsLastCancelAt.set(tokenId, now);
          this.marketMaker.cancelOrdersForMarket(tokenId).catch((e) => {
            console.warn(`⚠️ WS cancel-on-dirty失败(${tokenId.slice(0,8)}): ${e instanceof Error ? e.message : String(e)}`);
          });
        }
        // v16 FIX: 也撤YES/NO子token的订单
        const market = this.marketByToken.get(tokenId);
        if (market?.outcomes) {
          for (const outcome of market.outcomes) {
            if (outcome.onChainId && outcome.onChainId !== tokenId) {
              const subLastCancel = this.wsLastCancelAt.get(outcome.onChainId) ?? 0;
              if (now - subLastCancel >= 500) {
                this.wsLastCancelAt.set(outcome.onChainId, now);
                this.marketMaker.cancelOrdersForMarket(outcome.onChainId).catch(() => {});
              }
            }
          }
        }
      }
    });
    this.wsFeed.start();
    console.log('📡 Polymarket WS enabled — cancel-on-dirty active');
  }

  private resolveMmWsMaxAgeMs(): number {
    const explicit = Number(this.config.mmWsMaxAgeMs || 0);
    if (explicit > 0) return explicit;
    const fallback = Number(this.config.polymarketWsStaleMs || 0);
    if (fallback > 0) return fallback;
    return 5000;
  }

  private updateWsHealth(): void {
    if (!this.config.mmWsEnabled || !this.config.polymarketWsEnabled || !this.wsFeed) {
      this.wsHealthScore = 100;
      this.wsHealthTarget = 100;
      this.wsHealthUpdatedAt = Date.now();
      this.marketMaker.setWsHealthScore(100);
      return;
    }
    const status = this.wsFeed.getStatus();
    const maxAge = this.resolveMmWsMaxAgeMs();
    if (!status.connected || !status.lastMessageAt) {
      this.wsHealthTarget = 0;
    } else {
      const age = Math.max(0, Date.now() - status.lastMessageAt);
      if (maxAge <= 0) {
        this.wsHealthTarget = 100;
      } else {
        const ratio = Math.min(1, age / maxAge);
        this.wsHealthTarget = Math.max(0, Math.round(100 * (1 - ratio)));
      }
    }
    const now = Date.now();
    if (!this.wsHealthUpdatedAt) {
      this.wsHealthScore = this.wsHealthTarget;
    } else if (this.wsHealthTarget < this.wsHealthScore) {
      this.wsHealthScore = this.wsHealthTarget;
    } else if (this.wsHealthTarget > this.wsHealthScore) {
      const recoverMs = Math.max(0, Number(this.config.mmWsHealthRecoverMs || 0));
      if (recoverMs <= 0) {
        this.wsHealthScore = this.wsHealthTarget;
      } else {
        const elapsed = Math.max(1, now - this.wsHealthUpdatedAt);
        const step = Math.min(1, elapsed / recoverMs);
        this.wsHealthScore = this.wsHealthScore + (this.wsHealthTarget - this.wsHealthScore) * step;
      }
    }
    this.wsHealthUpdatedAt = now;
    this.marketMaker.setWsHealthScore(Math.max(0, Math.min(100, Math.round(this.wsHealthScore))));
  }

  private async getOrderbookForMarket(market: Market): Promise<Orderbook | null> {
    const tokenId = market.token_id;
    const useWs = this.config.mmWsEnabled && this.config.polymarketWsEnabled && this.wsFeed;
    if (useWs && this.wsFeed) {
      const maxAge = this.resolveMmWsMaxAgeMs();
      const wsBook = this.wsFeed.getOrderbook(tokenId, maxAge);
      if (wsBook?.bestBid && wsBook?.bestAsk) {
        return {
          token_id: tokenId,
          bids: (wsBook.bids || []).map((level) => ({ price: String(level.price), shares: String(level.shares) })),
          asks: (wsBook.asks || []).map((level) => ({ price: String(level.price), shares: String(level.shares) })),
          best_bid: wsBook.bestBid,
          best_ask: wsBook.bestAsk,
          spread: wsBook.bestAsk - wsBook.bestBid,
          spread_pct: ((wsBook.bestAsk - wsBook.bestBid) / ((wsBook.bestAsk + wsBook.bestBid) / 2)) * 100,
          mid_price: (wsBook.bestAsk + wsBook.bestBid) / 2,
        };
      }
    }

    if (this.config.mmWsFallbackRest === false && useWs) {
      return null;
    }

    try {
      return await this.api.getOrderbook(tokenId);
    } catch (error) {
      console.error('Error fetching orderbook for ' + tokenId + ':', error);
      return null;
    }
  }

  private drainDirtyMarkets(): Market[] {
    if (!this.config.mmWsOnlyDirty) {
      return this.selectedMarkets;
    }
    if (this.wsDirtyTokens.size === 0) {
      return [];
    }
    const maxBatch = Math.max(0, Number(this.config.mmWsDirtyMaxBatch || 0));
    const tokens = Array.from(this.wsDirtyTokens);
    const batch = maxBatch > 0 ? tokens.slice(0, maxBatch) : tokens;
    // 只删除已处理的token，未处理的留在Set里下次处理
    for (const token of batch) {
      this.wsDirtyTokens.delete(token);
    }
    return batch
      .map((tokenId) => this.marketByToken.get(tokenId))
      .filter((market): market is Market => Boolean(market));
  }

  private getLoopSleepMs(): number {
    if (!this.config.mmWsOnlyDirty) {
      return this.config.refreshInterval;
    }
    const idle = Math.max(50, Number(this.config.mmWsIdleSleepMs || 0));
    return idle > 0 ? idle : Math.min(200, this.config.refreshInterval);
  }

  async run(): Promise<void> {
    this.running = true;
    console.log('🎯 Starting Polymarket market making loop...\n');

    while (this.running) {
      try {
        // 紧急撤单检查（APP一键全撤信号）
        const cancelFlagPath = path.join(process.cwd(), 'emergency-cancel.flag');
        if (fs.existsSync(cancelFlagPath)) {
          console.log('🚨 检测到紧急撤单信号，执行撤单...');
          try {
            await this.marketMaker.cancelAllOpenOrders();
            console.log('✅ 紧急撤单完成');
          } catch (e) {
            console.error('❌ 紧急撤单失败:', e);
          }
          fs.unlinkSync(cancelFlagPath);
        }

        this.updateWsHealth();
        this.marketMaker.maintainWsHealth();

        // 定期同步订单状态 — 防止重复下单或漏撤单
        const now = Date.now();
        if (now - this.lastStateUpdate > 30_000) {
          try {
            await this.marketMaker.updateState(this.getAccountAddressForQueries());
            this.lastStateUpdate = now;
          } catch (e) {
            console.warn('⚠️ Polymarket updateState失败:', e instanceof Error ? e.message : String(e));
          }
        }

        const marketsToProcess = this.drainDirtyMarkets();
        if (marketsToProcess.length === 0) {
          await this.sleep(this.getLoopSleepMs());
          continue;
        }

        for (const market of marketsToProcess) {
          try {
            if (this.isRewardPaused(market.token_id)) {
              continue;
            }
            const orderbook = await this.getOrderbookForMarket(market);
            if (!orderbook) continue;
            const rewardGate = this.evaluateRewardGate(market, orderbook);
            if (rewardGate.skip) {
              await this.pauseRewardMarket(market.token_id, rewardGate.reason || 'reward gate');
              continue;
            }
            await this.marketMaker.placeMMOrders(market, orderbook);
          } catch (error) {
            console.error('Error processing market ' + market.token_id + ':', error);
          }
        }

        // 成功后重置错误计数
        this.consecutiveLoopErrors = 0;

        this.marketMaker.printStatus();
        await this.sleep(this.getLoopSleepMs());
      } catch (error) {
        this.consecutiveLoopErrors++;
        const backoff = Math.min(60_000, this.config.refreshInterval * Math.pow(2, Math.min(this.consecutiveLoopErrors, 6)));
        console.error('Error in main loop (x' + this.consecutiveLoopErrors + ', ' + Math.round(backoff/1000) + 's backoff):', error instanceof Error ? error.message : error);
        await this.sleep(backoff);
      }
    }
  }

  async start(): Promise<void> {
    if (this.running) {
      throw new Error('Bot is already running');
    }
    await this.run();
    // 启动状态快照定时器
    if (this.marketMaker) {
      const { startSnapshotTimer } = await import('./utils/snapshot.js');
      startSnapshotTimer(this.marketMaker);
    }
  }

  async stop(): Promise<void> {
    console.log('\n\ud83d\uded1 Stopping Polymarket bot...');
    this.running = false;
    // P1 FIX: 撤销所有挂单 — 等待完成再退出，否则订单会一直挂在盘口
    try {
      if (this.marketMaker && typeof this.marketMaker.cancelAllOpenOrders === 'function') {
        await this.marketMaker.cancelAllOpenOrders();
        console.log('✅ Polymarket所有挂单已撤销');
      }
    } catch (e) {
      console.error('⚠️ Polymarket停止时撤单异常:', e?.message || e);
    }
    if (this.wsFeed) this.wsFeed.stop();
    if (this.wsDirtyUnsub) this.wsDirtyUnsub();
  }

  getSelectedMarketsCount(): number {
    return this.selectedMarkets.length;
  }

  getStatus() {
    return {
      openOrders: this.marketMaker?.getOpenOrdersCount() ?? 0,
      positions: this.marketMaker?.getPositionCount() ?? 0,
      sessionPnL: this.marketMaker?.getSessionPnL() ?? 0,
      markets: this.selectedMarkets.length,
    };
  }

  isRunning(): boolean {
    return this.running;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
// END PolymarketMarketMakerBot




let activeBot: { stop: () => void } | null = null;

// Main execution
async function main() {
  const config = loadConfig();
  const venue = String(config.mmVenue || 'predict').toLowerCase();
  const bot = venue === 'polymarket' ? new PolymarketMarketMakerBot() : new PredictMarketMakerBot();
  activeBot = bot;

  try {
    await bot.initialize();
    await bot.run();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Handle shutdown — 等撤单完成再退出
process.on('SIGINT', async () => {
  console.log('\n\nReceived SIGINT, shutting down gracefully...');
  if (activeBot) {
    await activeBot.stop();
    console.log('✅ 撤单完成，安全退出');
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\nReceived SIGTERM, shutting down gracefully...');
  if (activeBot) {
    await activeBot.stop();
    console.log('✅ 撤单完成，安全退出');
  }
  process.exit(0);
});

// Run
main().catch(console.error);
