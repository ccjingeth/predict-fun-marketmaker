const envEditor = document.getElementById('envEditor');
const mappingEditor = document.getElementById('mappingEditor');
const dependencyEditor = document.getElementById('dependencyEditor');
const logOutput = document.getElementById('logOutput');
const logFilter = document.getElementById('logFilter');
const failureCategoryFilter = document.getElementById('failureCategoryFilter');
const logKeyword = document.getElementById('logKeyword');
const saveLogFilterBtn = document.getElementById('saveLogFilter');
const logFilterPreset = document.getElementById('logFilterPreset');
const deleteLogFilterBtn = document.getElementById('deleteLogFilter');
const globalStatus = document.getElementById('globalStatus');
const tradingMode = document.getElementById('tradingMode');
const consistencyBadge = document.getElementById('consistencyBadge');
const statusMM = document.getElementById('statusMM');
const statusArb = document.getElementById('statusArb');
const toggleInputs = Array.from(document.querySelectorAll('.toggle input[data-env]'));
const applyMmPassiveBtn = document.getElementById('applyMmPassive');
const applyArbSafeBtn = document.getElementById('applyArbSafe');
const tabButtons = Array.from(document.querySelectorAll('.tab-button'));
const tabPanels = Array.from(document.querySelectorAll('.tab-panel'));
const metricsStatus = document.getElementById('metricsStatus');
const metricSuccessRate = document.getElementById('metricSuccessRate');
const metricSuccessRaw = document.getElementById('metricSuccessRaw');
const metricFailureRate = document.getElementById('metricFailureRate');
const metricPreflightRate = document.getElementById('metricPreflightRate');
const metricPostFailRate = document.getElementById('metricPostFailRate');
const metricAttempts = document.getElementById('metricAttempts');
const metricPreflight = document.getElementById('metricPreflight');
const metricExec = document.getElementById('metricExec');
const metricTotal = document.getElementById('metricTotal');
const metricPostDrift = document.getElementById('metricPostDrift');
const metricQuality = document.getElementById('metricQuality');
const metricDepthPenalty = document.getElementById('metricDepthPenalty');
const metricConsistencyFail = document.getElementById('metricConsistencyFail');
const metricConsistencyReason = document.getElementById('metricConsistencyReason');
const metricConsistencyOverride = document.getElementById('metricConsistencyOverride');
const metricChunkFactor = document.getElementById('metricChunkFactor');
const metricChunkDelay = document.getElementById('metricChunkDelay');
const metricAlerts = document.getElementById('metricAlerts');
const metricSoftBlocks = document.getElementById('metricSoftBlocks');
const metricBlockedTokens = document.getElementById('metricBlockedTokens');
const metricBlockedPlatforms = document.getElementById('metricBlockedPlatforms');
const metricCooldown = document.getElementById('metricCooldown');
const metricLastError = document.getElementById('metricLastError');
const metricMetricsPath = document.getElementById('metricMetricsPath');
const metricStatePath = document.getElementById('metricStatePath');
const metricUpdatedAt = document.getElementById('metricUpdatedAt');
const refreshMetrics = document.getElementById('refreshMetrics');
const riskLevel = document.getElementById('riskLevel');
const downgradeProfileBtn = document.getElementById('downgradeProfile');
const downgradeSafeBtn = document.getElementById('downgradeSafe');
const downgradeUltraBtn = document.getElementById('downgradeUltra');
const applyConsistencyTemplateBtn = document.getElementById('applyConsistencyTemplate');
const applyFixTemplateBtn = document.getElementById('applyFixTemplate');
const weightSuccess = document.getElementById('weightSuccess');
const weightDrift = document.getElementById('weightDrift');
const weightQuality = document.getElementById('weightQuality');
const weightConsistency = document.getElementById('weightConsistency');
const weightStale = document.getElementById('weightStale');
const weightSuccessVal = document.getElementById('weightSuccessVal');
const weightDriftVal = document.getElementById('weightDriftVal');
const weightQualityVal = document.getElementById('weightQualityVal');
const weightConsistencyVal = document.getElementById('weightConsistencyVal');
const weightStaleVal = document.getElementById('weightStaleVal');
const resetRiskWeightsBtn = document.getElementById('resetRiskWeights');
const saveWeightPresetBtn = document.getElementById('saveWeightPreset');
const weightPresetSelect = document.getElementById('weightPresetSelect');
const deleteWeightPresetBtn = document.getElementById('deleteWeightPreset');
const exportWeightPresetBtn = document.getElementById('exportWeightPreset');
const importWeightPresetBtn = document.getElementById('importWeightPreset');
const metricRiskScore = document.getElementById('metricRiskScore');
const metricRiskBar = document.getElementById('metricRiskBar');
const chartSuccess = document.getElementById('chartSuccess');
const chartDrift = document.getElementById('chartDrift');
const chartRisk = document.getElementById('chartRisk');
const chartFailure = document.getElementById('chartFailure');
const chartFailPreflight = document.getElementById('chartFailPreflight');
const chartFailPost = document.getElementById('chartFailPost');
const chartConsistency = document.getElementById('chartConsistency');
const metricFailureReasons = document.getElementById('metricFailureReasons');
const metricAlertsList = document.getElementById('metricAlertsList');
const metricFailureAdviceList = document.getElementById('metricFailureAdviceList');
const metricConsistencyList = document.getElementById('metricConsistencyList');
const metricConsistencyHotspots = document.getElementById('metricConsistencyHotspots');
const metricFixSummaryList = document.getElementById('metricFixSummaryList');
const riskBreakdownList = document.getElementById('riskBreakdownList');
const saveEnvButton = document.getElementById('saveEnv');
const metricFlowList = document.getElementById('metricFlowList');
const metricSaveHint = document.getElementById('metricSaveHint');
const healthStatus = document.getElementById('healthStatus');
const healthList = document.getElementById('healthList');
const healthAdviceList = document.getElementById('healthAdviceList');
const healthFailureList = document.getElementById('healthFailureList');
const healthFailureCategories = document.getElementById('healthFailureCategories');
const fixPreviewList = document.getElementById('fixPreviewList');
const fixSelectList = document.getElementById('fixSelectList');
const healthExportHint = document.getElementById('healthExportHint');
const runDiagnosticsBtn = document.getElementById('runDiagnostics');
const exportDiagnosticsBtn = document.getElementById('exportDiagnostics');
const copyFailuresBtn = document.getElementById('copyFailures');
const copyFixTemplateBtn = document.getElementById('copyFixTemplate');
const mmStatus = document.getElementById('mmStatus');
const mmTradingStatus = document.getElementById('mmTradingStatus');
const mmPnL = document.getElementById('mmPnL');
const mmOpenOrders = document.getElementById('mmOpenOrders');
const mmPositions = document.getElementById('mmPositions');
const mmMarketsList = document.getElementById('mmMarketsList');
const refreshMmMetrics = document.getElementById('refreshMmMetrics');

