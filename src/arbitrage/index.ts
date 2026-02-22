/**
 * Arbitrage Module
 * 套利模块导出
 */

export { ValueMismatchDetector } from './value-detector.js';
export { InPlatformArbitrageDetector } from './intra-arb.js';
export { MultiOutcomeArbitrageDetector } from './multi-outcome.js';
export { CrossPlatformArbitrageDetector } from './cross-arb.js';
export { DependencyArbitrageDetector } from './dependency-arb.js';
export { ArbitrageMonitor } from './monitor.js';
export { ArbitrageExecutor } from './executor.js';

// 新增：优化系统
export { scoreArbitrageOpportunity, rankOpportunities, filterOpportunities } from './scoring.js';
export { calculateDynamicThresholds, DynamicThresholdManager } from './dynamic-thresholds.js';
export { RiskManager } from './risk-manager.js';
export { EnhancedArbitrageExecutor } from './enhanced-executor.js';

export type {
  ArbitrageType,
  ArbitrageOpportunity,
  ValueMismatchAnalysis,
  InPlatformArbitrage,
  CrossPlatformArbitrage,
  ArbitrageExecution,
} from './types.js';

// 新增：优化类型
export type { ArbitrageScore, DynamicThresholds, RiskConfig, PreflightResult, RiskStatus } from './scoring.js';

