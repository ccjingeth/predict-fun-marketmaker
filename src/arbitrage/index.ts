/**
 * Arbitrage Module
 * 套利模块导出
 */

export { ValueMismatchDetector } from './value-detector.js';
export { InPlatformArbitrageDetector } from './intra-arb.js';
export { CrossPlatformArbitrageDetector } from './cross-arb.js';
export { ArbitrageMonitor } from './monitor.js';
export { ArbitrageExecutor } from './executor.js';

export type {
  ArbitrageType,
  ArbitrageOpportunity,
  ValueMismatchAnalysis,
  InPlatformArbitrage,
  CrossPlatformArbitrage,
  ArbitrageExecution,
} from './types.js';