const logs = [];
const MAX_LOGS = 800;
const METRICS_HISTORY_MAX = 120;
const metricsHistory = [];
const failureCounts = new Map();
const failureEvents = [];
const riskWeights = {
  success: 1,
  drift: 1,
  quality: 1,
  consistency: 1,
  stale: 1,
};
const FIX_HINTS = {
  CROSS_PLATFORM_ADAPTIVE_SIZE: '根据深度自动缩放下单量',
  CROSS_PLATFORM_DEPTH_USAGE: '使用的盘口深度比例',
  CROSS_PLATFORM_CHUNK_MAX_SHARES: '单次分块最大数量',
  CROSS_PLATFORM_CHUNK_FACTOR_MIN: '分块系数下限（越低越保守）',
  CROSS_PLATFORM_MIN_PROFIT_USD: '最低利润门槛（USD）',
  CROSS_PLATFORM_MIN_NOTIONAL_USD: '最低下单名义金额',
  CROSS_PLATFORM_SLIPPAGE_BPS: '允许滑点（bps）',
  CROSS_PLATFORM_EXECUTION_VWAP_CHECK: '执行前做 VWAP 保护',
  CROSS_PLATFORM_RECHECK_MS: '执行前复核间隔',
  CROSS_PLATFORM_PRICE_DRIFT_BPS: '价格漂移阈值（bps）',
  CROSS_PLATFORM_POST_TRADE_DRIFT_BPS: '成交后漂移阈值（bps）',
  CROSS_PLATFORM_STABILITY_BPS: '稳定窗口阈值（bps）',
  CROSS_PLATFORM_STABILITY_SAMPLES: '稳定采样次数',
  CROSS_PLATFORM_STABILITY_INTERVAL_MS: '稳定采样间隔',
  CROSS_PLATFORM_MAX_RETRIES: '最大重试次数',
  CROSS_PLATFORM_RETRY_DELAY_MS: '重试间隔',
  CROSS_PLATFORM_ABORT_COOLDOWN_MS: '失败冷却时间',
  CROSS_PLATFORM_VOLATILITY_BPS: '高波动阈值（bps）',
  CROSS_PLATFORM_USE_FOK: 'FOK 快速成交/撤单',
  CROSS_PLATFORM_POST_FILL_CHECK: '成交后检查未完成订单',
  CROSS_PLATFORM_HEDGE_MIN_PROFIT_USD: '对冲最低利润（USD）',
  CROSS_PLATFORM_HEDGE_MIN_EDGE: '对冲最小价差',
  CROSS_PLATFORM_HEDGE_SLIPPAGE_BPS: '对冲滑点限制',
  CROSS_PLATFORM_GLOBAL_MIN_QUALITY: '全局质量分门槛',
  CROSS_PLATFORM_GLOBAL_COOLDOWN_MS: '全局冷却时间',
  CROSS_PLATFORM_CIRCUIT_MAX_FAILURES: '熔断失败次数阈值',
  CROSS_PLATFORM_CIRCUIT_COOLDOWN_MS: '熔断冷却时间',
  ARB_WS_HEALTH_LOG_MS: 'WS 健康采样周期',
  ARB_PAUSE_BACKOFF: '失败暂停回退倍率',
  ARB_PAUSE_MAX_MS: '失败暂停最大值',
  ARB_PAUSE_RECOVERY_FACTOR: '成功回撤暂停系数',
  ARB_DEGRADE_MAX_LEVEL: '失败降级最大等级',
  ARB_DEGRADE_FACTOR: '失败降级系数',
  ARB_DEGRADE_STABILITY_ADD: '降级额外稳定次数',
  ARB_DEGRADE_TOP_N_MIN: '降级时最小执行 TopN',
  ARB_RECHECK_BUMP_MS: '预检失败增加复核间隔',
  ARB_RECHECK_BUMP_MAX_MS: '复核间隔最大增量',
  ARB_RECHECK_BUMP_RECOVER: '复核增量回撤系数',
  DEPENDENCY_MIN_DEPTH_USD: '依赖套利最小深度（USD）',
  DEPENDENCY_DEPTH_USAGE: '依赖套利深度使用比例（0-1）',
  PREDICT_WS_STALE_MS: '行情源过期阈值',
  MM_TOUCH_BUFFER_BPS: '盘口保护缓冲（越大越不易成交）',
  MM_FILL_RISK_SPREAD_BPS: '成交压力越高，自动放大价差',
  MM_NEAR_TOUCH_PENALTY_BPS: '近触碰撤单后自动放大价差',
  MM_NEAR_TOUCH_SIZE_PENALTY: '近触碰撤单后缩小挂单份额',
  MM_FILL_PENALTY_BPS: '真实成交后自动放大价差',
  MM_FILL_PENALTY_MAX_BPS: '成交惩罚上限',
  MM_FILL_PENALTY_DECAY_MS: '成交惩罚衰减时间',
  MM_NO_FILL_PASSIVE_MS: '无成交被动模式触发时间',
  MM_NO_FILL_PENALTY_BPS: '无成交被动惩罚（bps）',
  MM_NO_FILL_PENALTY_MAX_BPS: '无成交惩罚上限',
  MM_NO_FILL_RAMP_MS: '无成交惩罚递增时间',
  MM_NO_FILL_SIZE_PENALTY: '无成交缩小挂单份额',
  MM_NO_FILL_TOUCH_BPS: '无成交额外触碰缓冲（bps）',
  MM_NO_FILL_TOUCH_MAX_BPS: '无成交触碰缓冲上限',
  MM_NO_FILL_REPRICE_BPS: '无成交额外重报价阈值（bps）',
  MM_NO_FILL_REPRICE_MAX_BPS: '无成交重报价阈值上限',
  MM_NO_FILL_CANCEL_BPS: '无成交额外撤单阈值（bps）',
  MM_NO_FILL_CANCEL_MAX_BPS: '无成交撤单阈值上限',
  MM_SPREAD_JUMP_BPS: '盘口价差跳变阈值（bps）',
  MM_SPREAD_JUMP_WINDOW_MS: '价差跳变检测窗口（毫秒）',
  MM_ONLY_POINTS_MARKETS: '只做有积分/激励的市场',
  MM_POINTS_MIN_ONLY: '积分市场只挂最小份额',
  MM_POINTS_MIN_MULTIPLIER: '积分最小份额倍率',
  ARB_MAX_VWAP_DEVIATION_BPS: 'VWAP 最大允许偏离（bps）',
  ARB_RECHECK_DEVIATION_BPS: '偏离过大时需要二次确认（bps）',
  ARB_MAX_VWAP_LEVELS: '限制 VWAP 使用的档位数',
  ARB_MIN_DEPTH_USD: '盘口最小深度（USD）',
  ARB_WS_REALTIME: '开启 WS 实时增量扫描',
  ARB_MIN_PROFIT_BPS: '最小收益占名义金额比例（bps）',
  ARB_MIN_PROFIT_IMPACT_MULT: '冲击系数乘子（越大越保守）',
  CROSS_PLATFORM_LEG_VWAP_DEVIATION_BPS: '腿间 VWAP 偏离阈值（bps）',
  CROSS_PLATFORM_LEG_DRIFT_SPREAD_BPS: '腿间漂移差阈值（bps）',
  CROSS_PLATFORM_LEG_MIN_DEPTH_USD: '腿间盘口最小深度（USD）',
  CROSS_PLATFORM_LEG_DEVIATION_SOFT_BPS: '腿间偏离软阈值（不自动执行）',
  CROSS_PLATFORM_LEG_DEVIATION_SPREAD_BPS: '腿间偏离差阈值（bps）',
  CROSS_PLATFORM_LEG_DEPTH_USAGE_MAX: '单腿最大深度使用比例（0-1）',
  CROSS_PLATFORM_LEG_DEPTH_RATIO_MIN: '腿间深度比最小值（0-1）',
  CROSS_PLATFORM_LEG_DEPTH_RATIO_SOFT: '腿间深度比软阈值（0-1）',
  CROSS_PLATFORM_LEG_DEPTH_RATIO_SHRINK_MIN_FACTOR: '腿间深度比缩量下限系数（0-1）',
  CROSS_PLATFORM_DEPTH_RATIO_PENALTY_UP: '失败时深度比惩罚上调',
  CROSS_PLATFORM_DEPTH_RATIO_PENALTY_DOWN: '成功时深度比惩罚下调',
  CROSS_PLATFORM_DEPTH_RATIO_PENALTY_MAX: '深度比惩罚上限',
  CROSS_PLATFORM_CONSISTENCY_SAMPLES: '一致性检测采样次数',
  CROSS_PLATFORM_CONSISTENCY_INTERVAL_MS: '一致性采样间隔（毫秒）',
  CROSS_PLATFORM_CONSISTENCY_VWAP_BPS: '一致性 VWAP 偏离阈值（bps）',
  CROSS_PLATFORM_CONSISTENCY_VWAP_DRIFT_BPS: '一致性 VWAP 漂移阈值（bps）',
  CROSS_PLATFORM_CONSISTENCY_DEPTH_RATIO_MIN: '一致性腿间深度比最小值（0-1）',
  CROSS_PLATFORM_CONSISTENCY_DEPTH_RATIO_DRIFT: '一致性腿间深度比漂移阈值（0-1）',
  CROSS_PLATFORM_CONSISTENCY_FAIL_LIMIT: '一致性失败次数阈值',
  CROSS_PLATFORM_CONSISTENCY_FAIL_WINDOW_MS: '一致性失败统计窗口（毫秒）',
  CROSS_PLATFORM_CONSISTENCY_DEGRADE_MS: '一致性失败降级时长（毫秒）',
  CROSS_PLATFORM_CONSISTENCY_PENALTY: '一致性失败惩罚系数',
  CROSS_PLATFORM_CONSISTENCY_USE_DEGRADE_PROFILE: '一致性失败强制降级配置',
  CROSS_PLATFORM_CONSISTENCY_ORDER_TYPE: '一致性失败强制订单类型',
  CROSS_PLATFORM_CONSISTENCY_TEMPLATE_ENABLED: '一致性失败启用保守模板',
  CROSS_PLATFORM_CONSISTENCY_TEMPLATE_DEPTH_USAGE: '一致性模板深度使用比例',
  CROSS_PLATFORM_CONSISTENCY_TEMPLATE_SLIPPAGE_BPS: '一致性模板滑点上限',
  CROSS_PLATFORM_CONSISTENCY_TEMPLATE_MAX_VWAP_LEVELS: '一致性模板 VWAP 档位上限',
  CROSS_PLATFORM_CONSISTENCY_TEMPLATE_MIN_PROFIT_BPS: '一致性模板最小收益（bps）',
  CROSS_PLATFORM_CONSISTENCY_TEMPLATE_MIN_PROFIT_USD: '一致性模板最小收益（USD）',
  CROSS_PLATFORM_CONSISTENCY_TEMPLATE_MIN_NOTIONAL_USD: '一致性模板最小名义金额（USD）',
  CROSS_PLATFORM_CONSISTENCY_TEMPLATE_CHUNK_FACTOR: '一致性模板分块系数',
  CROSS_PLATFORM_CONSISTENCY_TEMPLATE_CHUNK_DELAY_MS: '一致性模板分块延迟',
  CROSS_PLATFORM_CONSISTENCY_TEMPLATE_FORCE_SEQUENTIAL: '一致性模板强制顺序下单',
  CROSS_PLATFORM_CONSISTENCY_TEMPLATE_USE_FOK: '一致性模板强制 FOK',
  CROSS_PLATFORM_CONSISTENCY_TEMPLATE_LIMIT_ORDERS: '一致性模板强制限价单',
  CROSS_PLATFORM_CONSISTENCY_TEMPLATE_DISABLE_BATCH: '一致性模板禁用批量下单',
  CROSS_PLATFORM_QUALITY_PROFIT_MULT: '质量分收益门槛放大系数',
  CROSS_PLATFORM_QUALITY_PROFIT_MAX: '质量分收益门槛放大上限',
  CROSS_PLATFORM_MAX_VWAP_LEVELS: '跨平台 VWAP 档位数上限',
  CROSS_PLATFORM_WS_REALTIME: '跨平台 WS 实时增量扫描',
  CROSS_PLATFORM_MIN_PROFIT_BPS: '跨平台最小收益占名义金额比例（bps）',
  CROSS_PLATFORM_MIN_PROFIT_IMPACT_MULT: '跨平台冲击系数乘子（越大越保守）',
  CROSS_PLATFORM_MISSING_VWAP_PENALTY_BPS: '缺少 VWAP 覆盖时额外收益门槛（bps）',
  CROSS_PLATFORM_POST_TRADE_HEDGE: '成交后漂移超阈值自动减仓',
  CROSS_PLATFORM_POST_TRADE_HEDGE_FORCE: '忽略收益门槛，强制减仓',
  CROSS_PLATFORM_POST_TRADE_NET_HEDGE: '成交后净敞口自动归零',
  CROSS_PLATFORM_POST_TRADE_NET_HEDGE_FORCE: '忽略收益门槛，强制净敞口对冲',
  CROSS_PLATFORM_DEGRADE_MS: '降级模式持续时间（毫秒）',
  CROSS_PLATFORM_DEGRADE_FORCE_SEQUENTIAL: '降级模式强制顺序下单',
  CROSS_PLATFORM_DEGRADE_EXIT_MS: '降级模式最短持续时间（毫秒）',
  CROSS_PLATFORM_DEGRADE_EXIT_SUCCESSES: '连续成功次数达到后退出降级',
  CROSS_PLATFORM_NET_RISK_USD: '跨平台整体净风险预算（USD）',
  CROSS_PLATFORM_NET_RISK_USD_PER_TOKEN: '单 token 净风险预算（USD）',
  CROSS_PLATFORM_NET_RISK_MIN_FACTOR: '净风险预算缩放下限',
  CROSS_PLATFORM_NET_RISK_MAX_FACTOR: '净风险预算缩放上限',
  CROSS_PLATFORM_NET_RISK_DEGRADE_FACTOR: '降级时预算缩放系数',
  CROSS_PLATFORM_NET_RISK_SCALE_ON_QUALITY: '预算随质量分自动缩放',
  CROSS_PLATFORM_NET_RISK_AUTO_TIGHTEN: '失败时自动收紧预算',
  CROSS_PLATFORM_NET_RISK_TIGHTEN_ON_FAILURE: '失败一次缩紧比例',
  CROSS_PLATFORM_NET_RISK_RELAX_ON_SUCCESS: '成功一次放宽比例',
  CROSS_PLATFORM_FALLBACK_SHRINK_FACTOR: '失败重试缩量系数',
  CROSS_PLATFORM_FALLBACK_MIN_FACTOR: '失败重试最小缩量',
  CROSS_PLATFORM_SINGLE_LEG_TOP_N: '单腿降级保留腿数',
  CROSS_PLATFORM_FAILURE_PROFIT_BPS: '失败后提高收益门槛（bps）',
  CROSS_PLATFORM_FAILURE_PROFIT_BPS_CAP: '失败后收益门槛上限（bps）',
  CROSS_PLATFORM_FAILURE_PROFIT_USD: '失败后提高收益门槛（USD）',
  CROSS_PLATFORM_FAILURE_STABILITY_BPS: '失败后额外稳定阈值（bps）',
  CROSS_PLATFORM_FAILURE_STABILITY_SAMPLES_ADD: '失败后额外稳定采样次数',
  CROSS_PLATFORM_FAILURE_STABILITY_INTERVAL_ADD_MS: '失败后额外稳定采样间隔',
  CROSS_PLATFORM_FAILURE_VWAP_DEVIATION_BPS: '失败后额外 VWAP 偏离阈值（bps）',
  CROSS_PLATFORM_FAILURE_LEG_MIN_DEPTH_USD_ADD: '失败后增加最小深度门槛（USD）',
  CROSS_PLATFORM_FAILURE_MAX_VWAP_LEVELS_CUT: '失败后收紧 VWAP 档位数',
  CROSS_PLATFORM_FAILURE_MIN_NOTIONAL_USD_ADD: '失败后提高最小名义金额',
  CROSS_PLATFORM_FAILURE_RETRY_DELAY_BUMP_MS: '失败后增加重试间隔',
  CROSS_PLATFORM_SUCCESS_RETRY_DELAY_TIGHTEN_MS: '成功后减少重试间隔',
  CROSS_PLATFORM_RETRY_DELAY_FLOOR_MS: '重试间隔下限',
  CROSS_PLATFORM_RETRY_DELAY_CEIL_MS: '重试间隔上限',
  CROSS_PLATFORM_FAILURE_PROFIT_BPS_BUMP: '失败后动态提高收益门槛（bps）',
  CROSS_PLATFORM_FAILURE_PROFIT_BPS_BUMP_MAX: '收益门槛动态提高上限',
  CROSS_PLATFORM_FAILURE_PROFIT_BPS_BUMP_RECOVER: '收益门槛回撤系数',
  CROSS_PLATFORM_FAILURE_STABILITY_SAMPLES_MAX: '失败后稳定采样次数上限',
  CROSS_PLATFORM_FAILURE_STABILITY_INTERVAL_MAX_MS: '失败后稳定采样间隔上限',
  CROSS_PLATFORM_FAILURE_PROFIT_USD_BUMP: '失败后动态提高收益门槛（USD）',
  CROSS_PLATFORM_FAILURE_PROFIT_USD_BUMP_MAX: '收益门槛动态提高上限（USD）',
  CROSS_PLATFORM_FAILURE_PROFIT_USD_BUMP_RECOVER: '收益门槛回撤系数（USD）',
  CROSS_PLATFORM_FAILURE_LEG_MIN_DEPTH_USD_BUMP: '失败后动态提高深度门槛（USD）',
  CROSS_PLATFORM_FAILURE_LEG_MIN_DEPTH_USD_BUMP_MAX: '深度门槛动态提高上限（USD）',
  CROSS_PLATFORM_FAILURE_LEG_MIN_DEPTH_USD_BUMP_RECOVER: '深度门槛回撤系数',
  CROSS_PLATFORM_FAILURE_MIN_NOTIONAL_USD_BUMP: '失败后动态提高最小名义金额（USD）',
  CROSS_PLATFORM_FAILURE_MIN_NOTIONAL_USD_BUMP_MAX: '最小名义金额提高上限（USD）',
  CROSS_PLATFORM_FAILURE_MIN_NOTIONAL_USD_BUMP_RECOVER: '最小名义金额回撤系数',
  CROSS_PLATFORM_FAILURE_MAX_RETRIES_CUT: '失败后减少的重试次数',
  CROSS_PLATFORM_FAILURE_MAX_RETRIES_MIN: '失败后重试次数下限',
  CROSS_PLATFORM_ORDER_TYPE_FALLBACK: '失败重试的订单类型序列',
  CROSS_PLATFORM_FALLBACK_MODE: '失败时降级模式',
  CROSS_PLATFORM_DEGRADE_ORDER_TYPE: '降级模式强制订单类型',
  CROSS_PLATFORM_DEGRADE_DISABLE_BATCH: '降级模式禁用批量下单',
  CROSS_PLATFORM_DEGRADE_LIMIT_ORDERS: '降级模式强制限价单',
  CROSS_PLATFORM_DEGRADE_USE_FOK: '降级模式强制 FOK',
};
const FIX_CATEGORY_KEYS = {
  深度不足: ['CROSS_PLATFORM_ADAPTIVE_SIZE', 'CROSS_PLATFORM_DEPTH_USAGE', 'CROSS_PLATFORM_CHUNK_MAX_SHARES'],
  预检失败: [
    'CROSS_PLATFORM_STABILITY_SAMPLES',
    'CROSS_PLATFORM_STABILITY_INTERVAL_MS',
    'CROSS_PLATFORM_MIN_PROFIT_USD',
    'CROSS_PLATFORM_MIN_NOTIONAL_USD',
  ],
  VWAP 偏离: ['CROSS_PLATFORM_SLIPPAGE_BPS', 'CROSS_PLATFORM_EXECUTION_VWAP_CHECK', 'CROSS_PLATFORM_RECHECK_MS'],
  价格漂移: ['CROSS_PLATFORM_PRICE_DRIFT_BPS', 'CROSS_PLATFORM_RECHECK_MS', 'CROSS_PLATFORM_STABILITY_SAMPLES'],
  成交后漂移: ['CROSS_PLATFORM_POST_TRADE_DRIFT_BPS', 'CROSS_PLATFORM_STABILITY_BPS', 'CROSS_PLATFORM_CHUNK_FACTOR_MIN'],
  高波动: ['CROSS_PLATFORM_VOLATILITY_BPS', 'CROSS_PLATFORM_STABILITY_SAMPLES'],
  执行失败: ['CROSS_PLATFORM_MAX_RETRIES', 'CROSS_PLATFORM_RETRY_DELAY_MS', 'CROSS_PLATFORM_ABORT_COOLDOWN_MS'],
  对冲失败: ['CROSS_PLATFORM_HEDGE_MIN_PROFIT_USD', 'CROSS_PLATFORM_HEDGE_MIN_EDGE', 'CROSS_PLATFORM_HEDGE_SLIPPAGE_BPS'],
  未成交订单: ['CROSS_PLATFORM_POST_FILL_CHECK', 'CROSS_PLATFORM_USE_FOK'],
  熔断触发: ['CROSS_PLATFORM_CIRCUIT_MAX_FAILURES', 'CROSS_PLATFORM_CIRCUIT_COOLDOWN_MS'],
  冷却触发: ['CROSS_PLATFORM_GLOBAL_MIN_QUALITY', 'CROSS_PLATFORM_GLOBAL_COOLDOWN_MS'],
  映射/依赖: ['CROSS_PLATFORM_USE_MAPPING'],
  网络/请求: ['ARB_WS_HEALTH_LOG_MS', 'PREDICT_WS_STALE_MS', 'CROSS_PLATFORM_RETRY_DELAY_MS'],
};
const weightPresets = new Map();
const logFilterPresets = new Map();

function setGlobalStatus(text, active) {
  globalStatus.textContent = text;
  globalStatus.style.background = active
    ? 'rgba(81, 209, 182, 0.2)'
    : 'rgba(106, 163, 255, 0.2)';
  globalStatus.style.color = active ? '#51d1b6' : '#6aa3ff';
  globalStatus.style.borderColor = active ? 'rgba(81, 209, 182, 0.45)' : 'rgba(106, 163, 255, 0.4)';
}

function setMetricsStatus(text, active) {
  metricsStatus.textContent = text;
  metricsStatus.style.background = active
    ? 'rgba(81, 209, 182, 0.2)'
    : 'rgba(247, 196, 108, 0.15)';
  metricsStatus.style.color = active ? '#51d1b6' : '#f7c46c';
  metricsStatus.style.borderColor = active ? 'rgba(81, 209, 182, 0.45)' : 'rgba(247, 196, 108, 0.35)';
}

function setConsistencyBadge(text, tone) {
  if (!consistencyBadge) return;
  consistencyBadge.textContent = text;
  if (tone === 'error') {
    consistencyBadge.style.background = 'rgba(255, 107, 107, 0.2)';
    consistencyBadge.style.color = '#ff6b6b';
    consistencyBadge.style.borderColor = 'rgba(255, 107, 107, 0.4)';
    return;
  }
  if (tone === 'warn') {
    consistencyBadge.style.background = 'rgba(247, 196, 108, 0.15)';
    consistencyBadge.style.color = '#f7c46c';
    consistencyBadge.style.borderColor = 'rgba(247, 196, 108, 0.35)';
    return;
  }
  consistencyBadge.style.background = 'rgba(81, 209, 182, 0.2)';
  consistencyBadge.style.color = '#51d1b6';
  consistencyBadge.style.borderColor = 'rgba(81, 209, 182, 0.45)';
}

function setHealthStatus(text, tone) {
  healthStatus.textContent = text;
  if (tone === 'error') {
    healthStatus.style.background = 'rgba(255, 107, 107, 0.2)';
    healthStatus.style.color = '#ff6b6b';
    healthStatus.style.borderColor = 'rgba(255, 107, 107, 0.4)';
    return;
  }
  if (tone === 'warn') {
    healthStatus.style.background = 'rgba(247, 196, 108, 0.15)';
    healthStatus.style.color = '#f7c46c';
    healthStatus.style.borderColor = 'rgba(247, 196, 108, 0.35)';
    return;
  }
  healthStatus.style.background = 'rgba(81, 209, 182, 0.2)';
  healthStatus.style.color = '#51d1b6';
  healthStatus.style.borderColor = 'rgba(81, 209, 182, 0.45)';
}

