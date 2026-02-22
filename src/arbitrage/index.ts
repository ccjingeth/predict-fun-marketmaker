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

// P0 优化系统
export { scoreArbitrageOpportunity, rankOpportunities, filterOpportunities } from './scoring.js';
export { calculateDynamicThresholds, DynamicThresholdManager } from './dynamic-thresholds.js';
export { RiskManager } from './risk-manager.js';
export { EnhancedArbitrageExecutor } from './enhanced-executor.js';

// P1 优化系统
export { SmartOrderRouter, RouterFactory } from './smart-order-router.js';
export { ExecutionEngine, getExecutionEngine } from './execution-engine.js';
export { PerformanceDashboard, getPerformanceDashboard } from './performance-dashboard.js';
export { MLPredictor, getMLPredictor } from './ml-predictor.js';

export type {
  ArbitrageType,
  ArbitrageOpportunity,
  ValueMismatchAnalysis,
  InPlatformArbitrage,
  CrossPlatformArbitrage,
  ArbitrageExecution,
} from './types.js';

// P0 优化类型
export type { ArbitrageScore } from './scoring.js';
export type { DynamicThresholds, MarketData, OrderBook } from './dynamic-thresholds.js';
export type { RiskConfig, PreflightResult, RiskStatus, ArbitragePosition } from './risk-manager.js';
export type { EnhancedExecutionConfig, ExecutionResult } from './enhanced-executor.js';

// P1 优化类型
export type {
  SplitStrategy, RouteOptions, OrderSlice, RouteResult, PlatformLiquidity
} from './smart-order-router.js';
export type {
  ExecutionStatus, ExecutionTask, ConcurrencyConfig, SlippageConfig,
  ExecutionEngineConfig, ExecutionStats
} from './execution-engine.js';
export type {
  PerformanceMetrics, OpportunityStats, RealTimeData, DashboardConfig
} from './performance-dashboard.js';
export type {
  HistoryDataPoint, PredictionResult, ArbitrageSuccessPrediction, MLConfig
} from './ml-predictor.js';