function setRiskLevel(level, tone) {
  if (!riskLevel) return;
  riskLevel.textContent = level;
  if (tone === 'error') {
    riskLevel.style.background = 'rgba(255, 107, 107, 0.2)';
    riskLevel.style.color = '#ff6b6b';
    riskLevel.style.borderColor = 'rgba(255, 107, 107, 0.4)';
    return;
  }
  if (tone === 'warn') {
    riskLevel.style.background = 'rgba(247, 196, 108, 0.15)';
    riskLevel.style.color = '#f7c46c';
    riskLevel.style.borderColor = 'rgba(247, 196, 108, 0.35)';
    return;
  }
  riskLevel.style.background = 'rgba(81, 209, 182, 0.2)';
  riskLevel.style.color = '#51d1b6';
  riskLevel.style.borderColor = 'rgba(81, 209, 182, 0.45)';
}

function updateRiskWeightsUI() {
  if (!weightSuccess || !weightDrift || !weightQuality || !weightConsistency || !weightStale) return;
  weightSuccess.value = riskWeights.success.toFixed(1);
  weightDrift.value = riskWeights.drift.toFixed(1);
  weightQuality.value = riskWeights.quality.toFixed(1);
  weightConsistency.value = riskWeights.consistency.toFixed(1);
  weightStale.value = riskWeights.stale.toFixed(1);
  if (weightSuccessVal) weightSuccessVal.textContent = riskWeights.success.toFixed(1);
  if (weightDriftVal) weightDriftVal.textContent = riskWeights.drift.toFixed(1);
  if (weightQualityVal) weightQualityVal.textContent = riskWeights.quality.toFixed(1);
  if (weightConsistencyVal) weightConsistencyVal.textContent = riskWeights.consistency.toFixed(1);
  if (weightStaleVal) weightStaleVal.textContent = riskWeights.stale.toFixed(1);
}

function saveRiskWeights() {
  try {
    localStorage.setItem('riskWeights', JSON.stringify(riskWeights));
  } catch {
    // ignore
  }
}

function loadRiskWeights() {
  try {
    const raw = localStorage.getItem('riskWeights');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    ['success', 'drift', 'quality', 'consistency', 'stale'].forEach((key) => {
      const value = Number(parsed?.[key]);
      if (Number.isFinite(value)) {
        riskWeights[key] = Math.max(0, Math.min(2, value));
      }
    });
  } catch {
    // ignore
  }
}

function saveWeightPresets() {
  try {
    const payload = Array.from(weightPresets.entries()).map(([name, weights]) => ({ name, weights }));
    localStorage.setItem('weightPresets', JSON.stringify(payload));
  } catch {
    // ignore
  }
}

function loadWeightPresets() {
  weightPresets.clear();
  try {
    const raw = localStorage.getItem('weightPresets');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    parsed.forEach((item) => {
      if (!item?.name || !item?.weights) return;
      weightPresets.set(item.name, item.weights);
    });
  } catch {
    // ignore
  }
}

function saveLogFilterPresets() {
  try {
    const payload = Array.from(logFilterPresets.entries()).map(([name, filter]) => ({
      name,
      filter,
    }));
    localStorage.setItem('logFilterPresets', JSON.stringify(payload));
  } catch {
    // ignore
  }
}

function loadLogFilterPresets() {
  logFilterPresets.clear();
  try {
    const raw = localStorage.getItem('logFilterPresets');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    parsed.forEach((item) => {
      if (!item?.name || !item?.filter) return;
      logFilterPresets.set(item.name, item.filter);
    });
  } catch {
    // ignore
  }
}

function updateLogFilterPresetSelect() {
  if (!logFilterPreset) return;
  logFilterPreset.innerHTML = '';
  const defaultOption = document.createElement('option');
  defaultOption.value = 'default';
  defaultOption.textContent = '默认筛选';
  logFilterPreset.appendChild(defaultOption);
  for (const name of logFilterPresets.keys()) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    logFilterPreset.appendChild(option);
  }
}

function applyLogFilterPreset(name) {
  if (!name || name === 'default') {
    logFilter.value = 'all';
    failureCategoryFilter.value = 'all';
    logKeyword.value = '';
    renderLogs();
    return;
  }
  const preset = logFilterPresets.get(name);
  if (!preset) return;
  logFilter.value = preset.type || 'all';
  failureCategoryFilter.value = preset.category || 'all';
  logKeyword.value = preset.keyword || '';
  renderLogs();
}

function updateWeightPresetSelect() {
  if (!weightPresetSelect) return;
  weightPresetSelect.innerHTML = '';
  const defaultOption = document.createElement('option');
  defaultOption.value = 'default';
  defaultOption.textContent = '默认权重';
  weightPresetSelect.appendChild(defaultOption);
  for (const name of weightPresets.keys()) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    weightPresetSelect.appendChild(option);
  }
}

function applyWeightPreset(name) {
  if (!name || name === 'default') {
    riskWeights.success = 1;
    riskWeights.drift = 1;
    riskWeights.quality = 1;
    riskWeights.consistency = 1;
    riskWeights.stale = 1;
    updateRiskWeightsUI();
    saveRiskWeights();
    loadMetrics();
    return;
  }
  const preset = weightPresets.get(name);
  if (!preset) return;
  ['success', 'drift', 'quality', 'consistency', 'stale'].forEach((key) => {
    const value = Number(preset[key]);
    if (Number.isFinite(value)) {
      riskWeights[key] = Math.max(0, Math.min(2, value));
    }
  });
  updateRiskWeightsUI();
  saveRiskWeights();
  loadMetrics();
}

function bindRiskWeightInputs() {
  if (!weightSuccess) return;
  const bind = (input, key, label) => {
    if (!input) return;
    input.addEventListener('input', () => {
      const val = Number(input.value);
      if (Number.isFinite(val)) {
        riskWeights[key] = val;
        if (label) label.textContent = val.toFixed(1);
        saveRiskWeights();
        loadMetrics();
      }
    });
  };
  bind(weightSuccess, 'success', weightSuccessVal);
  bind(weightDrift, 'drift', weightDriftVal);
  bind(weightQuality, 'quality', weightQualityVal);
  bind(weightConsistency, 'consistency', weightConsistencyVal);
  bind(weightStale, 'stale', weightStaleVal);
  if (resetRiskWeightsBtn) {
    resetRiskWeightsBtn.addEventListener('click', () => {
      riskWeights.success = 1;
      riskWeights.drift = 1;
      riskWeights.quality = 1;
      riskWeights.consistency = 1;
      riskWeights.stale = 1;
      updateRiskWeightsUI();
      saveRiskWeights();
      loadMetrics();
      pushLog({ type: 'system', level: 'system', message: '已重置风险权重' });
    });
  }
  if (saveWeightPresetBtn) {
    saveWeightPresetBtn.addEventListener('click', () => {
      const name = prompt('给这套权重起个名字：');
      if (!name) return;
      weightPresets.set(name, { ...riskWeights });
      saveWeightPresets();
      updateWeightPresetSelect();
      weightPresetSelect.value = name;
      pushLog({ type: 'system', level: 'system', message: `已保存权重预设：${name}` });
    });
  }
  if (weightPresetSelect) {
    weightPresetSelect.addEventListener('change', () => {
      applyWeightPreset(weightPresetSelect.value);
    });
  }
  if (deleteWeightPresetBtn) {
    deleteWeightPresetBtn.addEventListener('click', () => {
      const name = weightPresetSelect?.value;
      if (!name || name === 'default') return;
      weightPresets.delete(name);
      saveWeightPresets();
      updateWeightPresetSelect();
      weightPresetSelect.value = 'default';
      applyWeightPreset('default');
      pushLog({ type: 'system', level: 'system', message: `已删除权重预设：${name}` });
    });
  }
  if (exportWeightPresetBtn) {
    exportWeightPresetBtn.addEventListener('click', () => {
      const payload = Array.from(weightPresets.entries()).map(([name, weights]) => ({ name, weights }));
      if (!payload.length) {
        pushLog({ type: 'system', level: 'system', message: '暂无可导出的预设' });
        return;
      }
      const json = JSON.stringify(payload, null, 2);
      navigator.clipboard
        .writeText(json)
        .then(() => {
          pushLog({ type: 'system', level: 'system', message: '权重预设已复制到剪贴板' });
        })
        .catch(() => {
          pushLog({ type: 'system', level: 'stderr', message: '复制失败，请手动复制' });
        });
    });
  }
  if (importWeightPresetBtn) {
    importWeightPresetBtn.addEventListener('click', () => {
      const raw = prompt('粘贴预设 JSON：');
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          throw new Error('格式错误');
        }
        parsed.forEach((item) => {
          if (!item?.name || !item?.weights) return;
          weightPresets.set(item.name, item.weights);
        });
        saveWeightPresets();
        updateWeightPresetSelect();
        pushLog({ type: 'system', level: 'system', message: '已导入权重预设' });
      } catch (error) {
        pushLog({ type: 'system', level: 'stderr', message: '预设 JSON 解析失败' });
      }
    });
  }
}

function bindLogFilterPresets() {
  if (saveLogFilterBtn) {
    saveLogFilterBtn.addEventListener('click', () => {
      const name = prompt('给这套日志筛选起个名字：');
      if (!name) return;
      logFilterPresets.set(name, {
        type: logFilter.value,
        category: failureCategoryFilter.value,
        keyword: logKeyword.value,
      });
      saveLogFilterPresets();
      updateLogFilterPresetSelect();
      logFilterPreset.value = name;
      pushLog({ type: 'system', level: 'system', message: `已保存日志筛选：${name}` });
    });
  }
  if (logFilterPreset) {
    logFilterPreset.addEventListener('change', () => {
      applyLogFilterPreset(logFilterPreset.value);
    });
  }
  if (deleteLogFilterBtn) {
    deleteLogFilterBtn.addEventListener('click', () => {
      const name = logFilterPreset?.value;
      if (!name || name === 'default') return;
      logFilterPresets.delete(name);
      saveLogFilterPresets();
      updateLogFilterPresetSelect();
      logFilterPreset.value = 'default';
      applyLogFilterPreset('default');
      pushLog({ type: 'system', level: 'system', message: `已删除日志筛选：${name}` });
    });
  }
}

function updateStatusDisplay(status) {
  const mmRunning = status.marketMaker;
  const arbRunning = status.arbitrage;
  statusMM.textContent = mmRunning ? '运行中' : '未运行';
  statusMM.style.color = mmRunning ? '#51d1b6' : '#ff6b6b';
  statusArb.textContent = arbRunning ? '运行中' : '未运行';
  statusArb.style.color = arbRunning ? '#51d1b6' : '#ff6b6b';
  setGlobalStatus(mmRunning || arbRunning ? '运行中' : '空闲', mmRunning || arbRunning);
}

function detectTradingMode(text) {
  const match = text.match(/ENABLE_TRADING\s*=\s*(true|false)/i);
  const isLive = match && match[1].toLowerCase() === 'true';
  tradingMode.textContent = isLive ? 'Live' : 'Dry Run';
  tradingMode.style.background = isLive ? 'rgba(255, 107, 107, 0.18)' : 'rgba(247, 196, 108, 0.15)';
  tradingMode.style.color = isLive ? '#ff6b6b' : '#f7c46c';
}

function parseEnv(text) {
  const map = new Map();
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .forEach((line) => {
      if (!line || line.startsWith('#')) return;
      const idx = line.indexOf('=');
      if (idx < 0) return;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (key) map.set(key, value);
    });
  return map;
}

function updateMetricsPaths() {
  const env = parseEnv(envEditor.value || '');
  const metricsPath = env.get('CROSS_PLATFORM_METRICS_PATH') || 'data/cross-platform-metrics.json';
  const statePath = env.get('CROSS_PLATFORM_STATE_PATH') || 'data/cross-platform-state.json';
  if (metricMetricsPath) metricMetricsPath.textContent = metricsPath;
  if (metricStatePath) metricStatePath.textContent = statePath;
}

function syncTogglesFromEnv(text) {
  const env = parseEnv(text);
  for (const input of toggleInputs) {
    const key = input.dataset.env;
    if (!key) continue;
    const value = env.get(key) || 'false';
    input.checked = value.toLowerCase() === 'true';
  }
}

function renderLogs() {
  const filter = logFilter.value;
  const category = failureCategoryFilter?.value || 'all';
  const keyword = (logKeyword?.value || '').trim().toLowerCase();
  logOutput.innerHTML = '';
  const fragment = document.createDocumentFragment();

  const view = logs.filter((entry) => {
    if (filter === 'all') return true;
    return entry.type === filter;
  }).filter((entry) => {
    if (category === 'all') return true;
    return entry.category === category;
  }).filter((entry) => {
    if (!keyword) return true;
    return (entry.message || '').toLowerCase().includes(keyword);
  });

  for (const entry of view) {
    const line = document.createElement('div');
    line.className = `log-line ${entry.level}`;
    line.textContent = `[${entry.type}] ${entry.message}`.trim();
    fragment.appendChild(line);
  }

  logOutput.appendChild(fragment);
  logOutput.scrollTop = logOutput.scrollHeight;
}

function normalizeFailureLine(text) {
  if (!text) return '';
  const noisePatterns = [
    /heartbeat/i,
    /connected/i,
    /subscribed/i,
    /snapshot/i,
    /ticker/i,
    /pong/i,
    /ping/i,
    /status/i,
    /启动进程/i,
    /进程退出/i,
  ];
  if (noisePatterns.some((pattern) => pattern.test(text))) {
    return '';
  }
  return text
    .replace(/\s+/g, ' ')
    .replace(/\d+(\.\d+)?/g, '#')
    .slice(0, 140);
}

function classifyFailure(line) {
  const text = (line || '').toLowerCase();
  if (/insufficient depth|min depth|depth/.test(text)) return '深度不足';
  if (/vwap/.test(text)) return 'VWAP 偏离';
  if (/drift/.test(text)) return '价格漂移';
  if (/post[- ]?trade|posttrade/.test(text)) return '成交后漂移';
  if (/volatility/.test(text)) return '高波动';
  if (/preflight|sanity check|validation|consistency/.test(text)) return '预检失败';
  if (/hedge/.test(text)) return '对冲失败';
  if (/execution|submit|fill failed|order failed/.test(text)) return '执行失败';
  if (/open orders remain/.test(text)) return '未成交订单';
  if (/credentials|api key|private key|jwt/.test(text)) return '权限/密钥';
  if (/circuit breaker/.test(text)) return '熔断触发';
  if (/cooldown/.test(text)) return '冷却触发';
  if (/mapping|dependency/.test(text)) return '映射/依赖';
  if (/network|timeout|fetch/.test(text)) return '网络/请求';
  return '其他';
}

function renderFailureCategories() {
  if (!healthFailureCategories) return;
  const counts24h = new Map();
  const counts1h = new Map();
  const now = Date.now();
  const cutoff24h = now - 24 * 60 * 60 * 1000;
  const cutoff1h = now - 60 * 60 * 1000;
  for (const event of failureEvents) {
    if (!event || !event.ts) continue;
    if (event.ts < cutoff24h) continue;
    counts24h.set(event.category, (counts24h.get(event.category) || 0) + 1);
    if (event.ts >= cutoff1h) {
      counts1h.set(event.category, (counts1h.get(event.category) || 0) + 1);
    }
  }
  const entries = Array.from(counts24h.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  healthFailureCategories.innerHTML = '';
  if (!entries.length) {
    const item = document.createElement('div');
    item.className = 'health-item ok';
    item.textContent = '暂无分类。';
    healthFailureCategories.appendChild(item);
    return;
  }
  entries.forEach(([category, count]) => {
    const row = document.createElement('div');
    row.className = 'health-item warn';
    const label = document.createElement('div');
    label.className = 'health-label';
    label.textContent = `${category}`;
    const hint = document.createElement('div');
    hint.className = 'health-hint';
    const recent = counts1h.get(category) || 0;
    hint.textContent = `24h ${count} 次 / 1h ${recent} 次`;
    row.appendChild(label);
    row.appendChild(hint);
    row.addEventListener('click', () => {
      if (!failureCategoryFilter) return;
      failureCategoryFilter.value = category;
      renderLogs();
      pushLog({ type: 'system', level: 'system', message: `日志过滤：${category}`, category: null });
    });
    healthFailureCategories.appendChild(row);
  });
}

function updateFailureCounts(line) {
  const normalized = normalizeFailureLine(line);
  if (!normalized) return;
  const count = failureCounts.get(normalized) || 0;
  failureCounts.set(normalized, count + 1);
  const category = classifyFailure(normalized);
  const isConsistency = normalized.toLowerCase().includes('consistency');
  let reason = '';
  if (isConsistency) {
    if (normalized.includes('vwap drift')) reason = 'VWAP 漂移';
    else if (normalized.includes('vwap deviates')) reason = 'VWAP 偏离';
    else if (normalized.includes('depth ratio drift')) reason = '深度比漂移';
    else if (normalized.includes('depth ratio')) reason = '深度比不足';
    else if (normalized.includes('missing orderbook')) reason = '订单簿缺失';
    else if (normalized.includes('insufficient vwap depth')) reason = 'VWAP 深度不足';
    else if (normalized.includes('invalid depth')) reason = '深度异常';
    else if (normalized.includes('invalid price')) reason = '价格异常';
    else reason = '一致性异常';
  }
  failureEvents.push({ ts: Date.now(), category, isConsistency, reason });
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  while (failureEvents.length > 0 && failureEvents[0].ts < cutoff) {
    failureEvents.shift();
  }
}

function renderFailureTopN() {
  if (!healthFailureList) return;
  const entries = Array.from(failureCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  healthFailureList.innerHTML = '';
  if (!entries.length) {
    const item = document.createElement('div');
    item.className = 'health-item ok';
    item.textContent = '暂无失败原因。';
    healthFailureList.appendChild(item);
    return;
  }
  entries.forEach(([line, count]) => {
    const row = document.createElement('div');
    row.className = 'health-item warn';
    const label = document.createElement('div');
    label.className = 'health-label';
    label.textContent = `${count} 次`;
    const hint = document.createElement('div');
    hint.className = 'health-hint';
    hint.textContent = line;
    const button = document.createElement('button');
    button.className = 'btn ghost';
    button.textContent = '修复建议';
    button.addEventListener('click', () => copyFailureAdvice(line));
    row.appendChild(label);
    row.appendChild(hint);
    row.appendChild(button);
    healthFailureList.appendChild(row);
  });
}

function renderMetricFailureAdvice(reasons, metricsSnapshot) {
  if (!metricFailureAdviceList) return;
  metricFailureAdviceList.innerHTML = '';
  if (!reasons) {
    const item = document.createElement('div');
    item.className = 'alert-item warn';
    item.textContent = '暂无建议';
    metricFailureAdviceList.appendChild(item);
    return;
  }
  const entries = Object.entries(reasons).filter(([, v]) => Number(v) > 0);
  if (!entries.length) {
    const item = document.createElement('div');
    item.className = 'alert-item warn';
    item.textContent = '暂无建议';
    metricFailureAdviceList.appendChild(item);
    return;
  }
  const sorted = entries.sort((a, b) => Number(b[1]) - Number(a[1]));
  const top = sorted.slice(0, 2);
  const hints = [];
  top.forEach(([key]) => {
    const rows = getFailureAdvice(String(key));
    if (rows.length) {
      hints.push(...rows);
    }
  });
  if (metricsSnapshot) {
    if (metricsSnapshot.failureRate > 40) {
      hints.push('建议应用修复模板：提高稳定窗口、降低深度使用、缩小执行量');
    }
    if (metricsSnapshot.preflightFailRate > 20) {
      hints.push('建议应用修复模板：提高稳定采样、提高最小利润门槛');
    }
    if (metricsSnapshot.postFailRate > 10) {
      hints.push('建议应用修复模板：降低分块系数、提高漂移阈值');
    }
  }
  const lines = Array.from(new Set(hints)).slice(0, 5);
  if (!lines.length) {
    const item = document.createElement('div');
    item.className = 'alert-item warn';
    item.textContent = '暂无建议';
    metricFailureAdviceList.appendChild(item);
    return;
  }
  const recommendedCategories = top.map(([key]) => String(key));
  lines.forEach((text, idx) => {
    const row = document.createElement('div');
    row.className = 'alert-item warn';
    row.textContent = `建议 ${idx + 1}: ${text}`;
    if (idx === 0 && recommendedCategories.length && fixSelectList) {
      const action = document.createElement('button');
      action.className = 'btn ghost';
      action.textContent = '一键勾选';
      action.addEventListener('click', () => autoSelectFixes(recommendedCategories));
      row.appendChild(action);
      const apply = document.createElement('button');
      apply.className = 'btn ghost';
      apply.textContent = '一键应用';
      apply.addEventListener('click', () => {
        autoSelectFixes(recommendedCategories);
        applySelectedFixes(true);
        pushLog({ type: 'system', level: 'system', message: '已按建议一键应用修复参数（请保存生效）' });
      });
      row.appendChild(apply);
    }
    metricFailureAdviceList.appendChild(row);
  });
  if (recommendedCategories.length) {
    const mapRow = document.createElement('div');
    mapRow.className = 'alert-item warn';
    mapRow.textContent = `关联分类: ${recommendedCategories.join(' / ')}`;
    const detail = document.createElement('div');
    detail.className = 'alert-item warn';
    const keySet = new Set();
    recommendedCategories.forEach((category) => {
      const keys = FIX_CATEGORY_KEYS[category] || [];
      keys.forEach((key) => keySet.add(key));
    });
    const list = Array.from(keySet);
    if (list.length <= 6) {
      detail.textContent = list.length ? `关联参数: ${list.join('、')}` : '关联参数: 暂无';
    } else {
      const preview = list.slice(0, 6).join('、');
      detail.textContent = `关联参数: ${preview} …`;
      const more = document.createElement('button');
      more.className = 'btn ghost';
      more.textContent = '展开全部';
      let expanded = false;
      more.addEventListener('click', () => {
        expanded = !expanded;
        if (expanded) {
          detail.textContent = `关联参数: ${list.join('、')}`;
          more.textContent = '收起';
        } else {
          detail.textContent = `关联参数: ${preview} …`;
          more.textContent = '展开全部';
        }
        detail.appendChild(more);
      });
      detail.appendChild(more);
    }
    detail.dataset.keys = list.join(',');
    metricFailureAdviceList.appendChild(mapRow);
    metricFailureAdviceList.appendChild(detail);
  }
}

function renderFixSummary() {
  if (!metricFixSummaryList) return;
  const template = buildFixTemplate();
  metricFixSummaryList.innerHTML = '';
  if (!template) {
    const item = document.createElement('div');
    item.className = 'alert-item warn';
    item.textContent = '暂无摘要';
    metricFixSummaryList.appendChild(item);
    return 0;
  }
  const lines = template.split('\n').filter(Boolean);
  if (!lines.length) {
    const item = document.createElement('div');
    item.className = 'alert-item warn';
    item.textContent = '暂无摘要';
    metricFixSummaryList.appendChild(item);
    return 0;
  }
  const topLine = lines.find((line) => line.includes('主要问题')) || '';
  if (topLine) {
    const item = document.createElement('div');
    item.className = 'alert-item warn';
    item.textContent = topLine.replace(/^#\s*/, '');
    metricFixSummaryList.appendChild(item);
  }
  const entries = parseFixTemplate(template);
  const env = parseEnv(envEditor.value || '');
  const changed = entries.filter((entry) => {
    const current = env.get(entry.key);
    const normalizedCurrent = current === undefined ? '' : String(current).trim();
    const normalizedValue = String(entry.value || '').trim();
    return normalizedCurrent !== normalizedValue;
  });
  const item = document.createElement('div');
  if (changed.length) {
    item.className = 'alert-item warn';
    item.textContent = `建议可应用 ${changed.length} 项参数`;
  } else {
    item.className = 'alert-item ok';
    item.textContent = '建议项已全部匹配，无需应用。';
  }
  metricFixSummaryList.appendChild(item);
  if (changed.length) {
    const actionRow = document.createElement('div');
    actionRow.className = 'alert-item warn';
    const button = document.createElement('button');
    button.className = 'btn ghost';
    button.textContent = '一键按摘要应用';
    button.addEventListener('click', () => {
      const categories = getTopFailureCategories();
      autoSelectFixes(categories);
      applySelectedFixes(true);
      pushLog({ type: 'system', level: 'system', message: `已按摘要一键应用 ${changed.length} 项（请保存生效）` });
    });
    actionRow.appendChild(button);
    metricFixSummaryList.appendChild(actionRow);
  }
  return changed.length;
}

function renderFlowStatus({ appliedFixes = false, saved = false, hasAdvice = null } = {}) {
  if (!metricFlowList) return;
  const rows = Array.from(metricFlowList.querySelectorAll('.alert-item'));
  if (!rows.length) return;
  const base = ['查看失败建议', '应用修复参数', '保存配置'];
  rows.forEach((row) => row.classList.remove('done'));
  if (hasAdvice !== null) {
    rows[0].textContent = `${base[0]}（${hasAdvice ? '已就绪' : '待观察'}）`;
  }
  if (saved) {
    rows[0]?.classList.add('done');
    rows[1]?.classList.add('done');
    rows[2]?.classList.add('done');
    rows[1].textContent = `${base[1]}（已完成）`;
    rows[2].textContent = `${base[2]}（已保存）`;
    return;
  }
  if (appliedFixes) {
    rows[0]?.classList.add('done');
    rows[1]?.classList.add('done');
    rows[1].textContent = `${base[1]}（已应用）`;
    rows[2].textContent = `${base[2]}（待保存）`;
    return;
  }
  rows[1].textContent = `${base[1]}（${hasAdvice === false ? '无需应用' : '待应用'}）`;
  rows[2].textContent = `${base[2]}（待保存）`;
}

function renderSaveHint({ hasPendingSave }) {
  if (!metricSaveHint) return;
  metricSaveHint.innerHTML = '';
  const item = document.createElement('div');
  item.className = `alert-item ${hasPendingSave ? 'warn' : 'ok'}`;
  item.textContent = hasPendingSave
    ? '配置已修改但尚未保存，请点击“保存配置”生效。'
    : '暂无未保存的变更。';
  metricSaveHint.appendChild(item);
}

function renderMetricFailureReasons(reasons) {
  if (!metricFailureReasons) return;
  metricFailureReasons.innerHTML = '';
  if (!reasons) {
    const item = document.createElement('div');
    item.className = 'health-item ok';
    item.textContent = '暂无数据。';
    metricFailureReasons.appendChild(item);
    return;
  }
  const entries = Object.entries(reasons).filter(([, v]) => Number(v) > 0);
  if (!entries.length) {
    const item = document.createElement('div');
    item.className = 'health-item ok';
    item.textContent = '暂无失败记录。';
    metricFailureReasons.appendChild(item);
    return;
  }
  const total = entries.reduce((sum, [, value]) => sum + Number(value || 0), 0);
  const sorted = entries.sort((a, b) => Number(b[1]) - Number(a[1]));
  for (const [key, value] of sorted) {
    const row = document.createElement('div');
    row.className = 'health-item warn';
    const label = document.createElement('div');
    label.className = 'health-label';
    label.textContent = key;
    const hint = document.createElement('div');
    hint.className = 'health-hint';
    if (total > 0) {
      const ratio = (Number(value || 0) / total) * 100;
      hint.textContent = `${value} 次（${formatNumber(ratio, 1)}%）`;
    } else {
      hint.textContent = `${value} 次`;
    }
    const actions = document.createElement('button');
    actions.className = 'btn ghost';
    actions.textContent = '一键建议';
    actions.addEventListener('click', () => copyFailureAdvice(key));
    row.appendChild(label);
    row.appendChild(hint);
    row.appendChild(actions);
    metricFailureReasons.appendChild(row);
  }
}

async function copyFailures() {
  const entries = Array.from(failureCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const text = entries
    .map(([line, count], idx) => `${idx + 1}. ${count} 次 - ${line}`)
    .join('\n');
  if (!text) {
    if (healthExportHint) healthExportHint.textContent = '暂无失败原因可复制。';
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    if (healthExportHint) healthExportHint.textContent = '失败原因已复制到剪贴板。';
  } catch {
    if (healthExportHint) healthExportHint.textContent = '复制失败，请手动选择。';
  }
}

async function copyFixTemplate() {
  const template = buildFixTemplate();
  if (!template) {
    if (healthExportHint) healthExportHint.textContent = '暂无修复模板可复制。';
    return;
  }
  try {
    await navigator.clipboard.writeText(template);
    if (healthExportHint) healthExportHint.textContent = '修复模板已复制到剪贴板。';
  } catch {
    if (healthExportHint) healthExportHint.textContent = '复制失败，请手动选择。';
  }
}

function getFailureAdvice(line) {
  const hints = [];
  if (/insufficient depth|insufficient/i.test(line)) {
    hints.push('降低下单量或调低 CROSS_PLATFORM_DEPTH_USAGE');
    hints.push('开启 CROSS_PLATFORM_ADAPTIVE_SIZE=true');
  }
  if (/preflight/i.test(line)) {
    hints.push('提高 CROSS_PLATFORM_STABILITY_INTERVAL_MS 与 CROSS_PLATFORM_STABILITY_SAMPLES');
    hints.push('提高 CROSS_PLATFORM_MIN_PROFIT_USD 与 CROSS_PLATFORM_MIN_NOTIONAL_USD');
    hints.push('检查映射表/依赖表是否过期');
  }
  if (/post-trade|post trade|drift/i.test(line)) {
    hints.push('提高 CROSS_PLATFORM_POST_TRADE_DRIFT_BPS 或 CROSS_PLATFORM_STABILITY_BPS');
    hints.push('降低 CROSS_PLATFORM_DEPTH_USAGE 或启用 CROSS_PLATFORM_ADAPTIVE_SIZE');
    hints.push('降低 CROSS_PLATFORM_CHUNK_FACTOR_MIN，减小并发冲击');
  }
  if (/hedge/i.test(line)) {
    hints.push('提高 CROSS_PLATFORM_HEDGE_MIN_PROFIT_USD 或 CROSS_PLATFORM_HEDGE_MIN_EDGE');
    hints.push('提高 CROSS_PLATFORM_HEDGE_SLIPPAGE_BPS 并确认对冲行情源稳定');
  }
  if (/execution|timeout|rate limit|429/i.test(line)) {
    hints.push('提高 CROSS_PLATFORM_RETRY_DELAY_MS，减少并发执行');
    hints.push('降低 CROSS_PLATFORM_MAX_RETRIES 或延长 CROSS_PLATFORM_ABORT_COOLDOWN_MS');
    hints.push('启用 CROSS_PLATFORM_ABORT_COOLDOWN_MS 降低频繁重试');
  }
  if (/mapping|match/i.test(line)) {
    hints.push('校验 markets-mapping.json 与依赖映射是否一致');
    hints.push('开启 CROSS_PLATFORM_USE_MAPPING=true，补充人工映射');
  }
  if (/liquidity|slippage/i.test(line)) {
    hints.push('提高 CROSS_PLATFORM_SLIPPAGE_BPS 或启用自适应滑点');
    hints.push('降低 CROSS_PLATFORM_DEPTH_USAGE 并提高最小利润阈值');
  }
  if (/VWAP deviates|vwap/i.test(line)) {
    hints.push('增加 CROSS_PLATFORM_SLIPPAGE_BPS 或缩小下单量');
  }
  if (/price drift|drift/i.test(line)) {
    hints.push('降低 CROSS_PLATFORM_PRICE_DRIFT_BPS 或开启 RECHECK');
  }
  if (/volatility/i.test(line)) {
    hints.push('提高 CROSS_PLATFORM_VOLATILITY_BPS 或降低执行频率');
  }
  if (/Open orders remain/i.test(line)) {
    hints.push('开启 CROSS_PLATFORM_POST_FILL_CHECK=true');
    hints.push('使用 FOK 或减少分块规模');
  }
  if (/circuit breaker/i.test(line)) {
    hints.push('检查失败频次，提升重试窗口或降低执行强度');
  }
  if (/credentials missing|API credentials/i.test(line)) {
    hints.push('补齐 Polymarket / Opinion API Key 与私钥');
  }
  if (/Token score too low/i.test(line)) {
    hints.push('降低 CROSS_PLATFORM_TOKEN_MIN_SCORE 或清理历史失败');
  }
  if (!hints.length) {
    hints.push('开启一键降级后再观察一次执行表现');
  }
  return hints;
}

async function copyFailureAdvice(line) {
  const hints = getFailureAdvice(line);
  const text = `失败原因: ${line}\n建议:\n- ${hints.join('\n- ')}`;
  try {
    await navigator.clipboard.writeText(text);
    if (healthExportHint) healthExportHint.textContent = '修复建议已复制到剪贴板。';
  } catch {
    if (healthExportHint) healthExportHint.textContent = '复制失败，请手动选择。';
  }
}

function pushLog(entry) {
  if (entry.category === undefined) {
    const normalized = normalizeFailureLine(entry.message || '');
    entry.category = normalized ? classifyFailure(normalized) : null;
  }
  logs.push(entry);
  if (logs.length > MAX_LOGS) {
    logs.shift();
  }
  if (entry.level === 'stderr' || /error|failed|失败|异常/i.test(entry.message || '')) {
    updateFailureCounts(entry.message || '');
    renderFailureTopN();
    renderFailureCategories();
    updateFixPreview();
  }
  renderLogs();
}

function setEnvValue(text, key, value) {
  const regex = new RegExp(`^${key}\\s*=.*$`, 'm');
  if (regex.test(text)) {
    return text.replace(regex, `${key}=${value}`);
  }
  return `${text.trim()}\n${key}=${value}\n`;
}

async function loadEnv() {
  const text = await window.predictBot.readEnv();
  envEditor.value = text;
  detectTradingMode(text);
  syncTogglesFromEnv(text);
  updateMetricsPaths();
  updateFixPreview();
}

async function saveEnv() {
  await window.predictBot.writeEnv(envEditor.value);
  detectTradingMode(envEditor.value);
  syncTogglesFromEnv(envEditor.value);
  if (saveEnvButton) {
    saveEnvButton.classList.remove('attention');
  }
  renderFlowStatus({ appliedFixes: false, saved: true });
  renderSaveHint({ hasPendingSave: false });
  pushLog({ type: 'system', level: 'system', message: '配置已保存' });
}

async function loadMapping() {
  const text = await window.predictBot.readMapping();
  mappingEditor.value = text;
}

async function saveMapping() {
  try {
    JSON.parse(mappingEditor.value || '{}');
  } catch (error) {
    pushLog({ type: 'system', level: 'stderr', message: '映射 JSON 格式错误，未保存' });
    return;
  }
  await window.predictBot.writeMapping(mappingEditor.value);
  pushLog({ type: 'system', level: 'system', message: '跨平台映射已保存' });
}

async function loadDependency() {
  const text = await window.predictBot.readDependency();
  dependencyEditor.value = text;
}

async function saveDependency() {
  try {
    JSON.parse(dependencyEditor.value || '{}');
  } catch (error) {
    pushLog({ type: 'system', level: 'stderr', message: '依赖约束 JSON 格式错误，未保存' });
    return;
  }
  await window.predictBot.writeDependency(dependencyEditor.value);
  pushLog({ type: 'system', level: 'system', message: '依赖约束已保存' });
}

function applyToggles() {
  let text = envEditor.value || '';
  for (const input of toggleInputs) {
    const key = input.dataset.env;
    if (!key) continue;
    text = setEnvValue(text, key, input.checked ? 'true' : 'false');
  }
  envEditor.value = text;
  detectTradingMode(text);
  updateMetricsPaths();
}

function applyDowngradeProfile(level = 'safe') {
  let text = envEditor.value || '';
  const profiles = {
    safe: {
      AUTO_CONFIRM: 'false',
      ARB_AUTO_EXECUTE: 'false',
      CROSS_PLATFORM_AUTO_EXECUTE: 'false',
      CROSS_PLATFORM_EXECUTION_VWAP_CHECK: 'true',
      CROSS_PLATFORM_ADAPTIVE_SIZE: 'true',
      CROSS_PLATFORM_DEPTH_USAGE: '0.3',
      CROSS_PLATFORM_RECHECK_MS: '300',
      CROSS_PLATFORM_STABILITY_SAMPLES: '3',
      CROSS_PLATFORM_STABILITY_INTERVAL_MS: '120',
      CROSS_PLATFORM_CHUNK_MAX_SHARES: '10',
      CROSS_PLATFORM_CHUNK_DELAY_MIN_MS: '200',
      CROSS_PLATFORM_CHUNK_DELAY_MAX_MS: '1200',
      CROSS_PLATFORM_VOLATILITY_BPS: '60',
      CROSS_PLATFORM_POST_TRADE_DRIFT_BPS: '60',
      CROSS_PLATFORM_AUTO_TUNE: 'true',
      CROSS_PLATFORM_CHUNK_AUTO_TUNE: 'true',
      CROSS_PLATFORM_USE_FOK: 'true',
      CROSS_PLATFORM_PARALLEL_SUBMIT: 'true',
    },
    ultra: {
      AUTO_CONFIRM: 'false',
      ARB_AUTO_EXECUTE: 'false',
      CROSS_PLATFORM_AUTO_EXECUTE: 'false',
      CROSS_PLATFORM_EXECUTION_VWAP_CHECK: 'true',
      CROSS_PLATFORM_ADAPTIVE_SIZE: 'true',
      CROSS_PLATFORM_DEPTH_USAGE: '0.2',
      CROSS_PLATFORM_RECHECK_MS: '500',
      CROSS_PLATFORM_STABILITY_SAMPLES: '4',
      CROSS_PLATFORM_STABILITY_INTERVAL_MS: '180',
      CROSS_PLATFORM_CHUNK_MAX_SHARES: '6',
      CROSS_PLATFORM_CHUNK_DELAY_MIN_MS: '300',
      CROSS_PLATFORM_CHUNK_DELAY_MAX_MS: '1800',
      CROSS_PLATFORM_VOLATILITY_BPS: '50',
      CROSS_PLATFORM_POST_TRADE_DRIFT_BPS: '50',
      CROSS_PLATFORM_AUTO_TUNE: 'true',
      CROSS_PLATFORM_CHUNK_AUTO_TUNE: 'true',
      CROSS_PLATFORM_USE_FOK: 'true',
      CROSS_PLATFORM_PARALLEL_SUBMIT: 'true',
    },
  };
  const updates = profiles[level] || profiles.safe;
  Object.entries(updates).forEach(([key, value]) => {
    text = setEnvValue(text, key, value);
  });
  envEditor.value = text;
  detectTradingMode(text);
  syncTogglesFromEnv(text);
  updateMetricsPaths();
  pushLog({ type: 'system', level: 'system', message: `已应用${level === 'ultra' ? '极保守' : '保守'}参数（请保存生效）` });
}

function parseFixTemplate(template) {
  const entries = [];
  const lines = template.split('\n');
  for (const line of lines) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    entries.push({
      key: line.slice(0, idx).trim(),
      value: line.slice(idx + 1).trim(),
    });
  }
  return entries;
}

function updateFixPreview() {
  if (!fixPreviewList) return;
  const template = buildFixTemplate();
  const entries = parseFixTemplate(template);
  const env = parseEnv(envEditor.value || '');
  fixPreviewList.innerHTML = '';
  const relatedKeys = new Set();
  if (metricFailureAdviceList) {
    const detailRow = metricFailureAdviceList.querySelector('[data-keys]');
    if (detailRow && detailRow.dataset.keys) {
      detailRow.dataset.keys.split(',').forEach((key) => {
        if (key) relatedKeys.add(key.trim());
      });
    }
  }
  if (!template || !entries.length) {
    const item = document.createElement('div');
    item.className = 'health-item ok';
    item.textContent = '暂无修复建议。';
    fixPreviewList.appendChild(item);
    return;
  }
  const lines = template.split('\n');
  let hasEntries = false;
  lines.forEach((line) => {
    if (!line || !line.trim()) return;
    if (line.trim().startsWith('#')) {
      if (line.includes('分类:') || line.includes('主要问题')) {
        const header = document.createElement('div');
        header.className = 'health-item ok';
        header.textContent = line.replace(/^#\s*/, '');
        fixPreviewList.appendChild(header);
      }
      return;
    }
    const idx = line.indexOf('=');
    if (idx === -1) return;
    hasEntries = true;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    const row = document.createElement('div');
    const label = document.createElement('div');
    label.className = 'health-label';
    label.textContent = key;
    const hint = document.createElement('div');
    hint.className = 'health-hint';
    const current = env.get(key);
    const normalizedCurrent = current === undefined ? '' : String(current).trim();
    const normalizedValue = String(value || '').trim();
    const isSame = normalizedCurrent === normalizedValue;
    const isRelated = relatedKeys.has(key);
    row.className = `health-item ${isSame ? 'ok' : 'warn'}${isRelated ? ' related' : ''}`;
    const description = FIX_HINTS[key] ? `｜${FIX_HINTS[key]}` : '';
    hint.textContent = isSame
      ? `当前: ${current ?? '未设置'}（已匹配）${description}`
      : `当前: ${current ?? '未设置'} → 建议: ${value}${description}`;
    row.appendChild(label);
    row.appendChild(hint);
    fixPreviewList.appendChild(row);
  });
  if (!hasEntries) {
    const item = document.createElement('div');
    item.className = 'health-item ok';
    item.textContent = '暂无修复建议。';
    fixPreviewList.appendChild(item);
  }

  renderFixSelect(entries, env);
}

function getTopFailureCategories(limit = 2) {
  const categories = new Map();
  for (const [line, count] of failureCounts.entries()) {
    const category = classifyFailure(line);
    categories.set(category, (categories.get(category) || 0) + count);
  }
  return Array.from(categories.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([category]) => category);
}

function autoSelectFixes(categories) {
  if (!fixSelectList) return;
  const recommendedKeys = new Set();
  (categories || []).forEach((category) => {
    const keys = FIX_CATEGORY_KEYS[category] || [];
    keys.forEach((key) => recommendedKeys.add(key));
  });
  const env = parseEnv(envEditor.value || '');
  const checkboxes = Array.from(fixSelectList.querySelectorAll('input[type="checkbox"]'));
  let selected = 0;
  checkboxes.forEach((cb) => {
    const key = cb.dataset.key;
    const value = cb.dataset.value;
    if (!key || value === undefined) return;
    const current = env.get(key);
    const normalizedCurrent = current === undefined ? '' : String(current).trim();
    const normalizedValue = String(value || '').trim();
    const isMismatch = normalizedCurrent !== normalizedValue;
    const shouldSelect = recommendedKeys.has(key) && isMismatch;
    cb.checked = shouldSelect;
    if (shouldSelect) selected += 1;
  });
  if (healthExportHint) {
    if (selected > 0) {
      healthExportHint.textContent = `已按建议勾选 ${selected} 项，可直接应用。`;
    } else {
      healthExportHint.textContent = '建议项均已匹配，无需再次勾选。';
    }
  }
}

function renderFixSelect(entries, env) {
  if (!fixSelectList) return;
  fixSelectList.innerHTML = '';
  if (!entries.length) {
    const item = document.createElement('div');
    item.className = 'health-item ok';
    item.textContent = '暂无可选项。';
    fixSelectList.appendChild(item);
    return;
  }
  const topCategories = getTopFailureCategories();
  const recommendedKeys = new Set();
  topCategories.forEach((category) => {
    const keys = FIX_CATEGORY_KEYS[category] || [];
    keys.forEach((key) => recommendedKeys.add(key));
  });
  const toolRow = document.createElement('div');
  toolRow.className = 'health-item';
  const selectAllBtn = document.createElement('button');
  selectAllBtn.className = 'btn ghost';
  selectAllBtn.textContent = '全选';
  const selectNoneBtn = document.createElement('button');
  selectNoneBtn.className = 'btn ghost';
  selectNoneBtn.textContent = '取消全选';
  const selectMismatchBtn = document.createElement('button');
  selectMismatchBtn.className = 'btn ghost';
  selectMismatchBtn.textContent = '仅选未匹配';
  const selectRecommendedBtn = document.createElement('button');
  selectRecommendedBtn.className = 'btn ghost';
  selectRecommendedBtn.textContent = '按建议勾选';
  toolRow.appendChild(selectAllBtn);
  toolRow.appendChild(selectNoneBtn);
  toolRow.appendChild(selectMismatchBtn);
  toolRow.appendChild(selectRecommendedBtn);
  fixSelectList.appendChild(toolRow);
  entries.forEach((entry) => {
    const row = document.createElement('div');
    const isRecommended = recommendedKeys.has(entry.key);
    row.className = `health-item${isRecommended ? ' related' : ''}`;

    const checkboxWrap = document.createElement('label');
    checkboxWrap.className = 'checkbox';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.dataset.key = entry.key;
    checkbox.dataset.value = entry.value;
    const labelText = document.createElement('span');
    labelText.textContent = `${entry.key}`;
    checkboxWrap.appendChild(checkbox);
    checkboxWrap.appendChild(labelText);

    const hint = document.createElement('div');
    hint.className = 'health-hint';
    const current = env.get(entry.key);
    const normalizedCurrent = current === undefined ? '' : String(current).trim();
    const normalizedValue = String(entry.value || '').trim();
    const isSame = normalizedCurrent === normalizedValue;
    checkbox.checked = !isSame;
    const description = FIX_HINTS[entry.key] ? `｜${FIX_HINTS[entry.key]}` : '';
    const tag = isRecommended ? '（推荐）' : '';
    hint.textContent = isSame
      ? `当前: ${current ?? '未设置'}（已匹配）${tag}${description}`
      : `当前: ${current ?? '未设置'} → 建议: ${entry.value}${tag}${description}`;

    row.appendChild(checkboxWrap);
    row.appendChild(hint);
    fixSelectList.appendChild(row);
  });

  const applyRow = document.createElement('div');
  applyRow.className = 'health-item';
  const applyBtn = document.createElement('button');
  applyBtn.className = 'btn ghost apply-btn';
  applyBtn.textContent = '应用已选项';
  applyBtn.addEventListener('click', applySelectedFixes);
  applyRow.appendChild(applyBtn);
  fixSelectList.appendChild(applyRow);

  selectAllBtn.addEventListener('click', () => {
    const checkboxes = Array.from(fixSelectList.querySelectorAll('input[type="checkbox"]'));
    checkboxes.forEach((cb) => {
      cb.checked = true;
    });
  });
  selectNoneBtn.addEventListener('click', () => {
    const checkboxes = Array.from(fixSelectList.querySelectorAll('input[type="checkbox"]'));
    checkboxes.forEach((cb) => {
      cb.checked = false;
    });
  });
  selectMismatchBtn.addEventListener('click', () => {
    const checkboxes = Array.from(fixSelectList.querySelectorAll('input[type="checkbox"]'));
    checkboxes.forEach((cb) => {
      const key = cb.dataset.key;
      const value = cb.dataset.value;
      if (!key || value === undefined) return;
      const current = env.get(key);
      const normalizedCurrent = current === undefined ? '' : String(current).trim();
      const normalizedValue = String(value || '').trim();
      cb.checked = normalizedCurrent !== normalizedValue;
    });
  });
  selectRecommendedBtn.addEventListener('click', () => {
    autoSelectFixes(topCategories);
    if (healthExportHint) {
      healthExportHint.textContent = `已按高频失败分类勾选（${topCategories.join(' / ')}），可直接应用。`;
    }
  });
}

function applySelectedFixes(quiet = false) {
  if (!fixSelectList) return;
  const checkboxes = Array.from(fixSelectList.querySelectorAll('input[type="checkbox"]'));
  let text = envEditor.value || '';
  let applied = 0;
  const diffs = [];
  checkboxes.forEach((cb) => {
    if (!cb.checked) return;
    const key = cb.dataset.key;
    const value = cb.dataset.value;
    if (!key || value === undefined) return;
    const current = parseEnv(text).get(key);
    diffs.push(`${key}: ${current ?? '未设置'} → ${value}`);
  });
  if (diffs.length === 0) {
    if (!quiet) {
      pushLog({ type: 'system', level: 'system', message: '没有选中任何修复建议' });
    }
    return;
  }
  if (!quiet) {
    const confirmed = confirm(`即将应用以下修改：\n${diffs.join('\n')}\n\n确认应用吗？`);
    if (!confirmed) {
      pushLog({ type: 'system', level: 'system', message: '已取消修复建议应用' });
      return;
    }
  }
  checkboxes.forEach((cb) => {
    if (!cb.checked) return;
    const key = cb.dataset.key;
    const value = cb.dataset.value;
    if (!key || value === undefined) return;
    text = setEnvValue(text, key, value);
    applied += 1;
  });
  envEditor.value = text;
  detectTradingMode(text);
  syncTogglesFromEnv(text);
  updateMetricsPaths();
  updateFixPreview();
  if (healthExportHint) {
    healthExportHint.textContent = '修复参数已写入配置编辑器，请点击“保存配置”生效。';
  }
  if (saveEnvButton) {
    saveEnvButton.classList.add('attention');
  }
  renderFlowStatus({ appliedFixes: true, saved: false });
  if (!quiet) {
    pushLog({ type: 'system', level: 'system', message: `已应用 ${applied} 条修复建议（请保存生效）` });
  }
}

function applyTemplate(updates, label) {
  let text = envEditor.value || '';
  Object.entries(updates).forEach(([key, value]) => {
    text = setEnvValue(text, key, value);
  });
  envEditor.value = text;
  detectTradingMode(text);
  syncTogglesFromEnv(text);
  updateMetricsPaths();
  updateFixPreview();
  if (saveEnvButton) {
    saveEnvButton.classList.add('attention');
  }
  if (healthExportHint) {
    healthExportHint.textContent = `${label} 已应用，请点击“保存配置”生效。`;
  }
  pushLog({ type: 'system', level: 'system', message: `${label} 已应用（请保存生效）` });
}

function applyMmPassiveTemplate() {
  applyTemplate(
    {
      MM_TOUCH_BUFFER_BPS: '0.0008',
      MM_FILL_RISK_SPREAD_BPS: '0.0015',
      MM_NEAR_TOUCH_PENALTY_BPS: '8',
      MM_NEAR_TOUCH_SIZE_PENALTY: '0.85',
      MM_FILL_PENALTY_BPS: '12',
      MM_FILL_PENALTY_MAX_BPS: '40',
      MM_FILL_PENALTY_DECAY_MS: '90000',
      MM_NO_FILL_PASSIVE_MS: '60000',
      MM_NO_FILL_PENALTY_BPS: '6',
      MM_NO_FILL_PENALTY_MAX_BPS: '20',
      MM_NO_FILL_RAMP_MS: '30000',
      MM_NO_FILL_SIZE_PENALTY: '0.85',
      MM_NO_FILL_TOUCH_BPS: '0.0006',
      MM_NO_FILL_TOUCH_MAX_BPS: '0.0020',
      MM_NO_FILL_REPRICE_BPS: '0.0005',
      MM_NO_FILL_REPRICE_MAX_BPS: '0.0015',
      MM_NO_FILL_CANCEL_BPS: '0.0008',
      MM_NO_FILL_CANCEL_MAX_BPS: '0.0025',
      MM_SOFT_CANCEL_BPS: '0.0012',
      MM_HARD_CANCEL_BPS: '0.0025',
      MM_HOLD_NEAR_TOUCH_MS: '800',
      MM_DYNAMIC_CANCEL_ON_FILL: 'true',
      MM_DYNAMIC_CANCEL_BOOST: '0.5',
      MM_DYNAMIC_CANCEL_MAX_BOOST: '2',
      MM_DYNAMIC_CANCEL_DECAY_MS: '60000',
      MM_ORDER_DEPTH_USAGE: '0.2',
      MM_POINTS_MIN_ONLY: 'true',
      MM_POINTS_MIN_MULTIPLIER: '1',
    },
    '做市防吃单模板'
  );
}

function applyArbSafeTemplate() {
  applyTemplate(
    {
      ARB_PREFLIGHT_ENABLED: 'true',
      ARB_REQUIRE_WS: 'true',
      ARB_WS_REALTIME: 'true',
      ARB_MAX_VWAP_DEVIATION_BPS: '200',
      ARB_RECHECK_DEVIATION_BPS: '60',
      ARB_MAX_VWAP_LEVELS: '4',
      ARB_STABILITY_REQUIRED: 'true',
      ARB_STABILITY_MIN_COUNT: '2',
      ARB_STABILITY_WINDOW_MS: '2000',
      ARB_MIN_PROFIT_USD: '0.05',
      ARB_MIN_DEPTH_USD: '50',
      ARB_DEPTH_USAGE: '0.5',
    },
    '套利稳健模板'
  );
}

function applyConsistencyTemplate() {
  applyTemplate(
    {
      CROSS_PLATFORM_CONSISTENCY_TEMPLATE_ENABLED: 'true',
      CROSS_PLATFORM_CONSISTENCY_TEMPLATE_DEPTH_USAGE: '0.2',
      CROSS_PLATFORM_CONSISTENCY_TEMPLATE_SLIPPAGE_BPS: '200',
      CROSS_PLATFORM_CONSISTENCY_TEMPLATE_MAX_VWAP_LEVELS: '2',
      CROSS_PLATFORM_CONSISTENCY_TEMPLATE_MIN_PROFIT_BPS: '15',
      CROSS_PLATFORM_CONSISTENCY_TEMPLATE_MIN_PROFIT_USD: '0.03',
      CROSS_PLATFORM_CONSISTENCY_TEMPLATE_MIN_NOTIONAL_USD: '12',
      CROSS_PLATFORM_CONSISTENCY_TEMPLATE_CHUNK_FACTOR: '0.6',
      CROSS_PLATFORM_CONSISTENCY_TEMPLATE_CHUNK_DELAY_MS: '200',
      CROSS_PLATFORM_CONSISTENCY_TEMPLATE_FORCE_SEQUENTIAL: 'true',
      CROSS_PLATFORM_CONSISTENCY_TEMPLATE_USE_FOK: 'true',
      CROSS_PLATFORM_CONSISTENCY_TEMPLATE_LIMIT_ORDERS: 'true',
      CROSS_PLATFORM_CONSISTENCY_TEMPLATE_DISABLE_BATCH: 'true',
    },
    '一致性保守模板'
  );
}

function buildFixTemplate() {
  const categories = new Map();
  for (const [line, count] of failureCounts.entries()) {
    const category = classifyFailure(line);
    categories.set(category, (categories.get(category) || 0) + count);
  }
  const sortedCategories = Array.from(categories.entries()).sort((a, b) => b[1] - a[1]);
  const topCategories = sortedCategories.slice(0, 2).map(([category]) => category);
  const template = [];
  template.push('# 自动修复建议（根据高频失败分类生成）');
  if (!topCategories.length) {
    template.push('# 暂无足够失败数据，建议先运行一段时间再应用。');
    return template.join('\n');
  }
  template.push(`# 主要问题: ${topCategories.join(' + ')}`);
  const seen = new Set();
  const appendLines = (category, lines) => {
    if (!lines.length) return;
    template.push(`# 分类: ${category}`);
    lines.forEach((line) => {
      const idx = line.indexOf('=');
      if (idx === -1) {
        template.push(line);
        return;
      }
      const key = line.slice(0, idx).trim();
      if (seen.has(key)) return;
      seen.add(key);
      template.push(line);
    });
  };
  topCategories.forEach((category) => {
    if (category === '深度不足') {
      appendLines(category, [
        'CROSS_PLATFORM_ADAPTIVE_SIZE=true',
        'CROSS_PLATFORM_DEPTH_USAGE=0.25',
        'CROSS_PLATFORM_CHUNK_MAX_SHARES=8',
      ]);
    } else if (category === '预检失败') {
      appendLines(category, [
        'CROSS_PLATFORM_STABILITY_SAMPLES=3',
        'CROSS_PLATFORM_STABILITY_INTERVAL_MS=160',
        'CROSS_PLATFORM_MIN_PROFIT_USD=0.02',
        'CROSS_PLATFORM_MIN_NOTIONAL_USD=10',
      ]);
    } else if (category === 'VWAP 偏离') {
      appendLines(category, [
        'CROSS_PLATFORM_SLIPPAGE_BPS=250',
        'CROSS_PLATFORM_EXECUTION_VWAP_CHECK=true',
        'CROSS_PLATFORM_RECHECK_MS=300',
      ]);
    } else if (category === '价格漂移') {
      appendLines(category, [
        'CROSS_PLATFORM_PRICE_DRIFT_BPS=40',
        'CROSS_PLATFORM_RECHECK_MS=300',
        'CROSS_PLATFORM_STABILITY_SAMPLES=3',
      ]);
    } else if (category === '成交后漂移') {
      appendLines(category, [
        'CROSS_PLATFORM_POST_TRADE_DRIFT_BPS=60',
        'CROSS_PLATFORM_STABILITY_BPS=25',
        'CROSS_PLATFORM_CHUNK_FACTOR_MIN=0.6',
      ]);
    } else if (category === '执行失败') {
      appendLines(category, [
        'CROSS_PLATFORM_MAX_RETRIES=1',
        'CROSS_PLATFORM_RETRY_DELAY_MS=500',
        'CROSS_PLATFORM_ABORT_COOLDOWN_MS=120000',
      ]);
    } else if (category === '高波动') {
      appendLines(category, [
        'CROSS_PLATFORM_VOLATILITY_BPS=80',
        'CROSS_PLATFORM_STABILITY_SAMPLES=3',
      ]);
    } else if (category === '对冲失败') {
      appendLines(category, [
        'CROSS_PLATFORM_HEDGE_MIN_PROFIT_USD=0.02',
        'CROSS_PLATFORM_HEDGE_MIN_EDGE=0.01',
        'CROSS_PLATFORM_HEDGE_SLIPPAGE_BPS=450',
      ]);
    } else if (category === '未成交订单') {
      appendLines(category, ['CROSS_PLATFORM_POST_FILL_CHECK=true', 'CROSS_PLATFORM_USE_FOK=true']);
    } else if (category === '权限/密钥') {
      appendLines(category, ['# 请补齐 API_KEY / PRIVATE_KEY / JWT_TOKEN']);
    } else if (category === '熔断触发') {
      appendLines(category, [
        'CROSS_PLATFORM_CIRCUIT_MAX_FAILURES=3',
        'CROSS_PLATFORM_CIRCUIT_COOLDOWN_MS=120000',
      ]);
    } else if (category === '冷却触发') {
      appendLines(category, [
        'CROSS_PLATFORM_GLOBAL_MIN_QUALITY=0.8',
        'CROSS_PLATFORM_GLOBAL_COOLDOWN_MS=120000',
      ]);
    } else if (category === '映射/依赖') {
      appendLines(category, ['# 检查 cross-platform-mapping.json 与 dependency-constraints.json']);
    } else if (category === '网络/请求') {
      appendLines(category, ['ARB_WS_HEALTH_LOG_MS=5000', 'PREDICT_WS_STALE_MS=20000']);
    } else {
      appendLines(category, ['# 先应用保守档位再观察。']);
    }
  });
  return template.join('\n');
}

function applyFixTemplate() {
  const template = buildFixTemplate();
  let text = envEditor.value || '';
  const lines = template.split('\n').filter(Boolean);
  for (const line of lines) {
    if (line.startsWith('#')) {
      continue;
    }
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    text = setEnvValue(text, key, value);
  }
  envEditor.value = text;
  detectTradingMode(text);
  syncTogglesFromEnv(text);
  updateMetricsPaths();
  pushLog({ type: 'system', level: 'system', message: '已应用修复建议模板（请保存生效）' });
}

function renderRiskBreakdown(breakdown) {
  if (!riskBreakdownList) return;
  riskBreakdownList.innerHTML = '';
  if (!breakdown || breakdown.length === 0) {
    const item = document.createElement('div');
    item.className = 'health-item ok';
    item.textContent = '暂无风险来源。';
    riskBreakdownList.appendChild(item);
    return;
  }
  breakdown.forEach((entry) => {
    const row = document.createElement('div');
    row.className = 'health-item warn';
    const label = document.createElement('div');
    label.className = 'health-label';
    label.textContent = entry.label;
    const hint = document.createElement('div');
    hint.className = 'health-hint';
    hint.textContent = `+${entry.score}`;
    row.appendChild(label);
    row.appendChild(hint);
    riskBreakdownList.appendChild(row);
  });
}

function renderConsistencyFailures() {
  if (!metricConsistencyList) return;
  const counts = new Map();
  for (const event of failureEvents) {
    if (!event?.isConsistency) continue;
    const reason = event.reason || '一致性异常';
    counts.set(reason, (counts.get(reason) || 0) + 1);
  }
  metricConsistencyList.innerHTML = '';
  if (!counts.size) {
    const item = document.createElement('div');
    item.className = 'health-item ok';
    item.textContent = '暂无一致性失败记录。';
    metricConsistencyList.appendChild(item);
    return;
  }
  const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  entries.forEach(([reason, count]) => {
    const row = document.createElement('div');
    row.className = 'health-item warn';
    const label = document.createElement('div');
    label.className = 'health-label';
    label.textContent = reason;
    const hint = document.createElement('div');
    hint.className = 'health-hint';
    hint.textContent = `${count} 次`;
    row.appendChild(label);
    row.appendChild(hint);
    metricConsistencyList.appendChild(row);
  });
}

function renderConsistencyHotspots() {
  if (!metricConsistencyHotspots) return;
  const buckets = buildConsistencyHeatmapSeries();
  const entries = buckets
    .map((count, idx) => ({ count, hour: idx }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  metricConsistencyHotspots.innerHTML = '';
  if (!entries.length) {
    const item = document.createElement('div');
    item.className = 'health-item ok';
    item.textContent = '暂无一致性热区。';
    metricConsistencyHotspots.appendChild(item);
    return;
  }
  entries.forEach((entry) => {
    const row = document.createElement('div');
    row.className = 'health-item warn';
    const label = document.createElement('div');
    label.className = 'health-label';
    const hourLabel = String(entry.hour).padStart(2, '0');
    label.textContent = `${hourLabel}:00`;
    const hint = document.createElement('div');
    hint.className = 'health-hint';
    hint.textContent = `${entry.count} 次`;
    row.appendChild(label);
    row.appendChild(hint);
    metricConsistencyHotspots.appendChild(row);
  });
}

function computeConsistencyFailureRate() {
  const now = Date.now();
  const cutoff = now - 60 * 60 * 1000;
  let total = 0;
  let consistency = 0;
  for (const event of failureEvents) {
    if (!event?.ts) continue;
    if (event.ts < cutoff) continue;
    total += 1;
    if (event.isConsistency) consistency += 1;
  }
  if (!total) return 0;
  return (consistency / total) * 100;
}

function formatNumber(value, digits = 0) {
  if (!Number.isFinite(value)) return '--';
  return Number(value).toFixed(digits);
}

function formatMs(value) {
  if (!Number.isFinite(value)) return '--';
  return `${Math.round(Number(value))} ms`;
}

function formatBps(value) {
  if (!Number.isFinite(value)) return '--';
  return `${Number(value).toFixed(1)} bps`;
}

function formatTimestamp(ts) {
  if (!Number.isFinite(ts) || !ts) return '--';
  const date = new Date(Number(ts));
  if (Number.isNaN(date.getTime())) return '--';
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

function setMetricText(el, text) {
  if (!el) return;
  el.textContent = text;
}

function setMmStatus(text, active) {
  if (!mmStatus) return;
  mmStatus.textContent = text;
  mmStatus.style.background = active ? 'rgba(81, 209, 182, 0.2)' : 'rgba(247, 196, 108, 0.15)';
  mmStatus.style.color = active ? '#51d1b6' : '#f7c46c';
  mmStatus.style.borderColor = active ? 'rgba(81, 209, 182, 0.45)' : 'rgba(247, 196, 108, 0.35)';
}

function renderHealthItems(items) {
  if (!healthList) return;
  healthList.innerHTML = '';
  if (!items || items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'health-item';
    empty.textContent = '暂无体检结果。';
    healthList.appendChild(empty);
    return;
  }
  items.forEach((item) => {
    const row = document.createElement('div');
    row.className = `health-item ${item.level}`;
    const label = document.createElement('div');
    label.className = 'health-label';
    label.textContent = item.title;
    const hint = document.createElement('div');
    hint.className = 'health-hint';
    hint.textContent = item.message;
    row.appendChild(label);
    row.appendChild(hint);
    healthList.appendChild(row);
  });
}

function updateHealthStatus(items) {
  if (!items || items.length === 0) {
    setHealthStatus('无数据', 'warn');
    return;
  }
  const hasError = items.some((item) => item.level === 'error');
  const hasWarn = items.some((item) => item.level === 'warn');
  if (hasError) {
    setHealthStatus('存在问题', 'error');
  } else if (hasWarn) {
    setHealthStatus('有提示', 'warn');
  } else {
    setHealthStatus('通过', 'ok');
  }
}

function renderAdvice(items, metricsSnapshot) {
  if (!healthAdviceList) return;
  const advice = [];
  const hasError = (items || []).some((item) => item.level === 'error');
  const hasWarn = (items || []).some((item) => item.level === 'warn');
  if (hasError) {
    advice.push('先修复红色错误项，再尝试启动做市/套利。');
  }
  if (hasWarn) {
    advice.push('黄色提示项建议补齐，能显著降低执行失败。');
  }
  if (metricsSnapshot) {
    if (metricsSnapshot.successRate < 60) {
      advice.push('成功率偏低：建议提高 VWAP 保护或减小下单量。');
    }
    if (metricsSnapshot.failureRate > 40) {
      advice.push('失败率偏高：建议提高稳定窗口、缩小深度使用并启用更严格预检。');
    }
    if (metricsSnapshot.preflightFailRate > 20) {
      advice.push('预检失败率偏高：建议校验映射表、提高最小利润门槛。');
    }
    if (metricsSnapshot.postFailRate > 10) {
      advice.push('成交后失败率偏高：建议提高 post-trade drift 阈值或降低执行并发。');
    }
    if (metricsSnapshot.postTradeDriftBps > metricsSnapshot.driftLimit) {
      advice.push('Post-trade drift 偏高：建议加大分块/缩小深度使用。');
    }
    if (metricsSnapshot.qualityScore < metricsSnapshot.minQuality) {
      advice.push('质量分偏低：建议开启自动降级或暂时降低频率。');
    }
    if (metricsSnapshot.depthPenalty > 0.2) {
      advice.push('腿间深度不对称加重：建议提高深度比软阈值或缩小下单量。');
    }
    if (metricsSnapshot.consistencyOverrideActive) {
      advice.push('一致性降级已触发：建议降低并发或提升稳定性阈值。');
    }
    if (metricsSnapshot.consistencyHigh) {
      advice.push('一致性失败偏高：建议开启“一致性模板”或提高一致性阈值。');
    }
  }
  if (failureCounts.size > 0) {
    const categories = new Map();
    for (const [line, count] of failureCounts.entries()) {
      const category = classifyFailure(line);
      categories.set(category, (categories.get(category) || 0) + count);
    }
    const topCategory = Array.from(categories.entries()).sort((a, b) => b[1] - a[1])[0];
    if (topCategory) {
      advice.push(`当前高频问题：${topCategory[0]}（${topCategory[1]}次），建议优先排查。`);
    }
  }
  if (!advice.length) {
    advice.push('运行良好，无需额外调整。');
  }
  healthAdviceList.innerHTML = '';
  advice.forEach((text) => {
    const row = document.createElement('div');
    row.className = 'health-item ok';
    row.textContent = text;
    healthAdviceList.appendChild(row);
  });
}

async function runDiagnostics() {
  if (!window.predictBot.runDiagnostics) {
    setHealthStatus('不可用', 'error');
    return;
  }
  setHealthStatus('检测中', 'warn');
  const result = await window.predictBot.runDiagnostics();
  if (!result || !result.ok) {
    setHealthStatus('失败', 'error');
    renderHealthItems([{ level: 'error', title: '体检失败', message: result?.message || '未知错误' }]);
    return;
  }
  renderHealthItems(result.items || []);
  updateHealthStatus(result.items || []);
  renderAdvice(result.items || [], null);
}

async function exportDiagnostics() {
  if (!window.predictBot.exportDiagnostics) {
    if (healthExportHint) healthExportHint.textContent = '当前版本不支持导出诊断包。';
    return;
  }
  const result = await window.predictBot.exportDiagnostics();
  if (!result || !result.ok) {
    if (healthExportHint) {
      healthExportHint.textContent = result?.message || '导出失败，请稍后重试。';
    }
    return;
  }
  if (healthExportHint) {
    healthExportHint.textContent = `诊断包已导出：${result.path}`;
  }
}

function drawSparkline(canvas, values, color) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const width = canvas.clientWidth || canvas.width;
  const height = canvas.clientHeight || canvas.height;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  ctx.scale(ratio, ratio);

  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (!values.length) {
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    return;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  values.forEach((value, idx) => {
    const x = (idx / (values.length - 1 || 1)) * (width - 4) + 2;
    const y = height - ((value - min) / range) * (height - 8) - 4;
    if (idx === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();
}

function drawHeatmap(canvas, values, color) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const width = canvas.clientWidth || canvas.width;
  const height = canvas.clientHeight || canvas.height;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  ctx.scale(ratio, ratio);

  ctx.clearRect(0, 0, width, height);
  if (!values.length) {
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(0, 0, width, height);
    return;
  }
  const max = Math.max(...values, 1);
  const barWidth = width / values.length;
  values.forEach((value, idx) => {
    const intensity = Math.max(0, Math.min(1, value / max));
    const alpha = 0.15 + intensity * 0.75;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    const x = idx * barWidth;
    ctx.fillRect(x, 0, barWidth - 1, height);
  });
  ctx.globalAlpha = 1;
}

function updateCharts() {
  const successSeries = metricsHistory.map((item) => item.successRate);
  const driftSeries = metricsHistory.map((item) => item.postTradeDriftBps);
  const riskSeries = metricsHistory.map((item) => item.riskScore);
  const failureSeries = metricsHistory.map((item) => item.failureRate || 0);
  const preflightSeries = metricsHistory.map((item) => item.preflightFailRate || 0);
  const postSeries = metricsHistory.map((item) => item.postFailRate || 0);
  const consistencySeries = buildConsistencyHeatmapSeries();
  drawSparkline(chartSuccess, successSeries, '#6aa3ff');
  drawSparkline(chartDrift, driftSeries, '#f7c46c');
  drawSparkline(chartRisk, riskSeries, '#ff6b6b');
  drawSparkline(chartFailure, failureSeries, '#f07ca2');
  drawSparkline(chartFailPreflight, preflightSeries, '#9b8cff');
  drawSparkline(chartFailPost, postSeries, '#6dd3ce');
  drawHeatmap(chartConsistency, consistencySeries, '#ff9f43');
}

function buildConsistencyHeatmapSeries() {
  const buckets = new Array(24).fill(0);
  const now = Date.now();
  for (const event of failureEvents) {
    if (!event?.isConsistency || !event?.ts) continue;
    const ageMs = now - event.ts;
    if (ageMs < 0 || ageMs > 24 * 60 * 60 * 1000) continue;
    const hourIndex = Math.floor(ageMs / (60 * 60 * 1000));
    const bucket = Math.max(0, Math.min(23, 23 - hourIndex));
    buckets[bucket] += 1;
  }
  return buckets;
}

function updateAlerts({
  successRate,
  failureRate,
  preflightFailRate,
  postFailRate,
  postTradeDriftBps,
  qualityScore,
  consistencyOverrideActive,
  consistencyFailureRate,
  cooldownUntil,
  metricsAgeMs,
}) {
  if (!metricAlertsList) return;
  const env = parseEnv(envEditor.value || '');
  const minQuality = Number(env.get('CROSS_PLATFORM_GLOBAL_MIN_QUALITY') || 0.7);
  const driftLimit = Number(env.get('CROSS_PLATFORM_POST_TRADE_DRIFT_BPS') || 80);
  const failureWarn = 40;
  const preflightWarn = 20;
  const postWarn = 10;
  const warnings = [];

  if (metricsAgeMs > 60000) {
    warnings.push('指标更新超过 60 秒，可能数据过期。');
  }
  if (successRate < 60) {
    warnings.push('成功率偏低，建议提高滑点保护或缩小执行量。');
  }
  if (failureRate > failureWarn) {
    warnings.push('失败率偏高，建议缩小执行量并提高深度与价格校验阈值。');
  }
  if (preflightFailRate > preflightWarn) {
    warnings.push('预检失败率偏高，建议检查深度映射与目标平台报价稳定性。');
  }
  if (postFailRate > postWarn) {
    warnings.push('成交后漂移失败率偏高，建议提高稳定窗口或降低执行速度。');
  }
  if (postTradeDriftBps > driftLimit) {
    warnings.push('Post-trade drift 偏高，建议检查深度与映射准确性。');
  }
  if (qualityScore < minQuality) {
    warnings.push('质量分偏低，系统可能触发降级或冷却。');
  }
  if (consistencyOverrideActive) {
    warnings.push('一致性保守模式中，已自动降低风险策略。');
  }
  if (consistencyFailureRate >= 25) {
    warnings.push('一致性失败率偏高，建议启用一致性模板或提升一致性阈值。');
  }
  if (cooldownUntil && cooldownUntil > Date.now()) {
    warnings.push('全局冷却中，执行将自动暂停。');
  }

  metricAlertsList.innerHTML = '';
  if (!warnings.length) {
    const ok = document.createElement('div');
    ok.className = 'alert-item ok';
    ok.textContent = '运行正常，未发现异常指标。';
    metricAlertsList.appendChild(ok);
    return;
  }
  warnings.forEach((text) => {
    const item = document.createElement('div');
    item.className = 'alert-item warn';
    item.textContent = text;
    metricAlertsList.appendChild(item);
  });
}

function computeRiskLevel({
  successRate,
  failureRate,
  preflightFailRate,
  postFailRate,
  postTradeDriftBps,
  qualityScore,
  depthPenalty,
  consistencyOverrideActive,
  metricsAgeMs,
}) {
  let score = 0;
  const breakdown = [];

  if (metricsAgeMs > 60000) {
    const weighted = 20 * riskWeights.stale;
    score += weighted;
    breakdown.push({ label: `指标过期 x${riskWeights.stale.toFixed(1)}`, score: weighted.toFixed(1) });
  }
  if (successRate < 40) {
    const weighted = 40 * riskWeights.success;
    score += weighted;
    breakdown.push({ label: `成功率过低 x${riskWeights.success.toFixed(1)}`, score: weighted.toFixed(1) });
  } else if (successRate < 60) {
    const weighted = 25 * riskWeights.success;
    score += weighted;
    breakdown.push({ label: `成功率偏低 x${riskWeights.success.toFixed(1)}`, score: weighted.toFixed(1) });
  } else if (successRate < 75) {
    const weighted = 10 * riskWeights.success;
    score += weighted;
    breakdown.push({ label: `成功率一般 x${riskWeights.success.toFixed(1)}`, score: weighted.toFixed(1) });
  }
  if (failureRate > 40) {
    const weighted = Math.min(30, (failureRate - 40) * 0.6);
    score += weighted;
    breakdown.push({ label: '失败率偏高', score: weighted.toFixed(1) });
  }
  if (preflightFailRate > 20) {
    const weighted = Math.min(20, (preflightFailRate - 20) * 0.8);
    score += weighted;
    breakdown.push({ label: '预检失败率偏高', score: weighted.toFixed(1) });
  }
  if (postFailRate > 10) {
    const weighted = Math.min(25, (postFailRate - 10) * 1.2);
    score += weighted;
    breakdown.push({ label: '成交后失败偏高', score: weighted.toFixed(1) });
  }
  if (postTradeDriftBps > 120) {
    const weighted = 30 * riskWeights.drift;
    score += weighted;
    breakdown.push({ label: `漂移过高 x${riskWeights.drift.toFixed(1)}`, score: weighted.toFixed(1) });
  } else if (postTradeDriftBps > 80) {
    const weighted = 20 * riskWeights.drift;
    score += weighted;
    breakdown.push({ label: `漂移偏高 x${riskWeights.drift.toFixed(1)}`, score: weighted.toFixed(1) });
  } else if (postTradeDriftBps > 50) {
    const weighted = 10 * riskWeights.drift;
    score += weighted;
    breakdown.push({ label: `漂移偏高 x${riskWeights.drift.toFixed(1)}`, score: weighted.toFixed(1) });
  }
  if (qualityScore < 0.6) {
    const weighted = 30 * riskWeights.quality;
    score += weighted;
    breakdown.push({ label: `质量分过低 x${riskWeights.quality.toFixed(1)}`, score: weighted.toFixed(1) });
  } else if (qualityScore < 0.8) {
    const weighted = 15 * riskWeights.quality;
    score += weighted;
    breakdown.push({ label: `质量分偏低 x${riskWeights.quality.toFixed(1)}`, score: weighted.toFixed(1) });
  }
  if (depthPenalty >= 0.3) {
    const weighted = 20 * riskWeights.quality;
    score += weighted;
    breakdown.push({ label: `深度惩罚偏高 x${riskWeights.quality.toFixed(1)}`, score: weighted.toFixed(1) });
  } else if (depthPenalty >= 0.15) {
    const weighted = 10 * riskWeights.quality;
    score += weighted;
    breakdown.push({ label: `深度惩罚上升 x${riskWeights.quality.toFixed(1)}`, score: weighted.toFixed(1) });
  }
  if (consistencyOverrideActive) {
    const weighted = 25 * riskWeights.consistency;
    score += weighted;
    breakdown.push({ label: `一致性降级 x${riskWeights.consistency.toFixed(1)}`, score: weighted.toFixed(1) });
  }

  score = Math.max(0, Math.min(100, score));

  if (score >= 70) return { level: '高风险', tone: 'error', score, breakdown };
  if (score >= 40) return { level: '中风险', tone: 'warn', score, breakdown };
  return { level: '低风险', tone: 'ok', score, breakdown };
}

async function loadMetrics() {
  try {
    const raw = await window.predictBot.readMetrics();
    if (!raw) {
      setMetricsStatus('无数据', false);
      setRiskLevel('风险未知', 'warn');
      if (metricRiskScore) metricRiskScore.textContent = '--';
      if (metricRiskBar) metricRiskBar.style.width = '0%';
      renderRiskBreakdown([]);
      return;
    }
    let data;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      setMetricsStatus('解析失败', false);
      return;
    }

    const metrics = data.metrics || {};
    const attempts = Number(metrics.attempts || 0);
    const successes = Number(metrics.successes || 0);
    const failures = Number(metrics.failures || 0);
    const failureReasons = metrics.failureReasons || {};
    const failureEntries = Object.entries(failureReasons).filter(([, v]) => Number(v) > 0);
    const hasAdvice = failureEntries.length > 0;
    const preflightFailures = Number(failureReasons.preflight || 0);
    const postFailures = Number(failureReasons.postTrade || 0);
    const successRate = attempts > 0 ? (successes / attempts) * 100 : 0;
    const failureRate = attempts > 0 ? (failures / attempts) * 100 : 0;
    const preflightFailRate = attempts > 0 ? (preflightFailures / attempts) * 100 : 0;
    const postFailRate = attempts > 0 ? (postFailures / attempts) * 100 : 0;
    const postTradeDriftBps = Number(metrics.emaPostTradeDriftBps || 0);
    const updatedAt = Number(data.ts || 0);
    const metricsAgeMs = updatedAt ? Date.now() - updatedAt : Infinity;

    setMetricText(metricSuccessRate, `${formatNumber(successRate, 1)}%`);
    setMetricText(metricSuccessRaw, `${successes}/${attempts} 成功`);
    setMetricText(metricFailureRate, `${formatNumber(failureRate, 1)}%`);
    setMetricText(metricPreflightRate, `${formatNumber(preflightFailRate, 1)}%`);
    setMetricText(metricPostFailRate, `${formatNumber(postFailRate, 1)}%`);
    setMetricText(metricAttempts, `${attempts}`);
    setMetricText(metricPreflight, formatMs(metrics.emaPreflightMs));
    setMetricText(metricExec, formatMs(metrics.emaExecMs));
    setMetricText(metricTotal, formatMs(metrics.emaTotalMs));
    setMetricText(metricPostDrift, formatBps(postTradeDriftBps));
    setMetricText(metricQuality, formatNumber(data.qualityScore, 2));
    if (metricDepthPenalty) {
      const penalty = Number(data.depthRatioPenalty || 0);
      setMetricText(metricDepthPenalty, `${formatNumber(penalty * 100, 1)}%`);
    }
    if (metricConsistencyFail && metricConsistencyReason) {
      const failAt = Number(data.lastConsistencyFailureAt || 0);
      metricConsistencyFail.textContent = failAt ? formatTimestamp(failAt) : '暂无';
      const reason = typeof data.lastConsistencyFailureReason === 'string' ? data.lastConsistencyFailureReason : '';
      metricConsistencyReason.textContent = reason || '暂无记录';
    }
    if (metricConsistencyOverride) {
      const overrideUntil = Number(data.consistencyOverrideUntil || 0);
      const templateUntil = Number(data.consistencyTemplateActiveUntil || 0);
      const until = Math.max(overrideUntil, templateUntil);
      metricConsistencyOverride.textContent = until && until > Date.now() ? `保守中：${formatTimestamp(until)}` : '未触发';
    }
    if (consistencyBadge) {
      const templateUntil = Number(data.consistencyTemplateActiveUntil || 0);
      const overrideUntil = Number(data.consistencyOverrideUntil || 0);
      if (templateUntil > Date.now()) {
        setConsistencyBadge('一致性模板中', 'warn');
      } else if (overrideUntil > Date.now()) {
        setConsistencyBadge('一致性保守中', 'warn');
      } else {
        setConsistencyBadge('一致性正常', 'ok');
      }
    }
    setMetricText(metricChunkFactor, formatNumber(data.chunkFactor, 2));
    setMetricText(metricChunkDelay, formatMs(data.chunkDelayMs));
    setMetricText(metricAlerts, `${metrics.postTradeAlerts || 0}`);
    setMetricText(metricSoftBlocks, `${metrics.softBlocks || 0}`);
    setMetricText(metricBlockedTokens, `${(data.blockedTokens || []).length}`);
    setMetricText(metricBlockedPlatforms, `${(data.blockedPlatforms || []).length}`);
    const cooldownUntil = Number(data.globalCooldownUntil || 0);
    setMetricText(
      metricCooldown,
      cooldownUntil && cooldownUntil > Date.now() ? `冷却中：${formatTimestamp(cooldownUntil)}` : '未触发'
    );
    setMetricText(metricLastError, metrics.lastError || '无');
    setMetricText(metricUpdatedAt, formatTimestamp(updatedAt));
    renderMetricFailureReasons(metrics.failureReasons);

    const consistencyActiveValue = Math.max(
      Number(data.consistencyOverrideUntil || 0),
      Number(data.consistencyTemplateActiveUntil || 0)
    );
    const consistencyActive = consistencyActiveValue > Date.now() ? 100 : 0;

    if (updatedAt && successRate >= 0) {
      const last = metricsHistory[metricsHistory.length - 1];
      if (!last || last.ts !== updatedAt) {
        metricsHistory.push({
          ts: updatedAt,
          successRate,
          postTradeDriftBps,
          riskScore: 0,
          failureRate,
          preflightFailRate,
          postFailRate,
          consistencyActive,
        });
        if (metricsHistory.length > METRICS_HISTORY_MAX) {
          metricsHistory.shift();
        }
      }
    }

    updateCharts();
    const consistencyFailureRate = computeConsistencyFailureRate();
    const metricsSnapshot = {
      successRate,
      postTradeDriftBps,
      qualityScore: Number(data.qualityScore || 0),
      depthPenalty: Number(data.depthRatioPenalty || 0),
      cooldownUntil,
      metricsAgeMs,
      failureRate,
      preflightFailRate,
      postFailRate,
      driftLimit: Number(parseEnv(envEditor.value || '').get('CROSS_PLATFORM_POST_TRADE_DRIFT_BPS') || 80),
      minQuality: Number(parseEnv(envEditor.value || '').get('CROSS_PLATFORM_GLOBAL_MIN_QUALITY') || 0.7),
      consistencyOverrideActive: consistencyActive > 0,
      consistencyFailureRate,
      consistencyHigh: consistencyFailureRate >= 25,
    };
    updateAlerts(metricsSnapshot);
    renderAdvice(null, metricsSnapshot);
    const risk = computeRiskLevel(metricsSnapshot);
    setRiskLevel(risk.level, risk.tone);
    if (metricRiskScore) metricRiskScore.textContent = `${Math.round(risk.score)}`;
    if (metricRiskBar) metricRiskBar.style.width = `${Math.min(100, Math.max(0, risk.score))}%`;
    renderRiskBreakdown(risk.breakdown);
    const last = metricsHistory[metricsHistory.length - 1];
    if (last && last.ts === updatedAt) {
      last.riskScore = risk.score;
    }
    updateCharts();
    renderMetricFailureAdvice(metrics.failureReasons, metricsSnapshot);
    renderConsistencyFailures();
    renderConsistencyHotspots();
    const changedCount = renderFixSummary();
    const hasPendingSave = !!(saveEnvButton && saveEnvButton.classList.contains('attention'));
    if (changedCount === 0) {
      renderFlowStatus({ appliedFixes: true, saved: true, hasAdvice });
    } else if (hasPendingSave) {
      renderFlowStatus({ appliedFixes: true, saved: false, hasAdvice });
    } else {
      renderFlowStatus({ appliedFixes: false, saved: false, hasAdvice });
    }
    renderSaveHint({ hasPendingSave });

    const flushMs = Number(parseEnv(envEditor.value || '').get('CROSS_PLATFORM_METRICS_FLUSH_MS') || 30000);
    if (metricsAgeMs > flushMs * 2) {
      setMetricsStatus('数据过期', false);
    } else {
      setMetricsStatus('已更新', true);
    }
  } catch (error) {
    setMetricsStatus('读取失败', false);
    setRiskLevel('风险未知', 'warn');
    if (metricRiskScore) metricRiskScore.textContent = '--';
    if (metricRiskBar) metricRiskBar.style.width = '0%';
    renderRiskBreakdown([]);
  }
}

async function loadMmMetrics() {
  if (!window.predictBot.readMmMetrics) return;
  try {
    const raw = await window.predictBot.readMmMetrics();
    if (!raw) {
      setMmStatus('无数据', false);
      return;
    }
    const data = JSON.parse(raw);
    setMmStatus('已更新', true);
    const halted = data.tradingHalted ? '已熔断' : '运行中';
    setMetricText(mmTradingStatus, halted);
    setMetricText(mmPnL, data.sessionPnL !== undefined ? data.sessionPnL.toFixed(2) : '--');
    setMetricText(mmOpenOrders, `${data.openOrders ?? '--'}`);
    setMetricText(mmPositions, `${data.positions ?? '--'}`);

    if (mmMarketsList) {
      mmMarketsList.innerHTML = '';
      const markets = Array.isArray(data.markets) ? data.markets : [];
      const top = markets.slice(0, 8);
      if (top.length === 0) {
        const item = document.createElement('div');
        item.className = 'health-item ok';
        item.textContent = '暂无数据。';
        mmMarketsList.appendChild(item);
      } else {
        top.forEach((m) => {
          const row = document.createElement('div');
          row.className = 'health-item warn';
          const label = document.createElement('div');
          label.className = 'health-label';
          label.textContent = `${m.question || m.tokenId || 'Unknown'} | ${m.profile}`;
          const hint = document.createElement('div');
          hint.className = 'health-hint';
          const spreadPct = m.spread ? (m.spread * 100).toFixed(2) : '--';
          const vol = m.volEma ? (m.volEma * 100).toFixed(2) : '--';
          const depth = m.depthEma ? m.depthEma.toFixed(0) : '--';
          hint.textContent = `spread=${spreadPct}% vol=${vol} depth=${depth}`;
          row.appendChild(label);
          row.appendChild(hint);
          mmMarketsList.appendChild(row);
        });
      }
    }
  } catch (error) {
    setMmStatus('读取失败', false);
  }
}

function activateTab(name) {
  tabButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === name);
  });
  tabPanels.forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.tab === name);
  });
  if (name === 'mapping' && !mappingEditor.value) {
    loadMapping().catch(() => {});
  }
  if (name === 'dependency' && !dependencyEditor.value) {
    loadDependency().catch(() => {});
  }
}

async function startBot(type) {
  const result = await window.predictBot.startBot(type);
  if (!result.ok) {
    pushLog({ type, level: 'stderr', message: result.message || '启动失败' });
  }
}

async function stopBot(type) {
  const result = await window.predictBot.stopBot(type);
  if (!result.ok) {
    pushLog({ type, level: 'stderr', message: result.message || '停止失败' });
  }
}

async function init() {
  await loadEnv();
  await Promise.all([loadMapping().catch(() => {}), loadDependency().catch(() => {})]);
  const status = await window.predictBot.getStatus();
  updateStatusDisplay(status);
  setGlobalStatus('已连接', false);
  loadRiskWeights();
  loadWeightPresets();
  loadLogFilterPresets();
  updateRiskWeightsUI();
  updateWeightPresetSelect();
  bindRiskWeightInputs();
  updateLogFilterPresetSelect();
  bindLogFilterPresets();
  await loadMetrics();
  await loadMmMetrics();
  await runDiagnostics();
}

window.predictBot.onLog((payload) => {
  const lines = payload.message.split('\n').filter(Boolean);
  for (const line of lines) {
    pushLog({ type: payload.type, level: payload.level, message: line });
  }
});

window.predictBot.onStatus((payload) => {
  updateStatusDisplay(payload);
});

logFilter.addEventListener('change', renderLogs);
failureCategoryFilter.addEventListener('change', renderLogs);
logKeyword.addEventListener('input', renderLogs);

document.getElementById('clearLog').addEventListener('click', () => {
  logs.length = 0;
  renderLogs();
});

document.getElementById('reloadEnv').addEventListener('click', loadEnv);
document.getElementById('saveEnv').addEventListener('click', saveEnv);
document.getElementById('reloadMapping').addEventListener('click', loadMapping);
document.getElementById('saveMapping').addEventListener('click', saveMapping);
document.getElementById('reloadDependency').addEventListener('click', loadDependency);
document.getElementById('saveDependency').addEventListener('click', saveDependency);

document.getElementById('startMM').addEventListener('click', () => startBot('mm'));
document.getElementById('stopMM').addEventListener('click', () => stopBot('mm'));
document.getElementById('startArb').addEventListener('click', () => startBot('arb'));
document.getElementById('stopArb').addEventListener('click', () => stopBot('arb'));

document.getElementById('setDry').addEventListener('click', () => {
  envEditor.value = setEnvValue(envEditor.value, 'ENABLE_TRADING', 'false');
  detectTradingMode(envEditor.value);
  syncTogglesFromEnv(envEditor.value);
});

document.getElementById('setLive').addEventListener('click', () => {
  envEditor.value = setEnvValue(envEditor.value, 'ENABLE_TRADING', 'true');
  detectTradingMode(envEditor.value);
  syncTogglesFromEnv(envEditor.value);
});

document.getElementById('applyToggles').addEventListener('click', applyToggles);
toggleInputs.forEach((input) => {
  input.addEventListener('change', applyToggles);
});

envEditor.addEventListener('input', () => {
  syncTogglesFromEnv(envEditor.value);
  updateMetricsPaths();
  updateFixPreview();
});

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => activateTab(btn.dataset.tab || 'env'));
});

refreshMetrics.addEventListener('click', loadMetrics);
runDiagnosticsBtn.addEventListener('click', runDiagnostics);
exportDiagnosticsBtn.addEventListener('click', exportDiagnostics);
copyFailuresBtn.addEventListener('click', copyFailures);
if (copyFixTemplateBtn) {
  copyFixTemplateBtn.addEventListener('click', copyFixTemplate);
}
downgradeProfileBtn.addEventListener('click', () => applyDowngradeProfile('safe'));
downgradeSafeBtn.addEventListener('click', () => applyDowngradeProfile('safe'));
downgradeUltraBtn.addEventListener('click', () => applyDowngradeProfile('ultra'));
applyFixTemplateBtn.addEventListener('click', applyFixTemplate);
if (applyConsistencyTemplateBtn) {
  applyConsistencyTemplateBtn.addEventListener('click', applyConsistencyTemplate);
}
refreshMmMetrics.addEventListener('click', loadMmMetrics);
if (applyMmPassiveBtn) {
  applyMmPassiveBtn.addEventListener('click', applyMmPassiveTemplate);
}
if (applyArbSafeBtn) {
  applyArbSafeBtn.addEventListener('click', applyArbSafeTemplate);
}

init().catch((err) => {
  pushLog({ type: 'system', level: 'stderr', message: err?.message || '初始化失败' });
});

setInterval(() => {
  loadMetrics().catch(() => {});
  loadMmMetrics().catch(() => {});
}, 5000);
