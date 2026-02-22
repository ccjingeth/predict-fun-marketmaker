const envEditor = document.getElementById('envEditor');
const mappingEditor = document.getElementById('mappingEditor');
const mappingMissingList = document.getElementById('mappingMissingList');
const mappingCheckMissingBtn = document.getElementById('mappingCheckMissing');
const mappingGenerateTemplateBtn = document.getElementById('mappingGenerateTemplate');
const mappingSuggestPredictBtn = document.getElementById('mappingSuggestPredict');
const mappingAutoCleanupBtn = document.getElementById('mappingAutoCleanup');
const mappingExportConfirmedBtn = document.getElementById('mappingExportConfirmed');
const mappingCopyTemplateBtn = document.getElementById('mappingCopyTemplate');
const mappingRestoreLatestBtn = document.getElementById('mappingRestoreLatest');
const mappingHideUnconfirmed = document.getElementById('mappingHideUnconfirmed');
const mappingHideLowScore = document.getElementById('mappingHideLowScore');
const mappingAutoSaveToggle = document.getElementById('mappingAutoSave');
const mappingAutoReloadToggle = document.getElementById('mappingAutoReload');
const mappingAutoRescanToggle = document.getElementById('mappingAutoRescan');
const mappingAutoBackupToggle = document.getElementById('mappingAutoBackup');
const mappingAutoWsKickToggle = document.getElementById('mappingAutoWsKick');
const mappingBackupList = document.getElementById('mappingBackupList');
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
const mmVenueSelect = document.getElementById('mmVenueSelect');
const applyMmPassiveBtn = document.getElementById('applyMmPassive');
const applyMmProbablePointsBtn = document.getElementById('applyMmProbablePoints');
const applyMmProbableHedgeBtn = document.getElementById('applyMmProbableHedge');
const applyArbSafeBtn = document.getElementById('applyArbSafe');
const tabButtons = Array.from(document.querySelectorAll('.tab-button'));
const tabPanels = Array.from(document.querySelectorAll('.tab-panel'));
const metricsStatus = document.getElementById('metricsStatus');
const arbSnapshotStatus = document.getElementById('arbSnapshotStatus');
const refreshArbSnapshot = document.getElementById('refreshArbSnapshot');
const arbTypeFilter = document.getElementById('arbTypeFilter');
const arbPlatformFilter = document.getElementById('arbPlatformFilter');
const resetPlatformFilter = document.getElementById('resetPlatformFilter');
const arbMinReturn = document.getElementById('arbMinReturn');
const arbMinProfitUsd = document.getElementById('arbMinProfitUsd');
const arbOppList = document.getElementById('arbOppList');
const arbCommandHint = document.getElementById('arbCommandHint');
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
const metricConsistencyRateLimit = document.getElementById('metricConsistencyRateLimit');
const metricConsistencyTighten = document.getElementById('metricConsistencyTighten');
const metricConsistencyPressure = document.getElementById('metricConsistencyPressure');
const metricConsistencyPenalty = document.getElementById('metricConsistencyPenalty');
const metricConsistencySize = document.getElementById('metricConsistencySize');
const metricHardGate = document.getElementById('metricHardGate');
const metricAvoidHours = document.getElementById('metricAvoidHours');
const metricAvoidMode = document.getElementById('metricAvoidMode');
const metricAvoidSeverity = document.getElementById('metricAvoidSeverity');
const metricAvoidDecay = document.getElementById('metricAvoidDecay');
const metricWsHealthScore = document.getElementById('metricWsHealthScore');
const metricWsHealthTighten = document.getElementById('metricWsHealthTighten');
const metricConsistencyCooldown = document.getElementById('metricConsistencyCooldown');
let lastAutoAvoidHours = '';
let autoDisabledCrossPlatform = false;
let lastAvoidNoticeHour = -1;
let lastAvoidNoticeActive = false;
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
const applyConsistencyAvoidBtn = document.getElementById('applyConsistencyAvoid');
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
const runNewbieCheckBtn = document.getElementById('runNewbieCheck');
const applyBeginnerTemplateBtn = document.getElementById('applyBeginnerTemplate');
const newbieChecklist = document.getElementById('newbieChecklist');
const newbieHint = document.getElementById('newbieHint');
const runPreflightCheckBtn = document.getElementById('runPreflightCheck');
const copyPreflightChecklistBtn = document.getElementById('copyPreflightChecklist');
const preflightChecklist = document.getElementById('preflightChecklist');
const preflightHint = document.getElementById('preflightHint');
const runDiagnosticsBtn = document.getElementById('runDiagnostics');
const exportDiagnosticsBtn = document.getElementById('exportDiagnostics');
const copyFailuresBtn = document.getElementById('copyFailures');
const copyFixTemplateBtn = document.getElementById('copyFixTemplate');
const mmStatus = document.getElementById('mmStatus');
const mmTradingStatus = document.getElementById('mmTradingStatus');
const mmPnL = document.getElementById('mmPnL');
const mmOpenOrders = document.getElementById('mmOpenOrders');
const mmPositions = document.getElementById('mmPositions');
const mmWsHealth = document.getElementById('mmWsHealth');
const mmWsHealthHint = document.getElementById('mmWsHealthHint');
const mmHealthScore = document.getElementById('mmHealthScore');
const mmHealthBar = document.getElementById('mmHealthBar');
const mmRiskHint = document.getElementById('mmRiskHint');
const mmSafetyStatus = document.getElementById('mmSafetyStatus');
const mmMarketsList = document.getElementById('mmMarketsList');
const mmEventList = document.getElementById('mmEventList');
const mmEventHint = document.getElementById('mmEventHint');
const refreshMmMetrics = document.getElementById('refreshMmMetrics');
const exportMmEventsBtn = document.getElementById('exportMmEvents');
const enableRecoveryTemplateBtn = document.getElementById('enableRecoveryTemplate');
const disableRecoveryTemplateBtn = document.getElementById('disableRecoveryTemplate');
const recoveryTemplateHint = document.getElementById('recoveryTemplateHint');
const recoveryTemplateResetHint = document.getElementById('recoveryTemplateResetHint');
const applyRecoveryTemplateSafeBtn = document.getElementById('applyRecoveryTemplateSafe');
const applyRecoveryTemplateUltraBtn = document.getElementById('applyRecoveryTemplateUltra');
const applyRecoveryTemplateExtremeBtn = document.getElementById('applyRecoveryTemplateExtreme');
const applyRecoveryTemplateResetBtn = document.getElementById('applyRecoveryTemplateReset');

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
let arbSnapshot = null;
let arbCommandState = null;
let mmAutoDowngradeUntil = 0;
let lastAutoFailureFixAt = 0;
let latestMetrics = null;
let lastPreflightChecklist = [];
const FIX_HINTS = {
  CROSS_PLATFORM_ADAPTIVE_SIZE: '根据深度自动缩放下单量',
  CROSS_PLATFORM_DEPTH_USAGE: '使用的盘口深度比例',
  CROSS_PLATFORM_MIN_TOP_DEPTH_SHARES: '顶层最小份额过滤（防止过薄）',
  CROSS_PLATFORM_MIN_TOP_DEPTH_USD: '顶层最小深度（USD）',
  CROSS_PLATFORM_TOP_DEPTH_USAGE: '顶层深度使用比例（0-1）',
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
  CROSS_PLATFORM_FAILURE_RATE_WINDOW_MS: '失败率统计窗口（ms）',
  CROSS_PLATFORM_FAILURE_RATE_MIN_ATTEMPTS: '失败率统计最小样本数',
  CROSS_PLATFORM_FAILURE_RATE_THRESHOLD: '失败率触发阈值（%）',
  CROSS_PLATFORM_FAILURE_RATE_TIGHTEN_MAX: '失败率收紧最大倍数',
  CROSS_PLATFORM_FAILURE_RATE_STABILITY_SAMPLES_ADD: '失败率触发额外采样次数',
  CROSS_PLATFORM_FAILURE_RATE_STABILITY_INTERVAL_ADD_MS: '失败率触发额外采样间隔（ms）',
  CROSS_PLATFORM_FAILURE_RATE_STABILITY_MAX_SAMPLES: '失败率触发采样最大次数',
  CROSS_PLATFORM_FAILURE_RATE_STABILITY_MAX_INTERVAL_MS: '失败率触发采样最大间隔（ms）',
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
  MM_RISK_THROTTLE_ENABLED: '做市风险节流开关（异常自动降速/降量）',
  MM_RISK_THROTTLE_FILL_PENALTY: '成交触发节流惩罚',
  MM_RISK_THROTTLE_CANCEL_PENALTY: '撤单触发节流惩罚',
  MM_RISK_THROTTLE_NEAR_TOUCH_PENALTY: '近触碰触发节流惩罚',
  MM_RISK_THROTTLE_WINDOW_MS: '节流统计窗口（毫秒）',
  MM_RISK_THROTTLE_DECAY_MS: '节流衰减时间（毫秒）',
  MM_RISK_THROTTLE_MIN_FACTOR: '节流缩量/降速下限系数',
  MM_RISK_THROTTLE_MAX_FACTOR: '节流放大上限系数',
  MM_RISK_THROTTLE_COOL_OFF_MS: '节流冷静期（毫秒）',
  MM_RISK_THROTTLE_ONLY_FAR_THRESHOLD: '节流低于阈值仅挂远层',
  MM_RISK_THROTTLE_ONLY_FAR_LAYERS: '节流远层挂单数量',
  MM_RISK_THROTTLE_LAYER_CAP: '节流分层数量上限',
  MM_CANCEL_BURST_LIMIT: '撤单爆发阈值（窗口内最大撤单数）',
  MM_CANCEL_BURST_WINDOW_MS: '撤单爆发统计窗口（毫秒）',
  MM_CANCEL_BURST_COOLDOWN_MS: '撤单爆发冷却时间（毫秒）',
  MM_CANCEL_BURST_RETREAT_MS: '撤单爆发后撤退时长（毫秒）',
  MM_CANCEL_BURST_ONLY_FAR: '撤单爆发期间仅挂远层',
  MM_CANCEL_BURST_ONLY_FAR_LAYERS: '撤单爆发远层数量',
  MM_CANCEL_BURST_LAYER_CAP: '撤单爆发分层上限',
  MM_CANCEL_MAX_PER_CYCLE: '单轮撤单数量上限',
  MM_CANCEL_MAX_PER_CYCLE_PANIC_BYPASS: '紧急撤单绕过单轮上限',
  MM_FAST_CANCEL_BPS: '盘口极速变化撤单阈值（bps）',
  MM_FAST_CANCEL_WINDOW_MS: '极速变化判定窗口（ms）',
  MM_FAST_CANCEL_DEPTH_SPEED_BPS: '极速撤单需要的深度速度阈值（bps）',
  MM_FAST_CANCEL_SPREAD_JUMP_BPS: '极速撤单需要的价差跳变阈值（bps）',
  MM_PROTECTIVE_TEMPLATE_ENABLED: '保护档自动进入极限模板',
  MM_PROTECTIVE_SIZE_SCALE: '保护档缩量',
  MM_PROTECTIVE_TOUCH_BUFFER_ADD_BPS: '保护档额外缓冲',
  MM_DEPTH_SPEED_PAUSE_BPS: '深度速度超过阈值直接暂停做市（bps）',
  MM_DEPTH_SPEED_PAUSE_MS: '深度速度触发后的暂停时长（ms）',
  MM_PROTECTIVE_DEPTH_SPEED_BPS: '保护档触发所需深度速度（bps）',
  MM_PROTECTIVE_SPREAD_JUMP_BPS: '保护档触发所需价差跳变（bps）',
  MM_PROTECTIVE_TEMPLATE_ENABLED: '保护档启用内置极限模板',
  MM_PROTECTIVE_HOLD_MS: '保护档持续时间（ms）',
  MM_PROTECTIVE_MIN_INTERVAL_MS: '保护档最小下单间隔（ms）',
  MM_PROTECTIVE_LAYER_COUNT_CAP: '保护档最大挂单层数',
  MM_PROTECTIVE_ONLY_FAR: '保护档仅挂远层',
  MM_PROTECTIVE_FORCE_SINGLE: '保护档强制单层挂单',
  MM_PROTECTIVE_SINGLE_SIDE: '保护档固定单边方向',
  MM_PROTECTIVE_SINGLE_SIDE_MODE: '保护档单边模式（NORMAL/REMOTE）',
  MM_PROTECTIVE_SINGLE_SIDE_OFFSET_BPS: '保护档单边偏移（bps）',
  MM_PROTECTIVE_SINGLE_SIDE_AUTO: '保护档自动单边',
  MM_PROTECTIVE_SINGLE_SIDE_IMBALANCE_THRESHOLD: '保护档自动单边阈值',
  MM_PROTECTIVE_SIZE_SCALE: '保护档挂单份额缩放',
  MM_PROTECTIVE_TOUCH_BUFFER_ADD_BPS: '保护档额外盘口缓冲（bps）',
  ARB_MAX_VWAP_DEVIATION_BPS: 'VWAP 最大允许偏离（bps）',
  ARB_RECHECK_DEVIATION_BPS: '偏离过大时需要二次确认（bps）',
  ARB_MAX_VWAP_LEVELS: '限制 VWAP 使用的档位数',
  ARB_MIN_DEPTH_USD: '盘口最小深度（USD）',
  ARB_MIN_TOP_DEPTH_SHARES: '顶层最小份额（防止过薄）',
  ARB_MIN_TOP_DEPTH_USD: '顶层最小深度（USD）',
  ARB_TOP_DEPTH_USAGE: '顶层深度使用比例（0-1）',
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
  CROSS_PLATFORM_CONSISTENCY_TEMPLATE_TIGHTEN_UP: '一致性模板收紧幅度',
  CROSS_PLATFORM_CONSISTENCY_TEMPLATE_TIGHTEN_DOWN: '一致性模板放宽幅度',
  CROSS_PLATFORM_CONSISTENCY_TEMPLATE_TIGHTEN_MAX: '一致性模板收紧上限',
  CROSS_PLATFORM_CONSISTENCY_TEMPLATE_TIGHTEN_MIN: '一致性模板放宽下限',
  CROSS_PLATFORM_CONSISTENCY_RATE_LIMIT_MS: '一致性限速冷却（毫秒）',
  CROSS_PLATFORM_CONSISTENCY_RATE_LIMIT_THRESHOLD: '一致性限速阈值次数',
  CROSS_PLATFORM_CONSISTENCY_RATE_LIMIT_WINDOW_MS: '一致性限速统计窗口（毫秒）',
  CROSS_PLATFORM_AVOID_HOURS: '跨平台避开小时（0-23）',
  CROSS_PLATFORM_AVOID_HOURS_AUTO: '自动避开一致性热区',
  CROSS_PLATFORM_AVOID_HOURS_DECAY_DAYS: '避开时段衰减天数',
  CROSS_PLATFORM_CONSISTENCY_COOLDOWN_MS: '一致性冷却时长（毫秒）',
  CROSS_PLATFORM_CONSISTENCY_COOLDOWN_THRESHOLD: '一致性冷却阈值次数',
  CROSS_PLATFORM_CONSISTENCY_COOLDOWN_WINDOW_MS: '一致性冷却统计窗口（毫秒）',
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
  '深度不足': ['CROSS_PLATFORM_ADAPTIVE_SIZE', 'CROSS_PLATFORM_DEPTH_USAGE', 'CROSS_PLATFORM_CHUNK_MAX_SHARES'],
  '预检失败': [
    'CROSS_PLATFORM_STABILITY_SAMPLES',
    'CROSS_PLATFORM_STABILITY_INTERVAL_MS',
    'CROSS_PLATFORM_MIN_PROFIT_USD',
    'CROSS_PLATFORM_MIN_NOTIONAL_USD',
  ],
  'VWAP 偏离': ['CROSS_PLATFORM_SLIPPAGE_BPS', 'CROSS_PLATFORM_EXECUTION_VWAP_CHECK', 'CROSS_PLATFORM_RECHECK_MS'],
  '价格漂移': ['CROSS_PLATFORM_PRICE_DRIFT_BPS', 'CROSS_PLATFORM_RECHECK_MS', 'CROSS_PLATFORM_STABILITY_SAMPLES'],
  '成交后漂移': ['CROSS_PLATFORM_POST_TRADE_DRIFT_BPS', 'CROSS_PLATFORM_STABILITY_BPS', 'CROSS_PLATFORM_CHUNK_FACTOR_MIN'],
  '高波动': ['CROSS_PLATFORM_VOLATILITY_BPS', 'CROSS_PLATFORM_STABILITY_SAMPLES'],
  '执行失败': ['CROSS_PLATFORM_MAX_RETRIES', 'CROSS_PLATFORM_RETRY_DELAY_MS', 'CROSS_PLATFORM_ABORT_COOLDOWN_MS'],
  '对冲失败': ['CROSS_PLATFORM_HEDGE_MIN_PROFIT_USD', 'CROSS_PLATFORM_HEDGE_MIN_EDGE', 'CROSS_PLATFORM_HEDGE_SLIPPAGE_BPS'],
  '未成交订单': ['CROSS_PLATFORM_POST_FILL_CHECK', 'CROSS_PLATFORM_USE_FOK'],
  '熔断触发': ['CROSS_PLATFORM_CIRCUIT_MAX_FAILURES', 'CROSS_PLATFORM_CIRCUIT_COOLDOWN_MS'],
  '冷却触发': ['CROSS_PLATFORM_GLOBAL_MIN_QUALITY', 'CROSS_PLATFORM_GLOBAL_COOLDOWN_MS'],
  '映射/依赖': ['CROSS_PLATFORM_USE_MAPPING'],
  '网络/请求': ['ARB_WS_HEALTH_LOG_MS', 'PREDICT_WS_STALE_MS', 'CROSS_PLATFORM_RETRY_DELAY_MS'],
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

function ensureLogPreset(name, preset) {
  if (!logFilterPresets.has(name)) {
    logFilterPresets.set(name, preset);
    saveLogFilterPresets();
    updateLogFilterPresetSelect();
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

function parseJsonSafe(text, fallback = null) {
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function syncSelectsFromEnv(text) {
  const env = parseEnv(text);
  if (mmVenueSelect) {
    const raw = String(env.get('MM_VENUE') || 'predict').toLowerCase();
    mmVenueSelect.value = raw === 'probable' ? 'probable' : 'predict';
  }
}

function updateMetricsPaths() {
  const env = parseEnv(envEditor.value || '');
  const metricsPath = env.get('CROSS_PLATFORM_METRICS_PATH') || 'data/cross-platform-metrics.json';
  const statePath = env.get('CROSS_PLATFORM_STATE_PATH') || 'data/cross-platform-state.json';
  if (metricMetricsPath) metricMetricsPath.textContent = metricsPath;
  if (metricStatePath) metricStatePath.textContent = statePath;
}

function formatArbType(typeKey, type) {
  const key = String(typeKey || '').toLowerCase();
  if (key === 'intra') return '站内';
  if (key === 'cross') return '跨平台';
  if (key === 'multi') return '多结果';
  if (key === 'dependency') return '依赖';
  if (key === 'value') return '价值';
  const raw = String(type || '');
  if (raw.includes('IN_PLATFORM')) return '站内';
  if (raw.includes('CROSS_PLATFORM')) return '跨平台';
  if (raw.includes('MULTI_OUTCOME')) return '多结果';
  if (raw.includes('DEPENDENCY')) return '依赖';
  if (raw.includes('VALUE')) return '价值';
  return '其他';
}

function updateArbSnapshotStatus(snapshot) {
  if (!arbSnapshotStatus) return;
  if (!snapshot?.ts) {
    arbSnapshotStatus.textContent = '未加载';
    arbSnapshotStatus.style.color = '#f7c46c';
    return;
  }
  const age = Math.max(0, Date.now() - Number(snapshot.ts || 0));
  const sec = Math.round(age / 1000);
  arbSnapshotStatus.textContent = `更新 ${sec}s 前`;
  arbSnapshotStatus.style.color = sec > 30 ? '#f7c46c' : '#51d1b6';
}

function renderArbList() {
  if (!arbOppList) return;
  const snapshot = arbSnapshot || { items: [] };
  let items = Array.isArray(snapshot.items) ? snapshot.items.slice() : [];
  const typeFilter = arbTypeFilter ? arbTypeFilter.value : 'all';
  const minReturn = arbMinReturn ? parseFloat(arbMinReturn.value || '0') : 0;
  const minProfit = arbMinProfitUsd ? parseFloat(arbMinProfitUsd.value || '0') : 0;

  // 获取选中的平台
  const selectedPlatforms = arbPlatformFilter
    ? Array.from(arbPlatformFilter.selectedOptions).map(opt => opt.value)
    : ['Predict', 'Polymarket', 'Opinion', 'Probable'];

  // 类型过滤
  if (typeFilter && typeFilter !== 'all') {
    items = items.filter((item) => item.typeKey === typeFilter);
  }

  // 平台过滤
  items = items.filter((item) => {
    if (!item.legs || !Array.isArray(item.legs)) return true;
    // 检查是否包含至少一个选中的平台
    return item.legs.some((leg) => selectedPlatforms.includes(leg.platform));
  });

  // 收益过滤
  if (Number.isFinite(minReturn) && minReturn > 0) {
    items = items.filter((item) => Number(item.expectedReturn || 0) >= minReturn);
  }

  // 利润过滤
  if (Number.isFinite(minProfit) && minProfit > 0) {
    items = items.filter((item) => Number(item.profitUsd || 0) >= minProfit);
  }

  arbOppList.innerHTML = '';
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'health-item ok';
    empty.textContent = '暂无符合条件的机会。';
    arbOppList.appendChild(empty);
    return;
  }

  items.slice(0, 50).forEach((item) => {
    const row = document.createElement('div');
    row.className = 'arb-item';

    const header = document.createElement('div');
    header.className = 'arb-item-header';
    const title = document.createElement('div');
    title.className = 'arb-item-title';
    title.textContent = item.marketQuestion || item.marketId || '未知市场';
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = formatArbType(item.typeKey, item.type);
    header.appendChild(title);
    header.appendChild(badge);

    const meta = document.createElement('div');
    meta.className = 'arb-item-meta';
    const returnPct = Number(item.expectedReturn || 0);
    const profitUsd = Number(item.profitUsd || 0);
    const perShareCost = Number(item.perShareCost || 0);
    const perShareProceeds = Number(item.perShareProceeds || 0);
    const totalCostUsd = Number(item.totalCostUsd || 0);
    const totalProceedsUsd = Number(item.totalProceedsUsd || 0);
    const feesPerShare = Number(item.feesPerShare || 0);
    const slippagePerShare = Number(item.slippagePerShare || 0);
    const vwapLevels = Number(item.vwapLevels || 0);
    const vwapDeviationBps = Number(item.vwapDeviationBps || 0);
    const vwapPieces = [];
    if (perShareCost > 0) vwapPieces.push(`VWAP成本=${perShareCost.toFixed(4)}`);
    if (perShareProceeds > 0) vwapPieces.push(`VWAP回收=${perShareProceeds.toFixed(4)}`);
    if (feesPerShare > 0) vwapPieces.push(`费=${feesPerShare.toFixed(4)}`);
    if (slippagePerShare > 0) vwapPieces.push(`滑点=${slippagePerShare.toFixed(4)}`);
    if (totalCostUsd > 0) vwapPieces.push(`总成本≈$${totalCostUsd.toFixed(2)}`);
    if (totalProceedsUsd > 0) vwapPieces.push(`总回收≈$${totalProceedsUsd.toFixed(2)}`);
    if (vwapDeviationBps !== 0) vwapPieces.push(`VWAP偏离=${formatBps(vwapDeviationBps)}`);
    if (vwapLevels > 0) vwapPieces.push(`深度层=${vwapLevels}`);
    meta.innerHTML = [
      item.recommendedAction ? `动作：${item.recommendedAction}` : '',
      Number.isFinite(returnPct) ? `收益：${returnPct.toFixed(2)}%` : '',
      Number.isFinite(profitUsd) ? `利润≈$${profitUsd.toFixed(2)}` : '',
      item.positionSize ? `建议量：${item.positionSize}` : '',
      item.platformA && item.platformB ? `${item.platformA} vs ${item.platformB}` : '',
      item.spread ? `Spread=${Number(item.spread).toFixed(4)}` : '',
      vwapPieces.length ? vwapPieces.join(' | ') : '',
    ]
      .filter(Boolean)
      .map((text) => `<span>${text}</span>`)
      .join('');

    const actions = document.createElement('div');
    actions.className = 'arb-item-actions';
    const execBtn = document.createElement('button');
    execBtn.className = 'btn primary';
    execBtn.textContent = '执行';
    execBtn.addEventListener('click', async () => {
      if (!window.predictBot.executeArbOpportunity) {
        pushLog({ type: 'system', level: 'stderr', message: '当前版本不支持一键执行' });
        return;
      }
      if (!confirm('确认执行该套利机会？')) return;
      const payload = {
        id: `cmd_${Date.now()}`,
        typeKey: item.typeKey,
        type: item.type,
        index: item.index,
        fingerprint: item.fingerprint,
      };
      const result = await window.predictBot.executeArbOpportunity(payload);
      if (!result?.ok) {
        if (arbCommandHint) arbCommandHint.textContent = result?.message || '执行请求失败';
        pushLog({ type: 'arb', level: 'stderr', message: result?.message || '执行请求失败' });
        return;
      }
      if (arbCommandHint) arbCommandHint.textContent = `执行指令已发送：${result.id}`;
      pushLog({ type: 'arb', level: 'system', message: `一键执行已发送：${result.id}` });
      loadArbCommandStatus().catch(() => {});
    });
    actions.appendChild(execBtn);

    row.appendChild(header);
    row.appendChild(meta);
    row.appendChild(actions);
    arbOppList.appendChild(row);
  });
}

async function loadArbSnapshot() {
  if (!window.predictBot.readArbOpportunities) {
    return;
  }
  try {
    const raw = await window.predictBot.readArbOpportunities();
    arbSnapshot = parseJsonSafe(raw, { ts: 0, items: [] });
    updateArbSnapshotStatus(arbSnapshot);
    renderArbList();
  } catch {
    if (arbSnapshotStatus) arbSnapshotStatus.textContent = '读取失败';
  }
}

async function loadArbCommandStatus() {
  if (!window.predictBot.readArbCommand) {
    return;
  }
  try {
    const raw = await window.predictBot.readArbCommand();
    arbCommandState = parseJsonSafe(raw, null);
    if (arbCommandHint && arbCommandState?.status) {
      const status = arbCommandState.status;
      const message = arbCommandState.message ? `：${arbCommandState.message}` : '';
      arbCommandHint.textContent = `执行状态：${status}${message}`;
    }
  } catch {
    // ignore
  }
}

function syncTogglesFromEnv(text) {
  const env = parseEnv(text);
  for (const input of toggleInputs) {
    const key = input.dataset.env;
    if (!key) continue;
    const value = env.get(key) || 'false';
    input.checked = value.toLowerCase() === 'true';
  }
  syncSelectsFromEnv(text);
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
  if (/hard gate/.test(text)) return '硬门控';
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

function recordHardGateEvent(reason) {
  const message = String(reason || '硬门控触发');
  updateFailureCounts(`hard gate: ${message}`);
  ensureLogPreset('硬门控追踪', {
    type: 'all',
    category: '硬门控',
    keyword: 'hard gate',
  });
  const env = parseEnv(envEditor.value || '');
  const autoFix = String(env.get('CROSS_PLATFORM_HARD_GATE_AUTO_APPLY_FIX') || '').toLowerCase() === 'true';
  const autoUltra = String(env.get('CROSS_PLATFORM_HARD_GATE_AUTO_ULTRA') || '').toLowerCase() === 'true';
  if (autoUltra) {
    applyDowngradeProfile('ultra');
    if (saveEnvButton) {
      saveEnvButton.classList.add('attention');
    }
    pushLog({ type: 'system', level: 'system', message: '硬门控触发，已自动切换为极保守模板（请保存生效）' });
  }
  if (autoFix) {
    applyEnvLines(getHardGateFixLines(), '硬门控触发，已自动应用硬门控修复模板（请保存生效）');
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
    if (metricsSnapshot.hardGateActiveUntil && metricsSnapshot.hardGateActiveUntil > Date.now()) {
      hints.push(
        `硬门控触发：建议检查 ${metricsSnapshot.hardGateReason || '一致性/WS'}，提高稳定窗口或降低执行量`
      );
    }
    if (metricsSnapshot.consistencyPressure >= 0.6) {
      hints.push('一致性压力偏高：建议提高一致性阈值或开启模板保守模式');
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

async function copyPreflightChecklist() {
  const text = buildPreflightText(lastPreflightChecklist || []);
  if (!text) {
    if (healthExportHint) healthExportHint.textContent = '暂无清单可复制。';
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    if (healthExportHint) healthExportHint.textContent = '执行前清单已复制到剪贴板。';
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
  await checkConfigStatus();
}

// 配置状态检查
async function checkConfigStatus() {
  const configStatusList = document.getElementById('configStatusList');
  if (!configStatusList) return;

  const text = envEditor.value || '';
  const checks = [];

  // 检查必填项
  const hasApiKey = /API_KEY\s*=\s*[^ \n]/.test(text);
  const hasPrivateKey = /PRIVATE_KEY\s*=\s*[^ \n]/.test(text);
  const hasJwtToken = /JWT_TOKEN\s*=\s*[^ \n]/.test(text);
  const isEnabledTrading = /ENABLE_TRADING\s*=\s*true/i.test(text);
  const isAutoConfirm = /AUTO_CONFIRM\s*=\s*true/i.test(text);

  checks.push({
    key: 'API_KEY',
    label: 'API 密钥',
    status: hasApiKey ? 'ok' : 'error',
    message: hasApiKey ? '已配置' : '⚠️ 未配置（必填）',
  });

  checks.push({
    key: 'PRIVATE_KEY',
    label: '钱包私钥',
    status: hasPrivateKey ? 'ok' : 'error',
    message: hasPrivateKey ? '已配置' : '⚠️ 未配置（必填）',
  });

  checks.push({
    key: 'JWT_TOKEN',
    label: 'JWT Token',
    status: hasJwtToken ? 'ok' : (isEnabledTrading ? 'error' : 'warn'),
    message: hasJwtToken ? '已配置' : (isEnabledTrading ? '⚠️ 实盘交易必需' : '💡 模拟模式可选'),
  });

  checks.push({
    key: 'TRADING_MODE',
    label: '交易模式',
    status: 'ok',
    message: isEnabledTrading ? '🔴 实盘模式' : '🟢 模拟模式',
  });

  checks.push({
    key: 'AUTO_CONFIRM',
    label: '自动确认',
    status: isAutoConfirm ? 'warn' : 'ok',
    message: isAutoConfirm ? '⚠️ 已启用（谨慎使用）' : '✅ 已关闭（推荐）',
  });

  // 渲染状态
  configStatusList.innerHTML = checks.map(check => `
    <div class="health-item ${check.status}">
      <span class="health-label">${check.label}:</span>
      <span class="health-message">${check.message}</span>
    </div>
  `).join('');
}

// 加载最小配置模板
function loadMinTemplate() {
  try {
    const editor = document.getElementById('envEditor');
    if (!editor) {
      pushLog({ type: 'system', level: 'stderr', message: '错误：找不到环境变量编辑器' });
      console.error('envEditor 元素未找到');
      return;
    }

    const template = `# Predict.fun 最小配置模板
# ==================== 必填配置 ====================
API_KEY=your_api_key_here          # 从 Discord 获取
PRIVATE_KEY=0x...                   # 你的钱包私钥

# ==================== 交易模式 ====================
ENABLE_TRADING=false               # false=模拟, true=实盘
AUTO_CONFIRM=false                 # 建议先关闭

# ==================== 基础参数 ====================
ORDER_SIZE=10                      # 订单大小（USDT）
SPREAD=0.02                        # 价差 2%
MAX_POSITION=100                   # 最大持仓（USDT）

# ==================== WebSocket ====================
PREDICT_WS_ENABLED=true            # 推荐：开启实时行情

# ==================== 做市商配置 ====================
MM_VENUE=predict                   # 做市平台
MM_REQUIRE_JWT=true

# ==================== 套利配置 ====================
ARB_AUTO_EXECUTE=false             # 建议先手动执行
ARB_WS_REALTIME=true               # 实时扫描
`;

    editor.value = template;
    detectTradingMode(template);
    syncTogglesFromEnv(template);
    pushLog({ type: 'system', level: 'system', message: '✅ 已加载最小配置模板' });
    checkConfigStatus();
    console.log('模板加载完成');
  } catch (error) {
    console.error('加载模板失败:', error);
    pushLog({ type: 'system', level: 'stderr', message: '加载模板失败: ' + error.message });
  }
}

// 加载完整配置模板
function loadFullTemplate() {
  try {
    const editor = document.getElementById('envEditor');
    if (!editor) {
      pushLog({ type: 'system', level: 'stderr', message: '错误：找不到环境变量编辑器' });
      console.error('envEditor 元素未找到');
      return;
    }

    const template = `# Predict.fun 完整配置模板
# 详细说明请查看 QUICKSTART_CONFIG.md

# ==================== API 配置 ====================
API_BASE_URL=https://api.predict.fun
RPC_URL=https://eth-sepolia.public.blastapi.io

# ==================== 钱包配置 ====================
PRIVATE_KEY=0x...
PREDICT_ACCOUNT_ADDRESS=0x...

# ==================== 认证配置 ====================
API_KEY=your_api_key_here          # ⭐ 必填
JWT_TOKEN=your_jwt_token_here      # 实盘必需

# ==================== 交易模式 ====================
ENABLE_TRADING=false               # false=模拟, true=实盘
AUTO_CONFIRM=false                 # 自动确认订单

# ==================== 做市商配置 ====================
MM_VENUE=predict                   # 做市平台
MM_REQUIRE_JWT=true
ORDER_SIZE=10                      # 订单大小（USDT）
MAX_POSITION=100                   # 最大持仓（USDT）
SPREAD=0.02                        # 价差 2%
MIN_SPREAD=0.01
MAX_SPREAD=0.08
INVENTORY_SKEW_FACTOR=0.15
MAX_ORDERS_PER_MARKET=2

# ==================== 套利配置 ====================
ARB_AUTO_EXECUTE=false             # 自动执行套利
ARB_WS_REALTIME=true               # 实时扫描
CROSS_PLATFORM_ENABLED=false       # 跨平台套利

# ==================== WebSocket 配置 ====================
PREDICT_WS_ENABLED=true            # ⭐ 推荐
POLYMARKET_WS_ENABLED=false
OPINION_WS_ENABLED=false
PROBABLE_WS_ENABLED=false
ARB_REQUIRE_WS=false
CROSS_PLATFORM_WS_REALTIME=false

# ==================== 风控参数 ====================
CANCEL_THRESHOLD=0.05             # 5% 价格变动取消
REPRICE_THRESHOLD=0.003           # 0.3% 价格变动重新报价
MAX_DAILY_LOSS=200                # 每日最大亏损
MIN_ORDER_INTERVAL_MS=3000        # 最小订单间隔

# ==================== 高级参数 ====================
MM_ADAPTIVE_PARAMS=true           # 自适应做市
USE_VALUE_SIGNAL=false            # 价值信号
VALUE_SIGNAL_WEIGHT=0.35
MM_ICEBERG_ENABLED=false          # 冰山订单
MM_BATCH_CANCEL_ENABLED=false     # 批量撤单

# ==================== 跨平台配置（可选）====================
CROSS_PLATFORM_AUTO_EXECUTE=false
CROSS_PLATFORM_EXECUTION_VWAP_CHECK=true
CROSS_PLATFORM_ADAPTIVE_SIZE=true
CROSS_PLATFORM_DEPTH_USAGE=0.3
CROSS_PLATFORM_RECHECK_MS=300
CROSS_PLATFORM_STABILITY_SAMPLES=3

# ==================== 依赖套利（可选）====================
DEPENDENCY_ARB_ENABLED=false

# ==================== 日志路径 ====================
MM_METRICS_PATH=data/mm-metrics.json
CROSS_PLATFORM_MAPPING_PATH=data/cross-platform-mapping.json
DEPENDENCY_CONSTRAINTS_PATH=data/dependency-constraints.json
`;

    editor.value = template;
    detectTradingMode(template);
    syncTogglesFromEnv(template);
    pushLog({ type: 'system', level: 'system', message: '✅ 已加载完整配置模板' });
    checkConfigStatus();
    console.log('完整模板加载完成');
  } catch (error) {
    console.error('加载模板失败:', error);
    pushLog({ type: 'system', level: 'stderr', message: '加载模板失败: ' + error.message });
  }
}

// 一键最佳实践配置（针对积分优化）
async function applyBestPractice() {
  const editor = document.getElementById('envEditor');
  if (!editor) {
    pushLog({ type: 'system', level: 'stderr', message: '错误：找不到环境变量编辑器' });
    return;
  }

  // 检测当前平台（默认Predict.fun）
  const currentText = editor.value || '';
  const isProbable = /MM_VENUE\s*=\s*probable/i.test(currentText);
  const isPredict = /MM_VENUE\s*=\s*predict/i.test(currentText) || !isProbable;

  let template = '';
  let modeName = '';

  if (isPredict) {
    // Predict.fun 积分优化配置
    modeName = 'Predict.fun 积分优化模式';
    template = `# 🎯 一键最佳实践 - Predict.fun 积分优化
# 自动生成时间: ${new Date().toLocaleString('zh-CN')}

# =============== 必填配置（3项）==============
API_KEY=你的API_Key_这里                  # ⭐ 必填：从Discord申请
PRIVATE_KEY=你的钱包私钥_0x开头           # ⭐ 必填：新钱包私钥
ENABLE_TRADING=false                      # ⭐ 必填：false=模拟，true=实盘

# =============== 积分优化配置（自动）============
# 🔵 积分规则适配（自动满足积分要求）
MM_VENUE=predict                       # 固定平台
ORDER_SIZE=110                         # ✅ >100股的min_shares要求
SPREAD=0.055                            # ✅ 5.5¢ <6¢的max_spread限制
MIN_SPREAD=0.05                         # 最小5¢
MAX_SPREAD=0.08                         # 最大8¢（安全边际）

# 📊 实时数据（必需）
PREDICT_WS_ENABLED=true                  # ⭐ WebSocket实时数据
PREDICT_WS_URL=wss://stream.predict.fun

# 🎯 做市参数优化
MM_LAYERS=3                             # 挂3层订单
MM_LAYER_STEP_BPS=30                    # 层间距3¢
MM_QUOTE_INTERVAL_MS=5000                # 5秒更新一次
MAX_POSITION=100                         # 最大持仓100 USDT

# 🛡️ 风险控制
MAX_DAILY_LOSS=50                       # 每日最大亏损50 USDT
CANCEL_THRESHOLD=0.05                   # 5%价格变动取消
REPRICE_THRESHOLD=0.003                 # 0.3%价格变动重新报价

# 📈 自适应优化
MM_ADAPTIVE_PARAMS=true                  # 自适应市场
MM_WS_HEALTH_EMERGENCY_CANCEL_ALL=true  # 紧急全部撤单保护

# ===========================================
# 📋 小白提示：
# 1. ORDER_SIZE=110 确保满足 min_shares=100
# 2. SPREAD=0.055 确保不超过 max_spread=6¢
# 3. 启用 PREDICT_WS_ENABLED 获取实时数据
# 4. 先用模拟模式测试，确认无误后设置 ENABLE_TRADING=true
# ===========================================
`;
  } else {
    // Probable.markets 利润优化配置
    modeName = 'Probable.markets 利润优化模式';
    template = `# 🚀 一键最佳实践 - Probable.markets 利润优化
# 自动生成时间: ${new Date().toLocaleString('zh-CN')}

# =============== 必填配置（3项）==============
PROBABLE_PRIVATE_KEY=你的钱包私钥_0x开头  # ⭐ 必填：Probable专用私钥
ENABLE_TRADING=false                        # ⭐ 必填：false=模拟，true=实盘

# =============== 利润优化配置（自动）============
# 🔵 0%手续费优势（可更激进）
MM_VENUE=probable                        # 固定平台
ORDER_SIZE=100                           # 基础订单大小
SPREAD=0.01                              # ✅ 1% 超窄价差（无手续费！）
MIN_SPREAD=0.005                         # 最小0.5%
MAX_SPREAD=0.03                          # 最大3%

# 📊 实时数据（必需）
PROBABLE_WS_ENABLED=true                 # ⭐ WebSocket实时数据

# 🚀 激进配置（0%手续费）
MM_LAYERS=5                             # 挂5层订单
MM_LAYER_STEP_BPS=20                    # 层间距2¢
MM_QUOTE_INTERVAL_MS=2000                # 2秒更新（更快）

# 🎯 做市参数
MAX_POSITION=100                         # 最大持仓100 USDT

# 🛡️ 风险控制
MAX_DAILY_LOSS=50                       # 每日最大亏损50 USDT
CANCEL_THRESHOLD=0.05                   # 5%价格变动取消

# ===========================================
# 📋 小白提示：
# 1. Probable.markets 0% 手续费，可用更窄价差
# 2. 更多层数 + 更快更新 = 更多成交机会
# 3. 适合追求高收益、高频交易
# 4. 先模拟测试，确认无误后再实盘
# ===========================================
`;
  }

  editor.value = template;
  detectTradingMode(template);
  syncTogglesFromEnv(template);
  pushLog({ type: 'system', level: 'system', message: `✅ 已应用${modeName}最佳实践配置` });
  checkConfigStatus();
}

async function getSmartSuggestions() {
  const suggestionsList = document.getElementById('smartSuggestionsList');
  if (!suggestionsList) return;

  suggestionsList.style.display = 'block';
  suggestionsList.innerHTML = '<div class="health-item">分析中...</div>';

  try {
    const envText = document.getElementById('envEditor')?.value || '';
    const suggestions: string[] = [];

    // 检查API_KEY
    if (!/API_KEY\s*=\s*[^ \s]/.test(envText)) {
      suggestions.push('❌ 缺少 API_KEY - 请先填写Predict.fun API Key');
    } else {
      suggestions.push('✅ API_KEY 已配置');
    }

    // 检查PRIVATE_KEY
    if (!/PRIVATE_KEY\s*=\s*0x[a-fA-F0-9]/i.test(envText)) {
      suggestions.push('❌ 缺少 PRIVATE_KEY - 请填写钱包私钥（格式：0x...）');
    } else {
      suggestions.push('✅ PRIVATE_KEY 已配置');
    }

    // 检查交易模式
    const isEnabledTrading = /ENABLE_TRADING\s*=\s*true/i.test(envText);
    if (!isEnabledTrading) {
      suggestions.push('💡 当前为模拟模式（ENABLE_TRADING=false）');
      suggestions.push('💡 测试通过后设置为 true 即可实盘交易');
    } else {
      suggestions.push('⚠️ 当前为实盘模式，请注意风险！');
    }

    // 检查积分规则配置
    const orderSize = /ORDER_SIZE\s*=\s*(\d+)/.exec(envText)?.[1];
    const spread = /SPREAD\s*=\s*([\d.]+)/.exec(envText)?.[1];

    if (orderSize && spread) {
      const size = Number(orderSize);
      const spreadCents = Number(spread) * 100;

      if (size >= 100) {
        suggestions.push(`✅ ORDER_SIZE=${size} 满足积分min_shares要求`);
      } else {
        suggestions.push(`⚠️ ORDER_SIZE=${size} < 100，不满足积分要求，建议增加到110`);
      }

      if (spreadCents <= 6) {
        suggestions.push(`✅ SPREAD=${spreadCents.toFixed(1)}¢ 符合积分max_spread限制`);
      } else {
        suggestions.push(`⚠️ SPREAD=${spreadCents.toFixed(1)}¢ 超过积分max_spread限制（6¢）`);
      }
    }

    // 检查WebSocket
    const wsEnabled = /PREDICT_WS_ENABLED\s*=\s*true/i.test(envText);
    if (wsEnabled) {
      suggestions.push('✅ WebSocket已启用 - 实时数据获取');
    } else {
      suggestions.push('💡 建议启用 PREDICT_WS_ENABLED=true 获取实时数据');
    }

    // 平台建议
    const venue = /MM_VENUE\s*=\s*(\w+)/i.exec(envText)?.[1];
    if (venue) {
      if (venue.toLowerCase() === 'predict') {
        suggestions.push('💡 当前平台：Predict.fun（有积分）');
        suggestions.push('💡 建议：ORDER_SIZE≥110, SPREAD≤5.5¢');
      } else if (venue.toLowerCase() === 'probable') {
        suggestions.push('💡 当前平台：Probable.markets（0%手续费）');
        suggestions.push('💡 建议：SPREAD=0.01（1%），可用更窄价差');
      }
    }

    // 风险提示
    if (!/MAX_DAILY_LOSS\s*=/i.test(envText)) {
      suggestions.push('💡 建议添加 MAX_DAILY_LOSS=50 限制每日亏损');
    }

    if (!/MAX_POSITION\s*=/i.test(envText)) {
      suggestions.push('💡 建议添加 MAX_POSITION=100 限制最大持仓');
    }

    if (suggestions.length === 0) {
      suggestions.push('✅ 配置完美！没有发现需要优化的地方');
    }

    suggestionsList.innerHTML = suggestions.map(s => {
      const className = s.startsWith('❌') ? 'error' : s.startsWith('⚠️') ? 'warn' : 'ok';
      return `<div class="health-item ${className}">${s}</div>`;
    }).join('');

    pushLog({ type: 'system', level: 'system', message: `✅ 已生成${suggestions.length}条智能建议` });

  } catch (error) {
    console.error('获取建议失败:', error);
    suggestionsList.innerHTML = '<div class="health-item error">获取建议失败</div>';
  }
}

async function loadMapping() {
  const text = await window.predictBot.readMapping();
  mappingEditor.value = text;
  loadMappingBackups().catch(() => {});
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
  checkMappingMissing().catch(() => {});
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
  if (mmVenueSelect && mmVenueSelect.value) {
    text = setEnvValue(text, 'MM_VENUE', mmVenueSelect.value);
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

function normalizeQuestionKey(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function similarityScore(a, b) {
  const s1 = normalizeQuestionKey(a);
  const s2 = normalizeQuestionKey(b);
  if (!s1 || !s2) return 0;
  const words1 = new Set(s1.split(' '));
  const words2 = new Set(s2.split(' '));
  let intersection = 0;
  for (const w of words1) {
    if (words2.has(w)) intersection += 1;
  }
  const union = new Set([...words1, ...words2]);
  return union.size > 0 ? intersection / union.size : 0;
}

function buildMappingIndex(entries) {
  const tokenIndex = new Map();
  const predictIndex = new Map();
  const questionIndex = new Map();
  entries.forEach((entry) => {
    if (!entry) return;
    const predictId = entry.predictMarketId || '';
    const predictQuestion = normalizeQuestionKey(entry.predictQuestion || '');
    if (predictId) {
      if (!predictIndex.has(predictId)) predictIndex.set(predictId, []);
      predictIndex.get(predictId).push(entry);
    }
    if (predictQuestion) {
      if (!questionIndex.has(predictQuestion)) questionIndex.set(predictQuestion, []);
      questionIndex.get(predictQuestion).push(entry);
    }
    const addToken = (platform, tokenId) => {
      if (!tokenId) return;
      const key = `${platform}:${tokenId}`;
      if (!tokenIndex.has(key)) tokenIndex.set(key, []);
      tokenIndex.get(key).push(entry);
    };
    addToken('Polymarket', entry.polymarketYesTokenId);
    addToken('Polymarket', entry.polymarketNoTokenId);
    addToken('Opinion', entry.opinionYesTokenId);
    addToken('Opinion', entry.opinionNoTokenId);
    addToken('Probable', entry.probableYesTokenId);
    addToken('Probable', entry.probableNoTokenId);
  });
  return { tokenIndex, predictIndex, questionIndex };
}

function parseMappingEntries(raw) {
  const parsed = JSON.parse(raw || '{}');
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.entries)) return parsed.entries;
  return [];
}

function parseMarketRow(row) {
  if (!row || typeof row !== 'object') return null;
  const yesTokenId = row.yesTokenId || row.yes_token_id || row.yesToken || row.yes;
  const noTokenId = row.noTokenId || row.no_token_id || row.noToken || row.no;
  const question = row.question || row.marketTitle || row.title || '';
  const marketId = row.marketId || row.id || row.market_id || '';
  return {
    marketId,
    question,
    yesTokenId,
    noTokenId,
  };
}

function generateMappingTemplate(missing) {
  const entries = missing
    .slice()
    .sort((a, b) => (Number(b.predictScore || 0) || 0) - (Number(a.predictScore || 0) || 0))
    .map((item) => ({
      label: `${item.platform}:${item.marketId || item.question || ''}`.trim(),
      predictMarketId: item.predictMarketId || '',
      predictQuestion: item.predictQuestion || item.question || '',
      predictScore: item.predictScore ?? undefined,
      predictConfirmed: item.predictConfirmed ?? undefined,
      predictCandidates: item.predictCandidates || undefined,
      polymarketYesTokenId: item.platform === 'Polymarket' ? item.yesTokenId : '',
      polymarketNoTokenId: item.platform === 'Polymarket' ? item.noTokenId : '',
      opinionYesTokenId: item.platform === 'Opinion' ? item.yesTokenId : '',
      opinionNoTokenId: item.platform === 'Opinion' ? item.noTokenId : '',
      probableYesTokenId: item.platform === 'Probable' ? item.yesTokenId : '',
      probableNoTokenId: item.platform === 'Probable' ? item.noTokenId : '',
    }));
  return JSON.stringify({ entries }, null, 2);
}

function generateConfirmedMapping(entries) {
  const confirmed = entries
    .filter((item) => item.predictConfirmed && item.predictMarketId)
    .map((item) => ({
      label: `${item.platform}:${item.marketId || item.question || ''}`.trim(),
      predictMarketId: item.predictMarketId || '',
      predictQuestion: item.predictQuestion || item.question || '',
      polymarketYesTokenId: item.platform === 'Polymarket' ? item.yesTokenId : '',
      polymarketNoTokenId: item.platform === 'Polymarket' ? item.noTokenId : '',
      opinionYesTokenId: item.platform === 'Opinion' ? item.yesTokenId : '',
      opinionNoTokenId: item.platform === 'Opinion' ? item.noTokenId : '',
      probableYesTokenId: item.platform === 'Probable' ? item.yesTokenId : '',
      probableNoTokenId: item.platform === 'Probable' ? item.noTokenId : '',
    }));
  return JSON.stringify({ entries: confirmed }, null, 2);
}

function renderMissingList(missing) {
  if (!mappingMissingList) return;
  mappingMissingList.innerHTML = '';
  if (!missing || missing.length === 0) {
    const item = document.createElement('div');
    item.className = 'health-item ok';
    item.textContent = '未检测到缺失映射。';
    mappingMissingList.appendChild(item);
    return;
  }
  const env = parseEnv(envEditor.value || '');
  const minScore = parseFloat(env.get('CROSS_PLATFORM_MAPPING_SUGGEST_MIN_SCORE') || '0.5');
  const hideUnconfirmed = Boolean(mappingHideUnconfirmed?.checked);
  const hideLowScore = Boolean(mappingHideLowScore?.checked);
  const filtered = missing.filter((item) => {
    if (hideUnconfirmed && item.predictMarketId && !item.predictConfirmed) {
      return false;
    }
    if (hideLowScore && Number.isFinite(item.predictScore) && item.predictScore < minScore) {
      return false;
    }
    return true;
  });
  filtered.slice(0, 20).forEach((itemData) => {
    const row = document.createElement('div');
    row.className = 'health-item warn';
    const label = document.createElement('div');
    label.className = 'health-label';
    label.textContent = `${itemData.platform} | ${itemData.question || itemData.marketId}`;
    const hint = document.createElement('div');
    hint.className = 'health-hint';
    const tokensText = `${itemData.yesTokenId || '-'} / ${itemData.noTokenId || '-'}`;
    let suggestionText = '';
    if (itemData.predictMarketId || itemData.predictQuestion) {
      const score = Number.isFinite(itemData.predictScore) ? ` score=${itemData.predictScore}` : '';
      const confirmedTag = itemData.predictConfirmed ? '｜已确认' : '';
      suggestionText = `｜Predict: ${itemData.predictQuestion || itemData.predictMarketId}${score}${confirmedTag}`;
    }
    if (Array.isArray(itemData.predictCandidates) && itemData.predictCandidates.length > 0) {
      const top = itemData.predictCandidates.slice(0, 3);
      const candidateText = top
        .map((c, idx) => {
          const label = `${c.question || c.marketId} (${c.score})`;
          return `<button class="btn ghost" data-action="pick-candidate" data-index="${idx}">${label}</button>`;
        })
        .join(' ');
      suggestionText = suggestionText
        ? `${suggestionText}｜候选: ${candidateText}`
        : `｜候选: ${candidateText}`;
      row.dataset.candidates = JSON.stringify(itemData.predictCandidates);
    }
    hint.innerHTML = `${tokensText}${suggestionText}`;
    row.appendChild(label);
    row.appendChild(hint);
    row.dataset.missing = JSON.stringify(itemData);
    mappingMissingList.appendChild(row);
  });
}

async function checkMappingMissing() {
  if (!mappingMissingList) return;
  mappingMissingList.innerHTML = '';
  let mappingRaw = mappingEditor.value || '';
  let mappingEntries = [];
  try {
    mappingEntries = parseMappingEntries(mappingRaw);
  } catch (error) {
    const item = document.createElement('div');
    item.className = 'health-item warn';
    item.textContent = '映射 JSON 解析失败，请先修复格式。';
    mappingMissingList.appendChild(item);
    return;
  }
  const { tokenIndex, questionIndex } = buildMappingIndex(mappingEntries);
  const platforms = [];
  const loadPlatform = async (platform) => {
    try {
      const text = await window.predictBot.readPlatformMarkets(platform);
      const parsed = JSON.parse(text || '{}');
      const list = Array.isArray(parsed) ? parsed : parsed?.result || parsed?.list || [];
      return { platform, list };
    } catch {
      return { platform, list: [] };
    }
  };
  platforms.push(await loadPlatform('polymarket'));
  platforms.push(await loadPlatform('opinion'));
  platforms.push(await loadPlatform('probable'));
  const missing = [];
  platforms.forEach((platformData) => {
    const platformName =
      platformData.platform === 'polymarket'
        ? 'Polymarket'
        : platformData.platform === 'opinion'
        ? 'Opinion'
        : 'Probable';
    platformData.list.forEach((row) => {
      const market = parseMarketRow(row);
      if (!market || !market.yesTokenId || !market.noTokenId) return;
      const keyYes = `${platformName}:${market.yesTokenId}`;
      const keyNo = `${platformName}:${market.noTokenId}`;
      const mapped = tokenIndex.has(keyYes) || tokenIndex.has(keyNo);
      if (!mapped) {
        const questionKey = normalizeQuestionKey(market.question);
        const maybePredict = questionIndex.get(questionKey);
        const predictMarketId = maybePredict?.[0]?.predictMarketId || '';
        const predictQuestion = maybePredict?.[0]?.predictQuestion || market.question;
        missing.push({
          platform: platformName,
          marketId: market.marketId,
          question: market.question,
          yesTokenId: market.yesTokenId,
          noTokenId: market.noTokenId,
          predictMarketId,
          predictQuestion,
        });
      }
    });
  });
  renderMissingList(missing);
  mappingMissingList.dataset.template = generateMappingTemplate(missing);
  mappingMissingList.dataset.missing = JSON.stringify(missing);
  if (mappingMissingList.dataset.template && mappingMissingList.dataset.template.length > 0) {
    pushLog({ type: 'system', level: 'system', message: `检测到 ${missing.length} 条缺失映射，可生成模板。` });
  }
}

function applyMappingTemplate(message) {
  if (!mappingMissingList?.dataset.template) {
    pushLog({ type: 'system', level: 'system', message: '暂无可用的映射模板。' });
    return;
  }
  mappingEditor.value = mappingMissingList.dataset.template;
  pushLog({
    type: 'system',
    level: 'system',
    message: message || '已生成映射模板，请补充 Predict 侧后保存。',
  });
  maybeAutoSaveMapping();
}

async function maybeAutoSaveMapping() {
  if (!mappingAutoSaveToggle?.checked) return;
  try {
    if (mappingAutoBackupToggle?.checked) {
      await backupMapping();
    }
    await saveMapping();
    if (mappingAutoReloadToggle?.checked) {
      await loadMapping();
      checkMappingMissing().catch(() => {});
    }
    if (mappingAutoRescanToggle?.checked) {
      await requestMappingRescan();
    }
  } catch {
    pushLog({ type: 'system', level: 'stderr', message: '自动保存映射失败' });
  }
}

async function requestMappingRescan() {
  if (!window.predictBot?.triggerRescan) {
    pushLog({ type: 'system', level: 'stderr', message: '当前版本不支持重扫指令' });
    return;
  }
  const result = await window.predictBot.triggerRescan();
  if (!result?.ok) {
    pushLog({ type: 'system', level: 'stderr', message: result?.message || '重扫触发失败' });
    return;
  }
  pushLog({ type: 'system', level: 'system', message: '已触发跨平台重扫' });
  if (mappingAutoWsKickToggle?.checked) {
    await triggerWsBoost();
  }
}

async function triggerWsBoost() {
  if (!window.predictBot?.triggerWsBoost) {
    pushLog({ type: 'system', level: 'stderr', message: '当前版本不支持 WS 加速' });
    return;
  }
  const result = await window.predictBot.triggerWsBoost();
  if (!result?.ok) {
    pushLog({ type: 'system', level: 'stderr', message: result?.message || 'WS 加速触发失败' });
    return;
  }
  pushLog({ type: 'system', level: 'system', message: '已触发 WS 加速扫描' });
}
async function backupMapping() {
  if (!window.predictBot?.backupMapping) {
    return;
  }
  const result = await window.predictBot.backupMapping();
  if (result?.ok) {
    pushLog({ type: 'system', level: 'system', message: `映射已备份：${result.path || ''}`.trim() });
  } else {
    pushLog({ type: 'system', level: 'stderr', message: result?.message || '映射备份失败' });
  }
}

async function restoreLatestBackup() {
  if (!window.predictBot?.restoreLatestMapping) {
    pushLog({ type: 'system', level: 'stderr', message: '当前版本不支持恢复备份' });
    return;
  }
  const result = await window.predictBot.restoreLatestMapping();
  if (!result?.ok) {
    pushLog({ type: 'system', level: 'stderr', message: result?.message || '恢复备份失败' });
    return;
  }
  await loadMapping();
  checkMappingMissing().catch(() => {});
  await loadMappingBackups();
  pushLog({ type: 'system', level: 'system', message: `已恢复备份：${result.path || ''}`.trim() });
}

async function loadMappingBackups() {
  if (!mappingBackupList) return;
  if (!window.predictBot?.listMappingBackups) {
    mappingBackupList.innerHTML = '<div class="health-item ok">当前版本不支持备份列表。</div>';
    return;
  }
  const result = await window.predictBot.listMappingBackups();
  if (!result?.ok) {
    mappingBackupList.innerHTML = '<div class="health-item warn">备份列表读取失败。</div>';
    return;
  }
  const items = Array.isArray(result.items) ? result.items : [];
  if (!items.length) {
    mappingBackupList.innerHTML = '<div class="health-item ok">暂无备份。</div>';
    return;
  }
  mappingBackupList.innerHTML = '';
  items.slice(0, 6).forEach((item) => {
    const row = document.createElement('div');
    row.className = 'health-item warn';
    const label = document.createElement('div');
    label.className = 'health-label';
    label.textContent = item.label || item.path;
    const hint = document.createElement('div');
    hint.className = 'health-hint';
    hint.innerHTML = `<button class="btn ghost" data-action="restore-backup" data-path="${item.path}">恢复</button>`;
    row.appendChild(label);
    row.appendChild(hint);
    mappingBackupList.appendChild(row);
  });
}

async function copyMappingTemplate() {
  if (!mappingMissingList?.dataset.template) {
    pushLog({ type: 'system', level: 'system', message: '暂无可复制的映射模板。' });
    return;
  }
  try {
    await navigator.clipboard.writeText(mappingMissingList.dataset.template);
    pushLog({ type: 'system', level: 'system', message: '映射模板已复制到剪贴板。' });
  } catch {
    pushLog({ type: 'system', level: 'stderr', message: '复制映射模板失败，请手动复制。' });
  }
}

function replaceMissingItem(updatedItem) {
  if (!mappingMissingList?.dataset.missing) return;
  let missing = [];
  try {
    missing = JSON.parse(mappingMissingList.dataset.missing || '[]');
  } catch {
    return;
  }
  const idx = missing.findIndex(
    (item) =>
      item.platform === updatedItem.platform &&
      item.marketId === updatedItem.marketId &&
      item.yesTokenId === updatedItem.yesTokenId &&
      item.noTokenId === updatedItem.noTokenId
  );
  if (idx >= 0) {
    missing[idx] = updatedItem;
  }
  mappingMissingList.dataset.missing = JSON.stringify(missing);
  mappingMissingList.dataset.template = generateMappingTemplate(missing);
  renderMissingList(missing);
}

function handleMissingListClick(event) {
  const target = event.target;
  if (!target) return;
  if (!target.dataset || target.dataset.action !== 'pick-candidate') return;
  const row = target.closest('.health-item');
  if (!row) return;
  let candidates = [];
  try {
    candidates = JSON.parse(row.dataset.candidates || '[]');
  } catch {
    candidates = [];
  }
  const index = parseInt(target.dataset.index || '0', 10);
  const candidate = candidates[index];
  if (!candidate) return;
  let missingItem = null;
  try {
    missingItem = JSON.parse(row.dataset.missing || '{}');
  } catch {
    missingItem = null;
  }
  if (!missingItem) return;
  const updated = {
    ...missingItem,
    predictMarketId: candidate.marketId || '',
    predictQuestion: candidate.question || '',
    predictScore: candidate.score,
    predictConfirmed: false,
  };
  replaceMissingItem(updated);
  applyMappingTemplate('已应用候选到模板，请确认后保存。');
}

function autoCleanupMappings() {
  if (!mappingMissingList?.dataset.missing) {
    pushLog({ type: 'system', level: 'system', message: '请先点击“检查缺失”。' });
    return;
  }
  let missing = [];
  try {
    missing = JSON.parse(mappingMissingList.dataset.missing || '[]');
  } catch {
    pushLog({ type: 'system', level: 'stderr', message: '缺失映射数据解析失败。' });
    return;
  }
  if (!missing.length) {
    pushLog({ type: 'system', level: 'system', message: '没有可清理的缺失项。' });
    return;
  }
  const env = parseEnv(envEditor.value || '');
  const minScore = parseFloat(env.get('CROSS_PLATFORM_MAPPING_SUGGEST_MIN_SCORE') || '0.5');
  const confirmScore = parseFloat(
    env.get('CROSS_PLATFORM_MAPPING_SUGGEST_CONFIRM_SCORE') || '0.86'
  );
  let confirmed = 0;
  let filtered = 0;
  const cleaned = missing
    .map((item) => {
      if (!item.predictMarketId || !Number.isFinite(item.predictScore)) {
        return item;
      }
      if (item.predictScore < minScore) {
        filtered += 1;
        return { ...item, predictCandidates: [] };
      }
      if (item.predictScore >= confirmScore) {
        confirmed += 1;
        return { ...item, predictConfirmed: true };
      }
      return item;
    })
    .filter((item) => {
      if (!item.predictMarketId && (!item.predictCandidates || item.predictCandidates.length === 0)) {
        return false;
      }
      return true;
    });
  mappingMissingList.dataset.missing = JSON.stringify(cleaned);
  mappingMissingList.dataset.template = generateMappingTemplate(cleaned);
  renderMissingList(cleaned);
  applyMappingTemplate('已清理低分并确认高分条目，请保存。');
  pushLog({
    type: 'system',
    level: 'system',
    message: `清理完成：确认 ${confirmed} 条，剔除 ${filtered} 条低分候选`,
  });
}

function exportConfirmedMappings() {
  if (!mappingMissingList?.dataset.missing) {
    pushLog({ type: 'system', level: 'system', message: '请先点击“检查缺失”。' });
    return;
  }
  let missing = [];
  try {
    missing = JSON.parse(mappingMissingList.dataset.missing || '[]');
  } catch {
    pushLog({ type: 'system', level: 'stderr', message: '缺失映射数据解析失败。' });
    return;
  }
  if (!missing.length) {
    pushLog({ type: 'system', level: 'system', message: '没有可导出的确认项。' });
    return;
  }
  const confirmedText = generateConfirmedMapping(missing);
  mappingEditor.value = confirmedText;
  pushLog({ type: 'system', level: 'system', message: '已导出确认映射，请保存。' });
  maybeAutoSaveMapping();
}

async function suggestPredictMappings() {
  if (!mappingMissingList) return;
  if (!mappingMissingList.dataset.missing) {
    pushLog({ type: 'system', level: 'system', message: '请先点击“检查缺失”。' });
    return;
  }
  let missing = [];
  try {
    missing = JSON.parse(mappingMissingList.dataset.missing || '[]');
  } catch {
    pushLog({ type: 'system', level: 'stderr', message: '缺失映射数据解析失败。' });
    return;
  }
  if (!missing.length) {
    pushLog({ type: 'system', level: 'system', message: '没有可匹配的缺失项。' });
    return;
  }
  let predictMarkets = [];
  try {
    const raw = await window.predictBot.readPlatformMarkets('predict');
    const parsed = JSON.parse(raw || '[]');
    predictMarkets = Array.isArray(parsed) ? parsed : parsed?.result || parsed?.list || [];
  } catch {
    pushLog({ type: 'system', level: 'stderr', message: 'Predict 市场读取失败。' });
    return;
  }
  const env = parseEnv(envEditor.value || '');
  const minSimilarity = parseFloat(env.get('CROSS_PLATFORM_MIN_SIMILARITY') || '0.78');
  const topN = Math.max(1, parseInt(env.get('CROSS_PLATFORM_MAPPING_SUGGEST_TOP_N') || '3', 10));
  const minScore = parseFloat(env.get('CROSS_PLATFORM_MAPPING_SUGGEST_MIN_SCORE') || '0.5');
  const confirmScore = parseFloat(
    env.get('CROSS_PLATFORM_MAPPING_SUGGEST_CONFIRM_SCORE') || String(minSimilarity + 0.08)
  );
  const candidates = predictMarkets
    .map(parseMarketRow)
    .filter((row) => row && (row.marketId || row.question));
  let matched = 0;
  const nextMissing = missing.map((item) => {
    if (item.predictMarketId || item.predictQuestion) return item;
    const scored = [];
    for (const candidate of candidates) {
      const score = similarityScore(item.question, candidate.question);
      if (score < minScore) continue;
      scored.push({
        marketId: candidate.marketId || '',
        question: candidate.question || '',
        score: Number(score.toFixed(3)),
      });
    }
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, topN);
    if (top.length === 0) return item;
    const best = top[0];
    const shouldFill = best.score >= minSimilarity;
    const updated = {
      ...item,
      predictCandidates: top,
    };
    if (shouldFill) {
      matched += 1;
      updated.predictMarketId = best.marketId || '';
      updated.predictQuestion = best.question || '';
      updated.predictScore = best.score;
      updated.predictConfirmed = best.score >= confirmScore;
    }
    return updated;
  });
  mappingMissingList.dataset.missing = JSON.stringify(nextMissing);
  mappingMissingList.dataset.template = generateMappingTemplate(nextMissing);
  renderMissingList(nextMissing);
  applyMappingTemplate('已生成模板并填充 Predict 建议，请确认后保存。');
  pushLog({ type: 'system', level: 'system', message: `自动匹配完成：${matched}/${missing.length}` });
}

function getHardGateFixLines() {
  return [
    'CROSS_PLATFORM_CONSISTENCY_PRESSURE_UP=0.2',
    'CROSS_PLATFORM_CONSISTENCY_PRESSURE_HARD_THRESHOLD=0.9',
    'CROSS_PLATFORM_CONSISTENCY_PRESSURE_HARD_FACTOR=0.4',
    'CROSS_PLATFORM_WS_HEALTH_HARD_THRESHOLD=50',
    'CROSS_PLATFORM_WS_HEALTH_HARD_FACTOR=0.6',
    'CROSS_PLATFORM_HARD_GATE_RATE_LIMIT_MS=5000',
  ];
}

function applyEnvLines(lines, message) {
  if (!lines || !lines.length) return;
  let text = envEditor.value || '';
  lines.forEach((line) => {
    if (!line || line.startsWith('#')) return;
    const idx = line.indexOf('=');
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!key) return;
    text = setEnvValue(text, key, value);
  });
  envEditor.value = text;
  detectTradingMode(text);
  syncTogglesFromEnv(text);
  updateMetricsPaths();
  if (saveEnvButton) {
    saveEnvButton.classList.add('attention');
  }
  if (message) {
    pushLog({ type: 'system', level: 'system', message });
  }
}

function formatUpdateList(updates) {
  return Object.entries(updates)
    .map(([key, value]) => `${key}=${value}`)
    .join('，');
}

function buildDiffSummary(oldEnv, updates) {
  const diffs = [];
  Object.entries(updates).forEach(([key, value]) => {
    const previous = oldEnv.get(key);
    if (previous === undefined || String(previous) !== String(value)) {
      diffs.push(`${key}:${previous ?? '∅'}→${value}`);
    }
  });
  if (!diffs.length) {
    return '未检测到变化。';
  }
  return diffs.join('，');
}

function applyRecoveryTemplateReset() {
  let text = envEditor.value || '';
  const oldEnv = parseEnv(text);
  const resetLines = {
    MM_WS_HEALTH_EMERGENCY_RECOVERY_TEMPLATE_ENABLED: 'false',
    MM_WS_HEALTH_EMERGENCY_RECOVERY_SINGLE_SIDE: 'NONE',
    MM_WS_HEALTH_EMERGENCY_RECOVERY_SINGLE_SIDE_MODE: 'REMOTE',
    MM_WS_HEALTH_EMERGENCY_RECOVERY_SINGLE_SIDE_OFFSET_BPS: '0',
    MM_WS_HEALTH_EMERGENCY_RECOVERY_SINGLE_SIDE_OFFSET_MIN_BPS: '0',
    MM_WS_HEALTH_EMERGENCY_RECOVERY_SINGLE_SIDE_AUTO: 'false',
    MM_WS_HEALTH_EMERGENCY_RECOVERY_FAR_LAYERS_MIN: '1',
    MM_WS_HEALTH_EMERGENCY_RECOVERY_FAR_LAYERS_MAX: '3',
    MM_WS_HEALTH_EMERGENCY_RECOVERY_FAR_LAYER_STEP: '1',
    MM_WS_HEALTH_EMERGENCY_RECOVERY_CANCEL_INTERVAL_MULT_MAX: '2',
    MM_WS_HEALTH_EMERGENCY_RECOVERY_MIN_INTERVAL_MS: '0',
  };
  Object.entries(resetLines).forEach(([key, value]) => {
    text = setEnvValue(text, key, value);
  });
  envEditor.value = text;
  detectTradingMode(text);
  syncTogglesFromEnv(text);
  updateMetricsPaths();
  if (saveEnvButton) {
    saveEnvButton.classList.add('attention');
  }
  if (recoveryTemplateResetHint) {
    recoveryTemplateResetHint.textContent = `已恢复默认：${buildDiffSummary(oldEnv, resetLines)}（请保存生效）`;
  }
  pushLog({ type: 'system', level: 'system', message: '已恢复默认恢复模板参数（请保存生效）' });
}

function toggleRecoveryTemplate(enabled) {
  let text = envEditor.value || '';
  text = setEnvValue(text, 'MM_WS_HEALTH_EMERGENCY_RECOVERY_TEMPLATE_ENABLED', enabled ? 'true' : 'false');
  if (!enabled) {
    const resetEnabled = /MM_WS_HEALTH_EMERGENCY_RECOVERY_TEMPLATE_RESET_ENABLED\s*=\s*true/i.test(text);
    if (resetEnabled) {
      envEditor.value = text;
      applyRecoveryTemplateReset();
      text = envEditor.value || '';
    }
  }
  envEditor.value = text;
  detectTradingMode(text);
  syncTogglesFromEnv(text);
  updateMetricsPaths();
  if (saveEnvButton) {
    saveEnvButton.classList.add('attention');
  }
  if (enabled) {
    const env = parseEnv(text);
    const side = (env.get('MM_WS_HEALTH_EMERGENCY_RECOVERY_SINGLE_SIDE') || 'NONE').toUpperCase();
    const message =
      side === 'NONE'
        ? '已启用恢复模板，请设置单边方向（MM_WS_HEALTH_EMERGENCY_RECOVERY_SINGLE_SIDE）并保存生效。'
        : '已启用恢复模板，请保存配置生效。';
    pushLog({ type: 'system', level: 'system', message });
  } else {
    pushLog({ type: 'system', level: 'system', message: '已关闭恢复模板，请保存配置生效。' });
  }
  if (recoveryTemplateHint) {
    recoveryTemplateHint.textContent = enabled
      ? '模板已启用，记得保存配置。'
      : '模板已关闭，记得保存配置。';
  }
}

function applyRecoveryTemplatePreset(level) {
  let text = envEditor.value || '';
  const oldEnv = parseEnv(text);
  const presets = {
    safe: {
      MM_WS_HEALTH_EMERGENCY_RECOVERY_TEMPLATE_ENABLED: 'true',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_SINGLE_SIDE_AUTO: 'true',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_SINGLE_SIDE_IMBALANCE_THRESHOLD: '0.15',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_SINGLE_SIDE_MODE: 'REMOTE',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_FAR_LAYERS_MIN: '2',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_FAR_LAYERS_MAX: '3',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_FAR_LAYER_STEP: '1',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_MIN_INTERVAL_MS: '4000',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_CANCEL_INTERVAL_MULT_MAX: '2',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_SPREAD_ADD: '0.002',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_ICEBERG_RATIO: '0.2',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_MAX_ORDERS_MULT_MIN: '0.6',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_MAX_NOTIONAL_MULT_MIN: '0.6',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_LAYER_CONVERGE_ENABLED: 'true',
    },
    ultra: {
      MM_WS_HEALTH_EMERGENCY_RECOVERY_TEMPLATE_ENABLED: 'true',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_SINGLE_SIDE_AUTO: 'true',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_SINGLE_SIDE_IMBALANCE_THRESHOLD: '0.12',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_SINGLE_SIDE_MODE: 'REMOTE',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_FAR_LAYERS_MIN: '3',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_FAR_LAYERS_MAX: '4',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_FAR_LAYER_STEP: '1',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_MIN_INTERVAL_MS: '6000',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_CANCEL_INTERVAL_MULT_MAX: '2.5',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_SPREAD_ADD: '0.003',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_ICEBERG_RATIO: '0.15',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_MAX_ORDERS_MULT_MIN: '0.5',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_MAX_NOTIONAL_MULT_MIN: '0.5',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_LAYER_CONVERGE_ENABLED: 'true',
    },
    extreme: {
      MM_WS_HEALTH_EMERGENCY_RECOVERY_TEMPLATE_ENABLED: 'true',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_SINGLE_SIDE_AUTO: 'true',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_SINGLE_SIDE_IMBALANCE_THRESHOLD: '0.1',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_SINGLE_SIDE_MODE: 'REMOTE',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_FAR_LAYERS_MIN: '4',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_FAR_LAYERS_MAX: '5',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_FAR_LAYER_STEP: '1',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_MIN_INTERVAL_MS: '8000',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_CANCEL_INTERVAL_MULT_MAX: '3',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_SPREAD_ADD: '0.004',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_ICEBERG_RATIO: '0.12',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_MAX_ORDERS_MULT_MIN: '0.4',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_MAX_NOTIONAL_MULT_MIN: '0.4',
      MM_WS_HEALTH_EMERGENCY_RECOVERY_LAYER_CONVERGE_ENABLED: 'true',
    },
  };
  const updates = presets[level] || presets.safe;
  Object.entries(updates).forEach(([key, value]) => {
    text = setEnvValue(text, key, value);
  });
  envEditor.value = text;
  detectTradingMode(text);
  syncTogglesFromEnv(text);
  updateMetricsPaths();
  if (saveEnvButton) {
    saveEnvButton.classList.add('attention');
  }
  const label = level === 'extreme' ? '极限' : level === 'ultra' ? '极保守' : '保守';
  pushLog({ type: 'system', level: 'system', message: `已应用恢复模板${label}档（请保存生效）` });
  if (recoveryTemplateResetHint) {
    recoveryTemplateResetHint.textContent = `本次更新：${buildDiffSummary(oldEnv, updates)}（请保存生效）`;
  }
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
      MM_FAST_CANCEL_BPS: '12',
      MM_FAST_CANCEL_WINDOW_MS: '1000',
      MM_FAST_CANCEL_DEPTH_SPEED_BPS: '60',
      MM_FAST_CANCEL_SPREAD_JUMP_BPS: '8',
      MM_PROTECTIVE_DEPTH_SPEED_BPS: '80',
      MM_PROTECTIVE_SPREAD_JUMP_BPS: '8',
      MM_PROTECTIVE_TEMPLATE_ENABLED: 'true',
      MM_PROTECTIVE_HOLD_MS: '9000',
      MM_PROTECTIVE_MIN_INTERVAL_MS: '4500',
      MM_PROTECTIVE_LAYER_COUNT_CAP: '1',
      MM_PROTECTIVE_ONLY_FAR: 'true',
      MM_PROTECTIVE_FORCE_SINGLE: 'true',
      MM_PROTECTIVE_SINGLE_SIDE: 'NONE',
      MM_PROTECTIVE_SINGLE_SIDE_MODE: 'REMOTE',
      MM_PROTECTIVE_SINGLE_SIDE_OFFSET_BPS: '8',
      MM_PROTECTIVE_SINGLE_SIDE_AUTO: 'true',
      MM_PROTECTIVE_SINGLE_SIDE_IMBALANCE_THRESHOLD: '0.2',
      MM_PROTECTIVE_SIZE_SCALE: '0.7',
      MM_PROTECTIVE_TOUCH_BUFFER_ADD_BPS: '6',
      MM_ORDER_RISK_VWAP_BPS: '15',
      MM_ORDER_RISK_VWAP_SHARES: '40',
      MM_ORDER_RISK_VWAP_LEVELS: '4',
      MM_LAYER_GUARD_NEAR_BPS: '12',
      MM_LAYER_GUARD_MIN_DEPTH_SHARES: '20',
      MM_LAYER_GUARD_DEPTH_SPEED_BPS: '60',
      MM_DEPTH_SPEED_PAUSE_BPS: '90',
      MM_DEPTH_SPEED_PAUSE_MS: '6000',
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

function applyMmProbablePointsTemplate() {
  applyTemplate(
    {
      MM_VENUE: 'probable',
      MM_REQUIRE_JWT: 'false',
      PROBABLE_ENABLED: 'true',
      PROBABLE_WS_ENABLED: 'true',
      MM_ONLY_POINTS_MARKETS: 'true',
      MM_POINTS_MIN_ONLY: 'true',
      MM_POINTS_MIN_MULTIPLIER: '1',
      MM_POINTS_ASSUME_ACTIVE: 'true',
      MM_POINTS_MIN_SHARES: '100',
      MM_POINTS_MAX_SPREAD_CENTS: '6',
      MM_ORDER_DEPTH_USAGE: '0.2',
      MM_ORDER_RISK_VWAP_BPS: '12',
      MM_ORDER_RISK_VWAP_SHARES: '30',
      MM_ORDER_RISK_VWAP_LEVELS: '4',
      MM_FAST_CANCEL_BPS: '10',
      MM_FAST_CANCEL_WINDOW_MS: '1000',
      MM_FAST_CANCEL_DEPTH_SPEED_BPS: '50',
      MM_FAST_CANCEL_SPREAD_JUMP_BPS: '8',
      MM_PROTECTIVE_DEPTH_SPEED_BPS: '70',
      MM_PROTECTIVE_SPREAD_JUMP_BPS: '8',
      MM_PROTECTIVE_TEMPLATE_ENABLED: 'true',
      MM_PROTECTIVE_HOLD_MS: '9000',
      MM_PROTECTIVE_MIN_INTERVAL_MS: '4500',
      MM_PROTECTIVE_LAYER_COUNT_CAP: '1',
      MM_PROTECTIVE_ONLY_FAR: 'true',
      MM_PROTECTIVE_FORCE_SINGLE: 'true',
      MM_PROTECTIVE_SINGLE_SIDE: 'NONE',
      MM_PROTECTIVE_SINGLE_SIDE_MODE: 'REMOTE',
      MM_PROTECTIVE_SINGLE_SIDE_OFFSET_BPS: '8',
      MM_PROTECTIVE_SINGLE_SIDE_AUTO: 'true',
      MM_PROTECTIVE_SINGLE_SIDE_IMBALANCE_THRESHOLD: '0.2',
      MM_PROTECTIVE_SIZE_SCALE: '0.7',
      MM_PROTECTIVE_TOUCH_BUFFER_ADD_BPS: '6',
      MM_LAYER_GUARD_NEAR_BPS: '10',
      MM_LAYER_GUARD_MIN_DEPTH_SHARES: '12',
      MM_LAYER_GUARD_DEPTH_SPEED_BPS: '50',
      MM_DEPTH_SPEED_PAUSE_BPS: '80',
      MM_DEPTH_SPEED_PAUSE_MS: '6000',
      MM_TOUCH_BUFFER_BPS: '0.0012',
      MM_FILL_RISK_SPREAD_BPS: '0.0020',
      MM_NEAR_TOUCH_PENALTY_BPS: '10',
      MM_NEAR_TOUCH_SIZE_PENALTY: '0.8',
      MM_SOFT_CANCEL_BPS: '0.0015',
      MM_HARD_CANCEL_BPS: '0.0030',
      MM_HOLD_NEAR_TOUCH_MS: '700',
      MM_DYNAMIC_CANCEL_ON_FILL: 'true',
      MM_AUTO_TUNE_ENABLED: 'true',
      MM_AUTO_TUNE_TARGET_FILL_RATE: '0.015',
      MM_AUTO_TUNE_TARGET_CANCEL_RATE: '0.7',
      MM_AUTO_TUNE_TOUCH_BUFFER_WEIGHT: '0.6',
      MM_AUTO_TUNE_SIZE_WEIGHT: '0.5',
      MM_AUTO_TUNE_CANCEL_WEIGHT: '0.4',
      MM_AUTO_TUNE_REPRICE_WEIGHT: '0.4',
      MM_NEAR_TOUCH_BURST_LIMIT: '4',
      MM_NEAR_TOUCH_BURST_WINDOW_MS: '30000',
      MM_NEAR_TOUCH_BURST_HOLD_MS: '20000',
      MM_NEAR_TOUCH_BURST_SAFE_MODE: 'true',
      MM_NEAR_TOUCH_BURST_SAFE_MODE_MS: '30000',
      MM_FILL_BURST_LIMIT: '3',
      MM_FILL_BURST_WINDOW_MS: '30000',
      MM_FILL_BURST_HOLD_MS: '20000',
      MM_FILL_BURST_SAFE_MODE: 'true',
      MM_FILL_BURST_SAFE_MODE_MS: '30000',
    },
    'Probable 积分做市模板'
  );
}

function applyMmProbableHedgeTemplate() {
  applyTemplate(
    {
      MM_VENUE: 'probable',
      MM_REQUIRE_JWT: 'false',
      PROBABLE_ENABLED: 'true',
      PROBABLE_WS_ENABLED: 'true',
      MM_ONLY_POINTS_MARKETS: 'true',
      MM_POINTS_MIN_ONLY: 'true',
      MM_POINTS_MIN_MULTIPLIER: '1',
      MM_POINTS_ASSUME_ACTIVE: 'true',
      MM_POINTS_MIN_SHARES: '100',
      MM_POINTS_MAX_SPREAD_CENTS: '6',
      MM_ORDER_DEPTH_USAGE: '0.2',
      MM_ORDER_RISK_VWAP_BPS: '12',
      MM_ORDER_RISK_VWAP_SHARES: '30',
      MM_ORDER_RISK_VWAP_LEVELS: '4',
      MM_FAST_CANCEL_BPS: '10',
      MM_FAST_CANCEL_WINDOW_MS: '1000',
      MM_FAST_CANCEL_DEPTH_SPEED_BPS: '50',
      MM_FAST_CANCEL_SPREAD_JUMP_BPS: '8',
      MM_PROTECTIVE_DEPTH_SPEED_BPS: '70',
      MM_PROTECTIVE_SPREAD_JUMP_BPS: '8',
      MM_PROTECTIVE_TEMPLATE_ENABLED: 'true',
      MM_PROTECTIVE_HOLD_MS: '9000',
      MM_PROTECTIVE_MIN_INTERVAL_MS: '4500',
      MM_PROTECTIVE_LAYER_COUNT_CAP: '1',
      MM_PROTECTIVE_ONLY_FAR: 'true',
      MM_PROTECTIVE_FORCE_SINGLE: 'true',
      MM_PROTECTIVE_SINGLE_SIDE: 'NONE',
      MM_PROTECTIVE_SINGLE_SIDE_MODE: 'REMOTE',
      MM_PROTECTIVE_SINGLE_SIDE_OFFSET_BPS: '8',
      MM_PROTECTIVE_SINGLE_SIDE_AUTO: 'true',
      MM_PROTECTIVE_SINGLE_SIDE_IMBALANCE_THRESHOLD: '0.2',
      MM_PROTECTIVE_SIZE_SCALE: '0.7',
      MM_PROTECTIVE_TOUCH_BUFFER_ADD_BPS: '6',
      MM_LAYER_GUARD_NEAR_BPS: '10',
      MM_LAYER_GUARD_MIN_DEPTH_SHARES: '12',
      MM_LAYER_GUARD_DEPTH_SPEED_BPS: '50',
      MM_DEPTH_SPEED_PAUSE_BPS: '80',
      MM_DEPTH_SPEED_PAUSE_MS: '6000',
      HEDGE_ON_FILL: 'true',
      HEDGE_MODE: 'CROSS',
      CROSS_PLATFORM_ENABLED: 'true',
      CROSS_PLATFORM_AUTO_EXECUTE: 'true',
      HEDGE_TRIGGER_SHARES: '10',
      HEDGE_MAX_SLIPPAGE_BPS: '250',
      MM_PARTIAL_FILL_HEDGE_SLIPPAGE_BPS: '250',
      CROSS_PLATFORM_REQUIRE_WS: 'true',
      CROSS_PLATFORM_WS_REALTIME: 'true',
      CROSS_PLATFORM_WS_REALTIME_FALLBACK_ENABLED: 'true',
      CROSS_HEDGE_SIMILARITY_WEIGHT: '0.7',
      CROSS_HEDGE_DEPTH_WEIGHT: '0.3',
      CROSS_HEDGE_MIN_DEPTH_USD: '5',
      MM_TOUCH_BUFFER_BPS: '0.0015',
      MM_FILL_RISK_SPREAD_BPS: '0.0022',
      MM_NEAR_TOUCH_PENALTY_BPS: '10',
      MM_NEAR_TOUCH_SIZE_PENALTY: '0.8',
      MM_SOFT_CANCEL_BPS: '0.0015',
      MM_HARD_CANCEL_BPS: '0.0030',
      MM_HOLD_NEAR_TOUCH_MS: '700',
      MM_DYNAMIC_CANCEL_ON_FILL: 'true',
      MM_AUTO_TUNE_ENABLED: 'true',
      MM_AUTO_TUNE_TARGET_FILL_RATE: '0.015',
      MM_AUTO_TUNE_TARGET_CANCEL_RATE: '0.7',
      MM_AUTO_TUNE_TOUCH_BUFFER_WEIGHT: '0.6',
      MM_AUTO_TUNE_SIZE_WEIGHT: '0.5',
      MM_AUTO_TUNE_CANCEL_WEIGHT: '0.4',
      MM_AUTO_TUNE_REPRICE_WEIGHT: '0.4',
      MM_NEAR_TOUCH_BURST_LIMIT: '4',
      MM_NEAR_TOUCH_BURST_WINDOW_MS: '30000',
      MM_NEAR_TOUCH_BURST_HOLD_MS: '20000',
      MM_NEAR_TOUCH_BURST_SAFE_MODE: 'true',
      MM_NEAR_TOUCH_BURST_SAFE_MODE_MS: '30000',
      MM_FILL_BURST_LIMIT: '3',
      MM_FILL_BURST_WINDOW_MS: '30000',
      MM_FILL_BURST_HOLD_MS: '20000',
      MM_FILL_BURST_SAFE_MODE: 'true',
      MM_FILL_BURST_SAFE_MODE_MS: '30000',
    },
    'Probable 对冲模板'
  );
}

function applyArbSafeTemplate() {
  applyTemplate(
    {
      PREDICT_WS_ENABLED: 'true',
      POLYMARKET_WS_ENABLED: 'true',
      OPINION_WS_ENABLED: 'true',
      PROBABLE_WS_ENABLED: 'true',
      CROSS_PLATFORM_ENABLED: 'true',
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
      ARB_MIN_TOP_DEPTH_SHARES: '25',
      ARB_MIN_TOP_DEPTH_USD: '20',
      ARB_TOP_DEPTH_USAGE: '0.6',
      ARB_DEPTH_USAGE: '0.5',
      CROSS_PLATFORM_REQUIRE_WS: 'true',
      CROSS_PLATFORM_WS_REALTIME: 'true',
      CROSS_PLATFORM_WS_REALTIME_FALLBACK_ENABLED: 'true',
      CROSS_PLATFORM_MIN_DEPTH_SHARES: '5',
      CROSS_PLATFORM_MIN_DEPTH_USD: '3',
      CROSS_PLATFORM_MAX_VWAP_DEVIATION_BPS: '40',
      CROSS_PLATFORM_MAX_VWAP_LEVELS: '3',
      CROSS_PLATFORM_PRE_SUBMIT_VWAP_BPS: '60',
      CROSS_PLATFORM_PRE_SUBMIT_PROFIT_USD: '0.05',
      CROSS_PLATFORM_PRE_SUBMIT_TOTAL_COST_BPS: '30',
      CROSS_PLATFORM_PRE_SUBMIT_RECHECK_MS: '200',
      CROSS_PLATFORM_PRE_SUBMIT_GLOBAL: 'true',
      CROSS_PLATFORM_SHADOW_MIN_PROFIT_USD: '0.05',
      CROSS_PLATFORM_SHADOW_MIN_PROFIT_BPS: '20',
      CROSS_PLATFORM_SHADOW_IMPACT_BPS: '0',
      CROSS_PLATFORM_SHADOW_IMPACT_PER_LEVEL_BPS: '5',
      CROSS_PLATFORM_FAILURE_RATE_WINDOW_MS: '600000',
      CROSS_PLATFORM_FAILURE_RATE_MIN_ATTEMPTS: '12',
      CROSS_PLATFORM_FAILURE_RATE_THRESHOLD: '35',
      CROSS_PLATFORM_FAILURE_RATE_TIGHTEN_MAX: '1.6',
      CROSS_PLATFORM_FAILURE_RATE_STABILITY_SAMPLES_ADD: '1',
      CROSS_PLATFORM_FAILURE_RATE_STABILITY_INTERVAL_ADD_MS: '120',
      CROSS_PLATFORM_FAILURE_RATE_STABILITY_MAX_SAMPLES: '4',
      CROSS_PLATFORM_FAILURE_RATE_STABILITY_MAX_INTERVAL_MS: '600',
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

function getAvoidHourState() {
  const env = parseEnv(envEditor.value || '');
  const hours = String(env.get('CROSS_PLATFORM_AVOID_HOURS') || '')
    .split(',')
    .map((val) => Number(val))
    .filter((val) => Number.isFinite(val));
  const hour = new Date().getHours();
  const modeRaw = String(env.get('CROSS_PLATFORM_AVOID_HOURS_MODE') || 'BLOCK').toUpperCase();
  const mode = modeRaw === 'TEMPLATE' ? 'TEMPLATE' : 'BLOCK';
  return { hours, hour, active: hours.includes(hour), mode };
}

function getConsistencyHotspotHours() {
  const buckets = buildConsistencyHeatmapSeries();
  return buckets
    .map((count, hour) => ({ count, hour }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
    .map((entry) => entry.hour);
}

function getConsistencyHotspotScore() {
  const buckets = buildConsistencyHeatmapSeries();
  if (!buckets.length) return 0;
  return buckets.reduce((max, value) => (value > max ? value : max), 0);
}

function getAvoidModeThresholds() {
  const env = parseEnv(envEditor.value || '');
  const blockScore = Number(env.get('CROSS_PLATFORM_AVOID_HOURS_BLOCK_SCORE') || 3);
  const templateScore = Number(env.get('CROSS_PLATFORM_AVOID_HOURS_TEMPLATE_SCORE') || 1.5);
  return {
    blockScore: Number.isFinite(blockScore) && blockScore > 0 ? blockScore : 3,
    templateScore: Number.isFinite(templateScore) && templateScore > 0 ? templateScore : 1.5,
  };
}

function getAvoidSeverity(score) {
  if (!score || score <= 0) return { level: '无', tone: 'ok' };
  const { blockScore, templateScore } = getAvoidModeThresholds();
  if (score >= blockScore) return { level: '高', tone: 'error' };
  if (score >= templateScore) return { level: '中', tone: 'warn' };
  return { level: '低', tone: 'ok' };
}

function getAvoidTemplateFactorForSeverity(severityLevel) {
  if (severityLevel === '高') return 1.6;
  if (severityLevel === '中') return 1.3;
  if (severityLevel === '低') return 1.1;
  return 1.0;
}

function applyConsistencyAvoidHours() {
  const hours = getConsistencyHotspotHours();
  if (!hours.length) {
    pushLog({ type: 'system', level: 'system', message: '暂无一致性热区，未写入避开时段。' });
    return;
  }
  const value = hours.map((h) => String(h).padStart(2, '0')).join(',');
  applyTemplate({ CROSS_PLATFORM_AVOID_HOURS: value, CROSS_PLATFORM_AVOID_HOURS_AUTO: 'true' }, '避开一致性热区');
}

function maybeAutoApplyAvoidHours() {
  const env = parseEnv(envEditor.value || '');
  const auto = String(env.get('CROSS_PLATFORM_AVOID_HOURS_AUTO') || '').toLowerCase() === 'true';
  if (!auto) return;
  const hours = getConsistencyHotspotHours();
  if (!hours.length) return;
  const value = hours.map((h) => String(h).padStart(2, '0')).join(',');
  const current = String(env.get('CROSS_PLATFORM_AVOID_HOURS') || '');
  const modeAuto = String(env.get('CROSS_PLATFORM_AVOID_HOURS_MODE_AUTO') || '').toLowerCase() === 'true';
  const score = getConsistencyHotspotScore();
  const severity = getAvoidSeverity(score);
  const desiredMode = severity.level === '高' ? 'BLOCK' : 'TEMPLATE';
  const desiredFactor = getAvoidTemplateFactorForSeverity(severity.level);
  if (value && value !== current && value !== lastAutoAvoidHours) {
    let text = envEditor.value || '';
    text = setEnvValue(text, 'CROSS_PLATFORM_AVOID_HOURS', value);
    if (modeAuto) {
      text = setEnvValue(text, 'CROSS_PLATFORM_AVOID_HOURS_MODE', desiredMode);
      text = setEnvValue(text, 'CROSS_PLATFORM_AVOID_HOURS_TEMPLATE_FACTOR', String(desiredFactor));
    }
    envEditor.value = text;
    detectTradingMode(text);
    syncTogglesFromEnv(text);
    updateMetricsPaths();
    if (saveEnvButton) {
      saveEnvButton.classList.add('attention');
    }
    lastAutoAvoidHours = value;
    const modeMsg = modeAuto ? ` | 模式=${desiredMode} | 因子=${desiredFactor}` : '';
    pushLog({ type: 'system', level: 'system', message: `自动避开热区时段：${value}${modeMsg}（请保存生效）` });
  }
  if (modeAuto && value === current) {
    const currentMode = String(env.get('CROSS_PLATFORM_AVOID_HOURS_MODE') || 'BLOCK').toUpperCase();
    const currentFactor = Number(env.get('CROSS_PLATFORM_AVOID_HOURS_TEMPLATE_FACTOR') || desiredFactor);
    if (currentMode !== desiredMode || currentFactor !== desiredFactor) {
      let text = envEditor.value || '';
      text = setEnvValue(text, 'CROSS_PLATFORM_AVOID_HOURS_MODE', desiredMode);
      text = setEnvValue(text, 'CROSS_PLATFORM_AVOID_HOURS_TEMPLATE_FACTOR', String(desiredFactor));
      envEditor.value = text;
      detectTradingMode(text);
      syncTogglesFromEnv(text);
      updateMetricsPaths();
      if (saveEnvButton) {
        saveEnvButton.classList.add('attention');
      }
      pushLog({
        type: 'system',
        level: 'system',
        message: `热区强度变化，避开策略切换为 ${desiredMode}，模板因子=${desiredFactor}（请保存生效）`,
      });
    }
  }
}

function maybeToggleCrossPlatformAutoExecute() {
  const env = parseEnv(envEditor.value || '');
  const { hours: avoidHours, hour, active, mode } = getAvoidHourState();
  if (mode !== 'BLOCK') {
    if (autoDisabledCrossPlatform) {
      autoDisabledCrossPlatform = false;
    }
    return;
  }
  if (!avoidHours.length) {
    if (autoDisabledCrossPlatform) {
      let text = envEditor.value || '';
      text = setEnvValue(text, 'CROSS_PLATFORM_AUTO_EXECUTE', 'true');
      envEditor.value = text;
      detectTradingMode(text);
      syncTogglesFromEnv(text);
      updateMetricsPaths();
      if (saveEnvButton) {
        saveEnvButton.classList.add('attention');
      }
      pushLog({ type: 'system', level: 'system', message: '避开时段解除，已恢复跨平台自动执行（请保存生效）。' });
      autoDisabledCrossPlatform = false;
    }
    return;
  }
  if (active) {
    const enabled = String(env.get('CROSS_PLATFORM_AUTO_EXECUTE') || '').toLowerCase() === 'true';
    if (enabled) {
      let text = envEditor.value || '';
      text = setEnvValue(text, 'CROSS_PLATFORM_AUTO_EXECUTE', 'false');
      envEditor.value = text;
      detectTradingMode(text);
      syncTogglesFromEnv(text);
      updateMetricsPaths();
      if (saveEnvButton) {
        saveEnvButton.classList.add('attention');
      }
      pushLog({ type: 'system', level: 'system', message: `避开时段 ${String(hour).padStart(2, '0')}:00，已暂停跨平台自动执行（请保存生效）。` });
      autoDisabledCrossPlatform = true;
    }
  } else if (autoDisabledCrossPlatform) {
    let text = envEditor.value || '';
    text = setEnvValue(text, 'CROSS_PLATFORM_AUTO_EXECUTE', 'true');
    envEditor.value = text;
    detectTradingMode(text);
    syncTogglesFromEnv(text);
    updateMetricsPaths();
    if (saveEnvButton) {
      saveEnvButton.classList.add('attention');
    }
    pushLog({ type: 'system', level: 'system', message: '避开时段结束，已恢复跨平台自动执行（请保存生效）。' });
    autoDisabledCrossPlatform = false;
  }
}

function notifyAvoidHourStatus() {
  const { hours, hour, active, mode } = getAvoidHourState();
  if (!hours.length) {
    lastAvoidNoticeActive = false;
    lastAvoidNoticeHour = -1;
    return;
  }
  if (active && (!lastAvoidNoticeActive || lastAvoidNoticeHour !== hour)) {
    const label = String(hour).padStart(2, '0');
    const message =
      mode === 'TEMPLATE'
        ? `避开时段 ${label}:00 生效，已启用一致性模板（不强制暂停）。`
        : `避开时段 ${label}:00 生效，跨平台将暂停。`;
    pushLog({ type: 'system', level: 'system', message });
    lastAvoidNoticeActive = true;
    lastAvoidNoticeHour = hour;
    return;
  }
  if (!active && lastAvoidNoticeActive) {
    pushLog({ type: 'system', level: 'system', message: '避开时段结束，跨平台可恢复执行。' });
    lastAvoidNoticeActive = false;
    lastAvoidNoticeHour = -1;
  }
}

function getLatestErrorHint() {
  const raw =
    (latestMetrics && latestMetrics.metrics && latestMetrics.metrics.lastError) ||
    (latestMetrics && latestMetrics.lastError) ||
    '';
  const text = String(raw || '').trim();
  if (!text) return '';
  return text.length > 160 ? `${text.slice(0, 160)}...` : text;
}

function buildExecutionErrorHints() {
  const hint = getLatestErrorHint();
  if (!hint) return [];
  const msg = hint.toLowerCase();
  const lines = [`# 最近错误: ${hint}`];
  if (msg.includes('rate') || msg.includes('429') || msg.includes('too many')) {
    lines.push('# 可能被限速：建议降低并发/提高冷却时间');
    lines.push('CROSS_PLATFORM_GLOBAL_COOLDOWN_MS=180000');
  }
  if (msg.includes('timeout') || msg.includes('timed out')) {
    lines.push('# 可能网络超时：建议提高重试间隔或开启 WS 实时行情');
    lines.push('CROSS_PLATFORM_RETRY_DELAY_MS=800');
  }
  if (msg.includes('insufficient') || msg.includes('balance') || msg.includes('margin')) {
    lines.push('# 可能余额不足：请检查 USDC/保证金余额与授权额度');
  }
  if (msg.includes('nonce') || msg.includes('replacement')) {
    lines.push('# 可能 nonce 冲突：避免多进程同时使用同一私钥');
  }
  if (msg.includes('signature') || msg.includes('jwt') || msg.includes('auth')) {
    lines.push('# 可能签名/鉴权问题：检查 JWT_TOKEN 与 API 密钥');
  }
  return lines;
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
    } else if (category === '硬门控') {
      appendLines(category, getHardGateFixLines());
    } else if (category === '执行失败') {
      appendLines(
        category,
        [
          'CROSS_PLATFORM_MAX_RETRIES=1',
          'CROSS_PLATFORM_RETRY_DELAY_MS=500',
          'CROSS_PLATFORM_ABORT_COOLDOWN_MS=120000',
          'CROSS_PLATFORM_MIN_PROFIT_USD=0.03',
          'CROSS_PLATFORM_MIN_DEPTH_USD=8',
          ...buildExecutionErrorHints(),
        ].flat()
      );
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

function applyFixTemplate(quiet = false) {
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
  if (!quiet) {
    pushLog({ type: 'system', level: 'system', message: '已应用修复建议模板（请保存生效）' });
  }
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

function maybeAutoDowngradeMaker(healthScore) {
  if (!Number.isFinite(healthScore)) return;
  const env = parseEnv(envEditor.value || '');
  const enabled = String(env.get('MM_UI_AUTO_APPLY_RECOVERY_TEMPLATE') || '').toLowerCase() === 'true';
  if (!enabled) return;
  const safeThreshold = Number(env.get('MM_UI_AUTO_SAFE_THRESHOLD') || 55);
  const ultraThreshold = Number(env.get('MM_UI_AUTO_ULTRA_THRESHOLD') || 35);
  const cooldownMs = Number(env.get('MM_UI_AUTO_COOLDOWN_MS') || 10 * 60 * 1000);
  const now = Date.now();
  if (mmAutoDowngradeUntil && now < mmAutoDowngradeUntil) {
    return;
  }
  if (ultraThreshold > 0 && healthScore <= ultraThreshold) {
    applyRecoveryTemplatePreset('ultra');
    mmAutoDowngradeUntil = now + cooldownMs;
    pushLog({ type: 'system', level: 'system', message: `做市健康评分 ${healthScore} 触发自动极保守模板` });
    return;
  }
  if (safeThreshold > 0 && healthScore <= safeThreshold) {
    applyRecoveryTemplatePreset('safe');
    mmAutoDowngradeUntil = now + cooldownMs;
    pushLog({ type: 'system', level: 'system', message: `做市健康评分 ${healthScore} 触发自动保守模板` });
  }
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

function renderNewbieChecklist(items) {
  if (!newbieChecklist) return;
  newbieChecklist.innerHTML = '';
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'health-item ok';
    empty.textContent = '未发现问题。';
    newbieChecklist.appendChild(empty);
    return;
  }
  items.forEach((item) => {
    const row = document.createElement('div');
    row.className = `health-item ${item.level || 'warn'}`;
    const title = document.createElement('span');
    title.textContent = item.title;
    const message = document.createElement('span');
    message.textContent = item.message || '';
    row.appendChild(title);
    row.appendChild(message);
    newbieChecklist.appendChild(row);
  });
}

function runNewbieCheck() {
  const env = parseEnv(envEditor.value || '');
  const items = [];
  const get = (key) => String(env.get(key) || '').trim();
  const isTrue = (key) => get(key).toLowerCase() === 'true';
  const mmVenue = (get('MM_VENUE') || 'predict').toLowerCase();
  const enableTrading = isTrue('ENABLE_TRADING');
  const arbAuto = isTrue('ARB_AUTO_EXECUTE') || isTrue('CROSS_PLATFORM_AUTO_EXECUTE');
  const requireJwt = get('MM_REQUIRE_JWT').toLowerCase() !== 'false';
  const apiKey = get('API_KEY');
  const privateKey = get('PRIVATE_KEY');
  const jwtToken = get('JWT_TOKEN');
  const probableKey = get('PROBABLE_PRIVATE_KEY');
  const polymarketKey = get('POLYMARKET_PRIVATE_KEY');
  const opinionKey = get('OPINION_PRIVATE_KEY');
  const opinionApiKey = get('OPINION_API_KEY');

  if (!apiKey) {
    items.push({ level: 'error', title: 'API_KEY', message: '缺失，无法获取 Predict 数据' });
  } else {
    items.push({ level: 'ok', title: 'API_KEY', message: '已配置' });
  }

  if (!privateKey && !probableKey) {
    items.push({ level: 'error', title: 'PRIVATE_KEY', message: '缺失，无法签名/下单' });
  } else {
    items.push({ level: 'ok', title: 'PRIVATE_KEY', message: '已配置' });
  }

  if ((enableTrading || arbAuto) && !jwtToken && requireJwt) {
    items.push({ level: 'error', title: 'JWT_TOKEN', message: '实盘/自动执行需要 JWT' });
  } else if (jwtToken) {
    items.push({ level: 'ok', title: 'JWT_TOKEN', message: '已配置' });
  } else {
    items.push({ level: 'warn', title: 'JWT_TOKEN', message: '当前模式可选' });
  }

  if (mmVenue === 'probable') {
    if (!isTrue('PROBABLE_ENABLED')) {
      items.push({ level: 'warn', title: 'PROBABLE_ENABLED', message: 'Probable 做市需启用' });
    }
    if (!probableKey && !privateKey) {
      items.push({ level: 'error', title: 'PROBABLE_PRIVATE_KEY', message: '未配置 Probable 私钥' });
    } else {
      items.push({ level: 'ok', title: 'PROBABLE_PRIVATE_KEY', message: '已配置/复用 PRIVATE_KEY' });
    }
  }

  if (isTrue('CROSS_PLATFORM_ENABLED')) {
    if (!get('CROSS_PLATFORM_MAPPING_PATH')) {
      items.push({ level: 'warn', title: '映射文件', message: '建议检查 cross-platform-mapping.json' });
    } else {
      items.push({ level: 'ok', title: '映射文件', message: '已配置路径' });
    }
  }

  if (isTrue('CROSS_PLATFORM_AUTO_EXECUTE')) {
    if (!polymarketKey) {
      items.push({ level: 'warn', title: 'POLYMARKET_PRIVATE_KEY', message: '跨平台自动执行建议配置' });
    }
    if (!opinionKey || !opinionApiKey) {
      items.push({ level: 'warn', title: 'OPINION 密钥', message: 'Opinion 自动执行需要 API_KEY + PRIVATE_KEY' });
    }
  }

  if (isTrue('ARB_REQUIRE_WS') && !isTrue('PREDICT_WS_ENABLED')) {
    items.push({ level: 'error', title: 'PREDICT_WS_ENABLED', message: '套利强制 WS 需开启' });
  }
  if (isTrue('CROSS_PLATFORM_REQUIRE_WS')) {
    const hasWs =
      isTrue('POLYMARKET_WS_ENABLED') || isTrue('OPINION_WS_ENABLED') || isTrue('PROBABLE_WS_ENABLED');
    if (!hasWs) {
      items.push({ level: 'error', title: '跨平台 WS', message: '需至少开启一个平台 WS' });
    }
  }

  renderNewbieChecklist(items);
  if (newbieHint) {
    const hasError = items.some((item) => item.level === 'error');
    newbieHint.textContent = hasError ? '存在必填项缺失，请补齐后再实盘。' : '检查完成，可继续下一步。';
  }
}

function renderPreflightChecklist(items) {
  if (!preflightChecklist) return;
  preflightChecklist.innerHTML = '';
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'health-item ok';
    empty.textContent = '未发现问题。';
    preflightChecklist.appendChild(empty);
    return;
  }
  items.forEach((item) => {
    const row = document.createElement('div');
    row.className = `health-item ${item.level || 'warn'}`;
    const title = document.createElement('span');
    title.textContent = item.title;
    const message = document.createElement('span');
    message.textContent = item.message || '';
    row.appendChild(title);
    row.appendChild(message);
    preflightChecklist.appendChild(row);
  });
}

function buildPreflightText(items) {
  const lines = ['# 执行前最后检查清单'];
  if (!items.length) {
    lines.push('- 未发现问题');
    return lines.join('\n');
  }
  items.forEach((item) => {
    const label = item.level === 'error' ? '必须' : item.level === 'warn' ? '建议' : '确认';
    const message = item.message ? `：${item.message}` : '';
    lines.push(`- [${label}] ${item.title}${message}`);
  });
  return lines.join('\n');
}

function runPreflightCheck() {
  const env = parseEnv(envEditor.value || '');
  const items = [];
  const get = (key) => String(env.get(key) || '').trim();
  const isTrue = (key) => get(key).toLowerCase() === 'true';
  const num = (key) => Number(get(key) || 0);
  const mmEnabled = isTrue('MM_ENABLED') || isTrue('ENABLE_MM') || isTrue('ENABLE_TRADING');
  const arbEnabled = isTrue('ARB_ENABLED') || isTrue('CROSS_PLATFORM_ENABLED') || isTrue('ARB_AUTO_EXECUTE');
  const autoExec = isTrue('ARB_AUTO_EXECUTE') || isTrue('CROSS_PLATFORM_AUTO_EXECUTE');
  const wsOk =
    isTrue('PREDICT_WS_ENABLED') ||
    isTrue('POLYMARKET_WS_ENABLED') ||
    isTrue('OPINION_WS_ENABLED') ||
    isTrue('PROBABLE_WS_ENABLED');

  if (!isTrue('ENABLE_TRADING')) {
    items.push({ level: 'warn', title: 'ENABLE_TRADING', message: '当前为模拟模式' });
  } else {
    items.push({ level: 'ok', title: 'ENABLE_TRADING', message: '已开启' });
  }

  if (autoExec && !isTrue('AUTO_CONFIRM')) {
    items.push({ level: 'error', title: 'AUTO_CONFIRM', message: '自动执行时必须开启' });
  } else if (autoExec) {
    items.push({ level: 'ok', title: 'AUTO_CONFIRM', message: '自动执行已确认' });
  } else {
    items.push({ level: 'warn', title: 'AUTO_CONFIRM', message: '未开启自动执行' });
  }

  if (mmEnabled && !isTrue('MM_WS_ENABLED')) {
    items.push({ level: 'warn', title: 'MM_WS_ENABLED', message: '做市建议开启 WS 实时行情' });
  } else if (mmEnabled) {
    items.push({ level: 'ok', title: 'MM_WS_ENABLED', message: '已开启' });
  }

  if (arbEnabled && !wsOk) {
    items.push({ level: 'warn', title: '行情 WS', message: '套利建议至少开启一个 WS 行情源' });
  } else if (arbEnabled) {
    items.push({ level: 'ok', title: '行情 WS', message: '已开启' });
  }

  if (arbEnabled && !isTrue('ARB_PREFLIGHT_ENABLED')) {
    items.push({ level: 'warn', title: 'ARB_PREFLIGHT_ENABLED', message: '建议开启预检，防止误下单' });
  } else if (arbEnabled) {
    items.push({ level: 'ok', title: 'ARB_PREFLIGHT_ENABLED', message: '已开启' });
  }

  if (arbEnabled && !isTrue('CROSS_PLATFORM_EXECUTION_VWAP_CHECK')) {
    items.push({ level: 'warn', title: 'CROSS_PLATFORM_EXECUTION_VWAP_CHECK', message: '建议开启 VWAP 保护' });
  } else if (arbEnabled) {
    items.push({ level: 'ok', title: 'CROSS_PLATFORM_EXECUTION_VWAP_CHECK', message: '已开启' });
  }

  if (arbEnabled) {
    const minProfit = num('CROSS_PLATFORM_MIN_PROFIT_USD');
    if (!Number.isFinite(minProfit) || minProfit <= 0) {
      items.push({ level: 'warn', title: 'CROSS_PLATFORM_MIN_PROFIT_USD', message: '建议设置最低利润门槛' });
    } else {
      items.push({ level: 'ok', title: 'CROSS_PLATFORM_MIN_PROFIT_USD', message: `${minProfit}` });
    }
  }

  if (mmEnabled) {
    const fastCancel = num('MM_FAST_CANCEL_BPS');
    if (!Number.isFinite(fastCancel) || fastCancel <= 0) {
      items.push({ level: 'warn', title: 'MM_FAST_CANCEL_BPS', message: '建议设置快速撤单阈值' });
    } else {
      items.push({ level: 'ok', title: 'MM_FAST_CANCEL_BPS', message: `${fastCancel}` });
    }
  }

  if (autoExec) {
    const circuit = num('CROSS_PLATFORM_CIRCUIT_MAX_FAILURES');
    if (!Number.isFinite(circuit) || circuit <= 0) {
      items.push({ level: 'warn', title: 'CROSS_PLATFORM_CIRCUIT_MAX_FAILURES', message: '建议设置熔断阈值' });
    } else {
      items.push({ level: 'ok', title: 'CROSS_PLATFORM_CIRCUIT_MAX_FAILURES', message: `${circuit}` });
    }
  }

  lastPreflightChecklist = items;
  renderPreflightChecklist(items);
  if (preflightHint) {
    const hasError = items.some((item) => item.level === 'error');
    preflightHint.textContent = hasError ? '存在必须项未满足，请先修复。' : '检查完成。';
  }
}

function applyBeginnerTemplate() {
  applyTemplate(
    {
      ENABLE_TRADING: 'false',
      AUTO_CONFIRM: 'false',
      ARB_AUTO_EXECUTE: 'false',
      ARB_AUTO_EXECUTE_VALUE: 'false',
      CROSS_PLATFORM_AUTO_EXECUTE: 'false',
      MM_WS_ENABLED: 'true',
      PREDICT_WS_ENABLED: 'true',
      POLYMARKET_WS_ENABLED: 'true',
      OPINION_WS_ENABLED: 'true',
      PROBABLE_WS_ENABLED: 'true',
      ARB_PREFLIGHT_ENABLED: 'true',
      ARB_REQUIRE_WS: 'true',
      ARB_WS_REALTIME: 'true',
      CROSS_PLATFORM_ENABLED: 'true',
      CROSS_PLATFORM_REQUIRE_WS: 'true',
      CROSS_PLATFORM_WS_REALTIME: 'true',
      CROSS_PLATFORM_WS_REALTIME_FALLBACK_ENABLED: 'true',
      MM_POINTS_ASSUME_ACTIVE: 'true',
    },
    '新手完整模板'
  );
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

async function exportMmEvents() {
  if (!window.predictBot.exportMmEvents) {
    if (mmEventHint) mmEventHint.textContent = '当前版本不支持导出事件。';
    return;
  }
  const result = await window.predictBot.exportMmEvents();
  if (!result || !result.ok) {
    if (mmEventHint) {
      mmEventHint.textContent = result?.message || '事件导出失败，请稍后重试。';
    }
    return;
  }
  if (mmEventHint) {
    mmEventHint.textContent = `事件已导出：${result.path}`;
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
  const decayDays = Number(parseEnv(envEditor.value || '').get('CROSS_PLATFORM_AVOID_HOURS_DECAY_DAYS') || 3);
  const decayWindow = Math.max(1, decayDays) * 24 * 60 * 60 * 1000;
  const cutoff = now - decayWindow;
  for (const event of failureEvents) {
    if (!event?.isConsistency || !event?.ts) continue;
    if (event.ts < cutoff) continue;
    const hour = new Date(event.ts).getHours();
    const age = Math.max(0, now - event.ts);
    const weight = Math.max(0.1, 1 - age / decayWindow);
    buckets[hour] += weight;
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
  consistencyCooldownActive,
  consistencyRateLimitActive,
  avoidActive,
  avoidMode,
  consistencyPressure,
  hardGateActiveUntil,
  hardGateReason,
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
  if (consistencyPressure >= 0.6) {
    warnings.push('一致性压力偏高，系统将自动收紧模板并降低频率。');
  }
  if (hardGateActiveUntil && hardGateActiveUntil > Date.now()) {
    warnings.push(`硬门控触发中，原因：${hardGateReason || '未知'}。`);
  }
  const { hours: avoidHours, hour, mode: stateAvoidMode } = getAvoidHourState();
  const mode = avoidMode || stateAvoidMode;
  if (avoidHours.length > 0 && avoidActive) {
    if (mode === 'TEMPLATE') {
      warnings.push(`当前处于避开时段（${String(hour).padStart(2, '0')}:00），已启用一致性模板。`);
    } else {
      warnings.push(`当前处于避开时段（${String(hour).padStart(2, '0')}:00），跨平台将暂停。`);
    }
  }
  const autoEnabled = String(parseEnv(envEditor.value || '').get('CROSS_PLATFORM_AVOID_HOURS_AUTO') || '').toLowerCase() === 'true';
  if (autoEnabled) {
    warnings.push('已启用自动避开热区时段，并联动跨平台自动执行。');
  }
  if (consistencyCooldownActive) {
    warnings.push('一致性冷却生效中，跨平台暂停执行。');
  } else if (consistencyRateLimitActive) {
    warnings.push('一致性限速生效中，执行频率已降低。');
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
  consistencyCooldownActive,
  consistencyRateLimitActive,
  avoidActive,
  avoidMode,
  consistencyPressure,
  hardGateActiveUntil,
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
  if (consistencyCooldownActive) {
    const weighted = 30 * riskWeights.consistency;
    score += weighted;
    breakdown.push({ label: `一致性冷却 x${riskWeights.consistency.toFixed(1)}`, score: weighted.toFixed(1) });
  } else if (consistencyRateLimitActive) {
    const weighted = 15 * riskWeights.consistency;
    score += weighted;
    breakdown.push({ label: `一致性限速 x${riskWeights.consistency.toFixed(1)}`, score: weighted.toFixed(1) });
  }
  if (consistencyPressure >= 0.6) {
    const weighted = 20 * riskWeights.consistency;
    score += weighted;
    breakdown.push({ label: `一致性压力 x${riskWeights.consistency.toFixed(1)}`, score: weighted.toFixed(1) });
  } else if (consistencyPressure >= 0.3) {
    const weighted = 10 * riskWeights.consistency;
    score += weighted;
    breakdown.push({ label: `一致性压力上升 x${riskWeights.consistency.toFixed(1)}`, score: weighted.toFixed(1) });
  }
  if (hardGateActiveUntil && hardGateActiveUntil > Date.now()) {
    const weighted = 35 * riskWeights.consistency;
    score += weighted;
    breakdown.push({ label: `硬门控触发 x${riskWeights.consistency.toFixed(1)}`, score: weighted.toFixed(1) });
  }
  if (avoidActive) {
    const base = avoidMode === 'TEMPLATE' ? 15 : 35;
    const weighted = base * riskWeights.consistency;
    score += weighted;
    breakdown.push({ label: `避开时段 x${riskWeights.consistency.toFixed(1)}`, score: weighted.toFixed(1) });
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
    latestMetrics = data;

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
    if (metricConsistencyRateLimit) {
      const until = Number(data.consistencyRateLimitUntil || 0);
      metricConsistencyRateLimit.textContent = until && until > Date.now() ? `限速中：${formatTimestamp(until)}` : '未触发';
    }
    if (metricConsistencyCooldown) {
      const until = Number(data.consistencyCooldownUntil || 0);
      metricConsistencyCooldown.textContent = until && until > Date.now() ? `冷却中：${formatTimestamp(until)}` : '未触发';
    }
    if (metricConsistencyTighten) {
      const factor = Number(data.consistencyTemplateFactor || 1);
      metricConsistencyTighten.textContent = formatNumber(factor, 2);
    }
    if (metricConsistencyPressure) {
      const pressure = Number(data.consistencyPressure || 0);
      metricConsistencyPressure.textContent = Number.isFinite(pressure)
        ? `${formatNumber(pressure, 2)}`
        : '未触发';
    }
    if (metricConsistencySize) {
      const pressure = Number(data.consistencyPressure || 0);
      const minFactor = Number(parseEnv(envEditor.value || '').get('CROSS_PLATFORM_CONSISTENCY_PRESSURE_SIZE_MIN') || 1);
      const hardThreshold = Number(
        parseEnv(envEditor.value || '').get('CROSS_PLATFORM_CONSISTENCY_PRESSURE_HARD_THRESHOLD') || 0
      );
      const hardFactor = Number(
        parseEnv(envEditor.value || '').get('CROSS_PLATFORM_CONSISTENCY_PRESSURE_HARD_FACTOR') || 1
      );
      const clampedPressure = Math.max(0, Math.min(1, pressure));
      let factor =
        Number.isFinite(pressure) && Number.isFinite(minFactor)
          ? 1 - clampedPressure * (1 - Math.max(0.05, Math.min(1, minFactor)))
          : 1;
      if (hardThreshold > 0 && clampedPressure >= hardThreshold) {
        factor = Math.min(factor, Math.max(0.05, Math.min(1, hardFactor)));
      }
      metricConsistencySize.textContent = `x${formatNumber(factor, 2)}`;
    }
    const env = parseEnv(envEditor.value || '');
    const autoFailureFix = String(env.get('CROSS_PLATFORM_AUTO_APPLY_FAILURE_FIX') || '').toLowerCase() === 'true';
    const autoFailureRate = parseFloat(env.get('CROSS_PLATFORM_AUTO_APPLY_FAILURE_RATE') || '25');
    const autoCooldownMs = 5 * 60 * 1000;
    if (
      autoFailureFix &&
      hasAdvice &&
      Number.isFinite(autoFailureRate) &&
      failureRate >= autoFailureRate &&
      Date.now() - lastAutoFailureFixAt > autoCooldownMs
    ) {
      lastAutoFailureFixAt = Date.now();
      applyFixTemplate(true);
      if (healthExportHint) {
        healthExportHint.textContent = '失败率偏高，已自动套用修复模板，请点击“保存配置”生效。';
      }
      pushLog({ type: 'system', level: 'system', message: '失败率偏高，已自动套用修复模板（请保存生效）' });
    }
    if (metricHardGate) {
      const until = Number(data.hardGateActiveUntil || 0);
      const reason = typeof data.lastHardGateReason === 'string' ? data.lastHardGateReason : '';
      if (until && until > Date.now()) {
        metricHardGate.textContent = `触发中：${formatTimestamp(until)} ${reason ? `(${reason})` : ''}`;
      } else {
        metricHardGate.textContent = '未触发';
      }
    }
    if (metricConsistencyPenalty) {
      const pressure = Number(data.consistencyPressure || 0);
      const maxDelay = Number(parseEnv(envEditor.value || '').get('CROSS_PLATFORM_CONSISTENCY_PRESSURE_RETRY_DELAY_MS') || 0);
      const delay = maxDelay > 0 && Number.isFinite(pressure) ? Math.round(maxDelay * pressure) : 0;
      metricConsistencyPenalty.textContent = delay > 0 ? `${delay}ms` : '未触发';
    }
    const avoidState = getAvoidHourState();
    if (metricAvoidHours) {
      const env = parseEnv(envEditor.value || '');
      const value = env.get('CROSS_PLATFORM_AVOID_HOURS') || '';
      metricAvoidHours.textContent = value ? String(value) : '未设置';
    }
    if (metricAvoidMode) {
      metricAvoidMode.textContent = avoidState.mode === 'TEMPLATE' ? '模板保守' : 'BLOCK';
    }
    if (metricAvoidSeverity) {
      const score = getConsistencyHotspotScore();
      const severity = getAvoidSeverity(score);
      const factor = getAvoidTemplateFactorForSeverity(severity.level);
      const suffix = score > 0 ? ` (${formatNumber(score, 2)})` : '';
      metricAvoidSeverity.textContent = `${severity.level}${suffix} / x${formatNumber(factor, 2)}`;
    }
    if (metricWsHealthScore) {
      const score = Number(data.wsHealthScore);
      metricWsHealthScore.textContent = Number.isFinite(score) ? `${Math.round(score)}` : '--';
    }
    if (metricWsHealthTighten) {
      const tighten = Number(data.wsHealthTightenFactor);
      metricWsHealthTighten.textContent =
        Number.isFinite(tighten) && tighten > 0 ? `x${formatNumber(1 / tighten, 2)}` : '--';
    }
    if (metricWsHealthScore) {
      const score = Number(data.wsHealthScore);
      const hardThreshold = Number(
        parseEnv(envEditor.value || '').get('CROSS_PLATFORM_WS_HEALTH_HARD_THRESHOLD') || 0
      );
      const label = Number.isFinite(score) ? `${Math.round(score)}` : '--';
      if (Number.isFinite(score) && hardThreshold > 0 && score <= hardThreshold) {
        metricWsHealthScore.textContent = `${label} (硬)`;
      } else {
        metricWsHealthScore.textContent = label;
      }
    }
    if (metricAvoidDecay) {
      const env = parseEnv(envEditor.value || '');
      const decay = Number(env.get('CROSS_PLATFORM_AVOID_HOURS_DECAY_DAYS') || 3);
      metricAvoidDecay.textContent = Number.isFinite(decay) ? `${decay} 天` : '未设置';
    }
    const { hour: avoidHour, active: avoidActive, mode: avoidMode } = avoidState;
    const templateUntil = Number(data.consistencyTemplateActiveUntil || 0);
    const overrideUntil = Number(data.consistencyOverrideUntil || 0);
    const cooldownUntil = Number(data.consistencyCooldownUntil || 0);
    const rateLimitUntil = Number(data.consistencyRateLimitUntil || 0);
    const consistencyCooldownActive = cooldownUntil > Date.now();
    const consistencyRateLimitActive = rateLimitUntil > Date.now();
    if (consistencyBadge) {
      if (avoidActive) {
        const label = String(avoidHour).padStart(2, '0');
        const text = avoidMode === 'TEMPLATE' ? `避开时段 ${label}:00（模板）` : `避开时段 ${label}:00`;
        const tone = avoidMode === 'TEMPLATE' ? 'warn' : 'error';
        setConsistencyBadge(text, tone);
      } else if (consistencyCooldownActive) {
        setConsistencyBadge('一致性冷却', 'error');
      } else if (templateUntil > Date.now()) {
        setConsistencyBadge('一致性模板中', 'warn');
      } else if (overrideUntil > Date.now()) {
        setConsistencyBadge('一致性保守中', 'warn');
      } else if (consistencyRateLimitActive) {
        setConsistencyBadge('一致性限速', 'warn');
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
    const globalCooldownUntil = Number(data.globalCooldownUntil || 0);
    setMetricText(
      metricCooldown,
      globalCooldownUntil && globalCooldownUntil > Date.now() ? `冷却中：${formatTimestamp(globalCooldownUntil)}` : '未触发'
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
      consistencyCooldownActive,
      consistencyRateLimitActive,
      avoidActive,
      avoidMode: avoidState.mode,
      consistencyPressure: Number(data.consistencyPressure || 0),
      hardGateActiveUntil: Number(data.hardGateActiveUntil || 0),
      hardGateReason: typeof data.lastHardGateReason === 'string' ? data.lastHardGateReason : '',
      consistencyFailureRate,
      consistencyHigh: consistencyFailureRate >= 25,
    };
    if (metricsSnapshot.hardGateActiveUntil && metricsSnapshot.hardGateActiveUntil > Date.now()) {
      recordHardGateEvent(metricsSnapshot.hardGateReason);
    }
    if (applyConsistencyTemplateBtn) {
      const env = parseEnv(envEditor.value || '');
      const templateEnabled = String(env.get('CROSS_PLATFORM_CONSISTENCY_TEMPLATE_ENABLED') || '').toLowerCase() === 'true';
      if (!templateEnabled && metricsSnapshot.consistencyHigh) {
        applyConsistencyTemplateBtn.classList.add('attention');
        applyConsistencyTemplateBtn.textContent = '建议启用一致性模板';
      } else {
        applyConsistencyTemplateBtn.classList.remove('attention');
        applyConsistencyTemplateBtn.textContent = '一致性模板';
      }
    }
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
    maybeAutoApplyAvoidHours();
    maybeToggleCrossPlatformAutoExecute();
    notifyAvoidHourStatus();
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
    const wsHealth = data.wsHealth || {};
    const markets = Array.isArray(data.markets) ? data.markets : [];
    const emergencyActive = wsHealth.wsEmergencyActive === true;
    const halted = data.tradingHalted ? '已熔断' : emergencyActive ? '急撤冷却中' : '运行中';
    setMetricText(mmTradingStatus, halted);
    setMetricText(mmPnL, data.sessionPnL !== undefined ? data.sessionPnL.toFixed(2) : '--');
    // 更新PnL图表
    if (typeof updatePnLChart === 'function' && data.sessionPnL !== undefined) {
      try {
        updatePnLChart(data.sessionPnL);
      } catch (e) {
        // 忽略图表更新错误
      }
    }
    setMetricText(mmOpenOrders, `${data.openOrders ?? '--'}`);
    setMetricText(mmPositions, `${data.positions ?? '--'}`);
    if (mmWsHealth) {
      const score = Number.isFinite(wsHealth.score) ? Math.round(wsHealth.score) : '--';
      setMetricText(mmWsHealth, score === '--' ? '--' : `${score}`);
      if (mmWsHealthHint) {
        const spreadMult = Number.isFinite(wsHealth.spreadMult) ? wsHealth.spreadMult.toFixed(2) : '--';
        const sizeMult = Number.isFinite(wsHealth.sizeMult) ? wsHealth.sizeMult.toFixed(2) : '--';
        const layerMult = Number.isFinite(wsHealth.layerMult) ? wsHealth.layerMult.toFixed(2) : '--';
        const intervalMult = Number.isFinite(wsHealth.intervalMult) ? wsHealth.intervalMult.toFixed(2) : '--';
        const onlyFar = wsHealth.onlyFar ? '远层' : '常规';
        const sizeScale = Number.isFinite(wsHealth.sizeScale) ? wsHealth.sizeScale.toFixed(2) : '--';
        const singleSide = wsHealth.singleSide || 'NONE';
        const singleMode = wsHealth.singleMode || 'NORMAL';
        const touchAdd = Number.isFinite(wsHealth.touchBufferAddBps) ? wsHealth.touchBufferAddBps.toFixed(1) : '--';
        const sparse = wsHealth.sparseOdd ? '稀疏' : '常规';
        const layerCap = Number.isFinite(wsHealth.wsLayerCap) ? wsHealth.wsLayerCap : '--';
        const maxOrdersMult = Number.isFinite(wsHealth.wsMaxOrdersMult) ? wsHealth.wsMaxOrdersMult.toFixed(2) : '--';
        const softCancelMult = Number.isFinite(wsHealth.wsSoftCancelMult) ? wsHealth.wsSoftCancelMult.toFixed(2) : '--';
        const hardCancelMult = Number.isFinite(wsHealth.wsHardCancelMult) ? wsHealth.wsHardCancelMult.toFixed(2) : '--';
        const cancelBufferAdd = Number.isFinite(wsHealth.wsCancelBufferAddBps) ? wsHealth.wsCancelBufferAddBps.toFixed(1) : '--';
        const repriceBufferAdd = Number.isFinite(wsHealth.wsRepriceBufferAddBps) ? wsHealth.wsRepriceBufferAddBps.toFixed(1) : '--';
        const cancelConfirm = Number.isFinite(wsHealth.wsCancelConfirmMult) ? wsHealth.wsCancelConfirmMult.toFixed(2) : '--';
        const repriceConfirm = Number.isFinite(wsHealth.wsRepriceConfirmMult) ? wsHealth.wsRepriceConfirmMult.toFixed(2) : '--';
        const forceSafe = wsHealth.wsForceSafe ? '安全档' : '常规';
        const disableHedge = wsHealth.wsDisableHedge ? '禁对冲' : '可对冲';
        const readOnly = wsHealth.wsReadOnly ? '只读' : '执行';
        const ultraSafe = wsHealth.wsUltraSafe ? '极限' : '常规';
        const emergencyActive = wsHealth.wsEmergencyActive ? '已触发' : '待机';
        const recovery = wsHealth.wsEmergencyRecovery ? '恢复中' : '正常';
        const recoverySteps = Number.isFinite(wsHealth.wsEmergencyRecoverySteps)
          ? wsHealth.wsEmergencyRecoverySteps
          : '--';
        const recoveryStage = Number.isFinite(wsHealth.wsEmergencyRecoveryStage) && wsHealth.wsEmergencyRecoveryStage >= 0
          ? `${wsHealth.wsEmergencyRecoveryStage + 1}/${recoverySteps}`
          : '--';
        const recoveryRatio = Number.isFinite(wsHealth.wsEmergencyRecoveryRatio)
          ? wsHealth.wsEmergencyRecoveryRatio.toFixed(2)
          : '--';
        const recoveryInterval = Number.isFinite(wsHealth.wsEmergencyRecoveryIntervalMult)
          ? wsHealth.wsEmergencyRecoveryIntervalMult.toFixed(2)
          : '--';
        const recoveryDepth = Number.isFinite(wsHealth.wsEmergencyRecoveryDepthMult)
          ? wsHealth.wsEmergencyRecoveryDepthMult.toFixed(2)
          : '--';
        const recoveryVol = Number.isFinite(wsHealth.wsEmergencyRecoveryVolatilityMult)
          ? wsHealth.wsEmergencyRecoveryVolatilityMult.toFixed(2)
          : '--';
        const recoverySpreadAdd = Number.isFinite(wsHealth.wsEmergencyRecoverySpreadAdd)
          ? wsHealth.wsEmergencyRecoverySpreadAdd.toFixed(4)
          : '--';
        const recoveryIceberg = Number.isFinite(wsHealth.wsEmergencyRecoveryIcebergRatio)
          ? wsHealth.wsEmergencyRecoveryIcebergRatio.toFixed(2)
          : '--';
        const recoveryCancelConfirm = Number.isFinite(wsHealth.wsEmergencyRecoveryCancelConfirmMult)
          ? wsHealth.wsEmergencyRecoveryCancelConfirmMult.toFixed(2)
          : '--';
        const recoveryMaxOrders = Number.isFinite(wsHealth.wsEmergencyRecoveryMaxOrdersMult)
          ? wsHealth.wsEmergencyRecoveryMaxOrdersMult.toFixed(2)
          : '--';
        const recoveryRepriceConfirm = Number.isFinite(wsHealth.wsEmergencyRecoveryRepriceConfirmMult)
          ? wsHealth.wsEmergencyRecoveryRepriceConfirmMult.toFixed(2)
          : '--';
        const recoveryMaxNotional = Number.isFinite(wsHealth.wsEmergencyRecoveryMaxNotionalMult)
          ? wsHealth.wsEmergencyRecoveryMaxNotionalMult.toFixed(2)
          : '--';
        const recoveryFarLayers = Number.isFinite(wsHealth.wsEmergencyRecoveryFarLayersMin)
          ? wsHealth.wsEmergencyRecoveryFarLayersMin
          : '--';
        const recoveryFarMax = Number.isFinite(wsHealth.wsEmergencyRecoveryFarLayersMax)
          ? wsHealth.wsEmergencyRecoveryFarLayersMax
          : '--';
        const recoveryFarStep = Number.isFinite(wsHealth.wsEmergencyRecoveryFarLayerStep)
          ? wsHealth.wsEmergencyRecoveryFarLayerStep
          : '--';
        const recoveryCancelInterval = Number.isFinite(wsHealth.wsEmergencyRecoveryCancelIntervalMult)
          ? wsHealth.wsEmergencyRecoveryCancelIntervalMult.toFixed(2)
          : '--';
        const recoveryOffset = Number.isFinite(wsHealth.wsEmergencyRecoverySingleOffsetBps)
          ? wsHealth.wsEmergencyRecoverySingleOffsetBps.toFixed(1)
          : '--';
        const recoveryTemplate = wsHealth.wsEmergencyRecoveryTemplate ? 'tmpl=on' : 'tmpl=off';
        const recoveryAuto = wsHealth.wsEmergencyRecoveryAuto ? 'auto=on' : 'auto=off';
        const recoveryImb = Number.isFinite(wsHealth.wsEmergencyRecoveryImbalanceThreshold)
          ? wsHealth.wsEmergencyRecoveryImbalanceThreshold.toFixed(2)
          : '--';
        const recoveryMinInterval = Number.isFinite(wsHealth.wsEmergencyRecoveryMinIntervalMs)
          ? wsHealth.wsEmergencyRecoveryMinIntervalMs
          : '--';
        const recoveryOffsetVol = Number.isFinite(wsHealth.wsEmergencyRecoveryOffsetVolWeight)
          ? wsHealth.wsEmergencyRecoveryOffsetVolWeight.toFixed(2)
          : '--';
        const recoveryLossW = Number.isFinite(wsHealth.wsEmergencyRecoverySingleSideLossWeight)
          ? wsHealth.wsEmergencyRecoverySingleSideLossWeight.toFixed(2)
          : '--';
        const recoveryProgress = Number.isFinite(wsHealth.wsEmergencyRecoveryProgress)
          ? Math.round(wsHealth.wsEmergencyRecoveryProgress * 100)
          : '--';
        const recoverySingle = wsHealth.wsEmergencyRecoverySingleActive ? '单边' : '双边';
        const throttleFactor = Number.isFinite(wsHealth.riskThrottleFactor)
          ? wsHealth.riskThrottleFactor.toFixed(2)
          : '--';
        const throttleScore = Number.isFinite(wsHealth.riskThrottleScore)
          ? wsHealth.riskThrottleScore.toFixed(2)
          : '--';
        const throttleCool = Number.isFinite(wsHealth.riskThrottleCoolOffMs)
          ? wsHealth.riskThrottleCoolOffMs
          : '--';
        const throttleHint = `节流=${throttleFactor} score=${throttleScore} coolOff=${throttleCool}`;
        const emergency = wsHealth.wsEmergencyCancel
          ? `急撤-${emergencyActive}/${recovery}(step=${recoveryStage},ratio=${recoveryRatio},pace=${recoveryInterval},depth=${recoveryDepth},vol=${recoveryVol},spread+${recoverySpreadAdd},ice=${recoveryIceberg},cancel=${recoveryCancelConfirm},reprice=${recoveryRepriceConfirm},maxOrd=${recoveryMaxOrders},maxNotional=${recoveryMaxNotional},far=${recoveryFarLayers}/${recoveryFarMax},fstep=${recoveryFarStep},cancelPace=${recoveryCancelInterval},offset=${recoveryOffset},volW=${recoveryOffsetVol},lossW=${recoveryLossW},${recoveryTemplate},${recoveryAuto},imb=${recoveryImb},minInt=${recoveryMinInterval},prog=${recoveryProgress}%,${recoverySingle})`
          : '常规';
        const updatedAt = Number.isFinite(wsHealth.updatedAt) ? formatTimestamp(wsHealth.updatedAt) : '--';
        mmWsHealthHint.textContent = `spread x${spreadMult} size x${sizeMult} layer x${layerMult} pace x${intervalMult} sizeScale=${sizeScale} 单侧=${singleSide}/${singleMode} buffer+${touchAdd}bps ${sparse} layerCap=${layerCap} maxOrders=${maxOrdersMult} cancel x${softCancelMult}/${hardCancelMult} buf+${cancelBufferAdd}/${repriceBufferAdd} confirm x${cancelConfirm}/${repriceConfirm} ${forceSafe} ${disableHedge} ${readOnly} ${ultraSafe}/${emergency} ${throttleHint} 模式=${onlyFar} 更新=${updatedAt}`;
      }
    }

    if (mmHealthScore || mmSafetyStatus || mmHealthBar || mmRiskHint) {
      const wsScore = Number.isFinite(wsHealth.score) ? Number(wsHealth.score) : 100;
      const throttleFactors = markets
        .map((m) => Number(m.riskThrottleFactor))
        .filter((value) => Number.isFinite(value));
      const minThrottle = throttleFactors.length ? Math.max(0, Math.min(...throttleFactors)) : 1;
      const burstCount = markets.filter((m) => m.cancelBurstActive).length;
      const protectiveCount = markets.filter((m) => m.protectiveActive).length;
      const emergencyOn = wsHealth.wsEmergencyActive === true;
      const recoveryOn = wsHealth.wsEmergencyRecovery === true;
      const ultraSafe = wsHealth.wsUltraSafe === true;
      const forceSafe = wsHealth.wsForceSafe === true;
      const readOnly = wsHealth.wsReadOnly === true;

      let penalty = 0;
      if (data.tradingHalted) penalty += 40;
      if (emergencyOn) penalty += 30;
      if (recoveryOn) penalty += 20;
      if (ultraSafe) penalty += 15;
      if (forceSafe) penalty += 10;
      if (readOnly) penalty += 20;
      if (burstCount > 0) penalty += Math.min(15, burstCount * 3);
      penalty += Math.round((1 - Math.max(0, Math.min(1, minThrottle))) * 20);

      const health = Math.max(0, Math.min(100, Math.round(wsScore - penalty)));
      if (mmHealthScore) setMetricText(mmHealthScore, `${health}`);
      if (mmHealthBar) mmHealthBar.style.width = `${health}%`;
      if (mmRiskHint) {
        const throttleHint = Number.isFinite(minThrottle) ? `节流x${minThrottle.toFixed(2)}` : '节流--';
        const burstHint = burstCount > 0 ? `burst=${burstCount}` : 'burst=0';
        const protectHint = protectiveCount > 0 ? `protect=${protectiveCount}` : 'protect=0';
        const mode = emergencyOn ? '急撤' : recoveryOn ? '恢复' : forceSafe || ultraSafe ? '安全' : '常规';
        mmRiskHint.textContent = `WS=${Math.round(wsScore)} ${throttleHint} ${burstHint} ${protectHint} ${mode}`;
      }
      if (mmSafetyStatus) {
        const parts = [];
        if (data.tradingHalted) parts.push('熔断');
        if (emergencyOn) parts.push('急撤');
        if (recoveryOn) parts.push('恢复');
        if (ultraSafe) parts.push('极限');
        else if (forceSafe) parts.push('安全');
        if (protectiveCount > 0) parts.push('保护');
        if (readOnly) parts.push('只读');
        mmSafetyStatus.textContent = parts.length ? parts.join(' / ') : '常规';
      }
      maybeAutoDowngradeMaker(health);
    }

    if (mmMarketsList) {
      mmMarketsList.innerHTML = '';
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
          const wsScore = Number.isFinite(m.wsHealthScore) ? Math.round(m.wsHealthScore) : '--';
          const wsOnlyFar = m.wsOnlyFar ? '远层' : '常规';
          const wsSingle = m.wsSingleSide ? String(m.wsSingleSide) : 'NONE';
          const wsSparse = m.wsSparseOdd ? '稀疏' : '常规';
          const wsCap = Number.isFinite(m.wsLayerCap) ? `cap=${m.wsLayerCap}` : '';
          const wsEmergency = m.wsEmergencyActive ? 'emg=on' : '';
          const riskThrottle = Number.isFinite(m.riskThrottleFactor) ? `rt=${m.riskThrottleFactor.toFixed(2)}` : '';
          const riskFar = m.riskOnlyFarActive ? 'riskFar' : '';
          const burst = m.cancelBurstActive ? 'burst=on' : '';
          const protect = m.protectiveActive ? 'protect=on' : '';
          hint.textContent =
            `spread=${spreadPct}% vol=${vol} depth=${depth} ws=${wsScore} ${wsOnlyFar} ${wsSparse} single=${wsSingle} ${wsCap} ${wsEmergency} ${riskThrottle} ${riskFar} ${burst} ${protect}`.trim();
          row.appendChild(label);
          row.appendChild(hint);
          mmMarketsList.appendChild(row);
        });
      }
    }

    if (mmEventList) {
      mmEventList.innerHTML = '';
      const events = Array.isArray(data.events) ? data.events : [];
      const recent = events.slice(-8).reverse();
      if (recent.length === 0) {
        const item = document.createElement('div');
        item.className = 'health-item ok';
        item.textContent = '暂无事件。';
        mmEventList.appendChild(item);
      } else {
        recent.forEach((event) => {
          const row = document.createElement('div');
          const isRecovery = event?.type && String(event.type).includes('RECOVERY_END');
          row.className = `health-item ${isRecovery ? 'ok' : 'warn'}`;
          const ts = event?.ts ? formatTimestamp(event.ts) : '--';
          const token = event?.tokenId ? ` | ${event.tokenId}` : '';
          row.textContent = `${ts} | ${event?.type || 'EVENT'}${token} | ${event?.message || ''}`.trim();
          mmEventList.appendChild(row);
        });
      }
      if (mmEventHint) {
        const total = events.length;
        const last = events.length ? events[events.length - 1] : null;
        const lastText = last?.ts ? `${formatTimestamp(last.ts)} ${last.type || ''}`.trim() : '暂无';
        const emergencyCount = events.filter((e) => String(e?.type || '').includes('EMERGENCY_CANCEL')).length;
        const recoveryCount = events.filter((e) => String(e?.type || '').includes('RECOVERY_START')).length;
        mmEventHint.textContent = `事件总数 ${total} | 最近 ${lastText} | 急撤 ${emergencyCount} | 恢复 ${recoveryCount}`;
      }
    }
  } catch (error) {
    setMmStatus('读取失败', false);
  }
}

async function loadPointsStats() {
  if (!window.predictBot.readPointsStats) return;
  try {
    const raw = await window.predictBot.readPointsStats();
    if (!raw) {
      return;
    }
    const data = JSON.parse(raw);

    // 更新积分市场数量
    const mmPointsMarkets = document.getElementById('mmPointsMarkets');
    if (mmPointsMarkets) {
      mmPointsMarkets.textContent = `${data.pointsActiveMarkets}/${data.totalMarkets}`;
    }

    // 更新积分效率
    const mmPointsEfficiency = document.getElementById('mmPointsEfficiency');
    const mmPointsEfficiencyHint = document.getElementById('mmPointsEfficiencyHint');
    if (mmPointsEfficiency) {
      mmPointsEfficiency.textContent = `${data.efficiency}%`;
    }
    if (mmPointsEfficiencyHint) {
      mmPointsEfficiencyHint.textContent = `${data.pointsActiveMarkets} 个市场激活积分`;
    }

    // 如果有错误，记录日志
    if (data.error) {
      pushLog({ type: 'system', level: 'stderr', message: `积分统计错误: ${data.error}` });
    }
  } catch (error) {
    // 静默失败，不影响其他功能
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
  pushLog({ type: 'system', level: 'system', message: `正在启动 ${type}...` });
  try {
    const result = await window.predictBot.startBot(type);
    if (!result.ok) {
      pushLog({ type, level: 'stderr', message: result.message || '启动失败' });
    } else {
      pushLog({ type: 'system', level: 'system', message: `✅ ${type} 启动成功` });
    }
  } catch (error) {
    pushLog({ type: 'system', level: 'stderr', message: `启动错误: ${error.message}` });
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
  await checkConfigStatus();
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
  await loadPointsStats();
  await loadArbSnapshot();
  await loadArbCommandStatus();
  await runDiagnostics();
  runNewbieCheck();
  runPreflightCheck();
}

window.predictBot.onLog((payload) => {
  const lines = payload.message.split('\n').filter(Boolean);
  for (const line of lines) {
    pushLog({ type: payload.type, level: payload.level, message: line });
  }
});

window.predictBot.onStatus((payload) => {
  updateStatusDisplay(payload);
  if (payload?.rescanRequested) {
    checkMappingMissing().catch(() => {});
    pushLog({ type: 'system', level: 'system', message: '收到重扫指令，已刷新映射检查' });
  }
  if (payload?.wsBoostRequested) {
    pushLog({ type: 'system', level: 'system', message: '收到 WS 加速指令，请留意实时扫描' });
  }
});

// 等待DOM加载完成后再绑定事件监听器
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupEventListeners);
} else {
  setupEventListeners();
}

function setupEventListeners() {
  console.log('开始绑定事件监听器...');

  logFilter.addEventListener('change', renderLogs);
  failureCategoryFilter.addEventListener('change', renderLogs);
  logKeyword.addEventListener('input', renderLogs);

  const clearLogBtn = document.getElementById('clearLog');
  if (clearLogBtn) {
    clearLogBtn.addEventListener('click', () => {
      logs.length = 0;
      renderLogs();
    });
  }

  const reloadEnvBtn = document.getElementById('reloadEnv');
  if (reloadEnvBtn) {
    reloadEnvBtn.addEventListener('click', () => {
      loadEnv().then(() => {
        pushLog({ type: 'system', level: 'system', message: '✅ 配置已重新加载' });
      });
    });
  }

  const saveEnvBtn = document.getElementById('saveEnv');
  if (saveEnvBtn) {
    saveEnvBtn.addEventListener('click', () => {
      const btn = document.getElementById('saveEnv');
      btn.textContent = '保存中...';
      saveEnv().then(() => {
        btn.textContent = '保存配置';
      });
    });
  }

  const loadMinBtn = document.getElementById('loadMinTemplate');
  if (loadMinBtn) {
    console.log('找到加载最小模板按钮');
    loadMinBtn.addEventListener('click', () => {
      try {
        console.log('加载最小模板按钮被点击');
        const envEditor = document.getElementById('envEditor');
        if (!envEditor) {
          console.error('envEditor 元素未找到');
          alert('错误：找不到环境变量编辑器');
          return;
        }
        console.log('开始加载模板...');
        loadMinTemplate();
        pushLog({ type: 'system', level: 'system', message: '✅ 已加载最小配置模板' });
        console.log('模板加载完成');
      } catch (error) {
        console.error('加载模板失败:', error);
        alert('加载模板失败: ' + error.message);
      }
    });
  } else {
    console.error('未找到 loadMinTemplate 按钮');
  }

  const loadFullBtn = document.getElementById('loadFullTemplate');
  if (loadFullBtn) {
    console.log('找到加载完整模板按钮');
    loadFullBtn.addEventListener('click', () => {
      try {
        console.log('加载完整模板按钮被点击');
        loadFullTemplate();
        pushLog({ type: 'system', level: 'system', message: '✅ 已加载完整配置模板' });
      } catch (error) {
        console.error('加载模板失败:', error);
        alert('加载模板失败: ' + error.message);
      }
    });
  } else {
    console.error('未找到 loadFullTemplate 按钮');
  }

  // 一键最佳实践按钮
  const applyBestBtn = document.getElementById('applyBestPractice');
  if (applyBestBtn) {
    console.log('找到一键最佳实践按钮');
    applyBestBtn.addEventListener('click', () => {
      try {
        console.log('一键最佳实践按钮被点击');
        applyBestPractice();
      } catch (error) {
        console.error('应用最佳实践失败:', error);
        pushLog({ type: 'system', level: 'stderr', message: '❌ 应用最佳实践失败: ' + error.message });
        alert('应用最佳实践失败: ' + error.message);
      }
    });
  } else {
    console.error('未找到 applyBestPractice 按钮');
  }

  // 智能建议按钮
  const suggestionsBtn = document.getElementById('getSmartSuggestions');
  if (suggestionsBtn) {
    console.log('找到智能建议按钮');
    suggestionsBtn.addEventListener('click', () => {
      try {
        console.log('智能建议按钮被点击');
        getSmartSuggestions();
      } catch (error) {
        console.error('获取智能建议失败:', error);
        pushLog({ type: 'system', level: 'stderr', message: '❌ 获取智能建议失败: ' + error.message });
        alert('获取智能建议失败: ' + error.message);
      }
    });
  } else {
    console.error('未找到 getSmartSuggestions 按钮');
  }

  // 版本切换按钮
  const switchToSimpleBtn = document.getElementById('switchToSimple');
  if (switchToSimpleBtn) {
    console.log('找到切换到简化版按钮');
    switchToSimpleBtn.addEventListener('click', () => {
      pushLog({ type: 'system', level: 'system', message: '🎯 正在切换到简化版...' });

      // 检查做市商是否在运行
      const status = window.electron?.ipcRenderer?.sendSync('status') ||
                     { marketMaker: false, arbitrage: false };

      let message = '切换到简化版？\n\n';
      message += '简化版特点：\n';
      message += '• 专注积分获取，界面简洁\n';
      message += '• 适合小白用户\n';
      message += '• 一键最佳实践自动优化\n\n';

      if (status.marketMaker) {
        message += '✅ 做市商会继续运行\n';
        message += '✅ 配置和状态保持不变\n\n';
      }

      message += '确认切换？';

      if (confirm(message)) {
        pushLog({ type: 'system', level: 'system', message: '✅ 切换到简化版' });
        window.location.href = 'index_simple.html';
      } else {
        pushLog({ type: 'system', level: 'system', message: '❌ 取消切换' });
      }
    });
  }

  const switchToFullBtn = document.getElementById('switchToFull');
  if (switchToFullBtn) {
    console.log('找到切换到完整版按钮');
    switchToFullBtn.addEventListener('click', () => {
      pushLog({ type: 'system', level: 'system', message: '🔧 正在切换到完整版...' });

      // 检查做市商是否在运行
      const status = window.electron?.ipcRenderer?.sendSync('status') ||
                     { marketMaker: false, arbitrage: false };

      let message = '切换到完整版？\n\n';
      message += '完整版特点：\n';
      message += '• 包含套利机器人功能\n';
      message += '• 30+个高级配置选项\n';
      message += '• 详细的执行指标\n\n';

      if (status.marketMaker) {
        message += '✅ 做市商会继续运行\n';
        message += '✅ 配置和状态保持不变\n\n';
      }

      message += '确认切换？';

      if (confirm(message)) {
        pushLog({ type: 'system', level: 'system', message: '✅ 切换到完整版' });
        window.location.href = 'index.html';
      } else {
        pushLog({ type: 'system', level: 'system', message: '❌ 取消切换' });
      }
    });
  }

  // 重置版本选择按钮
  const resetVersionChoiceBtn = document.getElementById('resetVersionChoice');
  if (resetVersionChoiceBtn) {
    resetVersionChoiceBtn.addEventListener('click', () => {
      if (confirm('清除版本选择记忆？\n\n下次启动时将显示版本选择页面。')) {
        localStorage.removeItem('preferredVersion');
        pushLog({ type: 'system', level: 'system', message: '✅ 已清除版本选择记忆' });
        alert('✅ 已清除！下次启动将显示版本选择页面。\n\n您也可以点击"切换版本"按钮直接切换到另一个版本。');
      }
    });
  }

  const reloadMappingBtn = document.getElementById('reloadMapping');
  if (reloadMappingBtn) {
    reloadMappingBtn.addEventListener('click', () => {
      loadMapping().then(() => {
        pushLog({ type: 'system', level: 'system', message: '✅ 映射已重新加载' });
      });
    });
  }

  const saveMappingBtn = document.getElementById('saveMapping');
  if (saveMappingBtn) {
    saveMappingBtn.addEventListener('click', saveMapping);
  }

  const reloadDepBtn = document.getElementById('reloadDependency');
  if (reloadDepBtn) {
    reloadDepBtn.addEventListener('click', loadDependency);
  }

  const saveDepBtn = document.getElementById('saveDependency');
  if (saveDepBtn) {
    saveDepBtn.addEventListener('click', saveDependency);
  }

  const startMMBtn = document.getElementById('startMM');
  if (startMMBtn) {
    console.log('找到启动做市商按钮');
    startMMBtn.addEventListener('click', (e) => {
      const btn = e.target;
      btn.textContent = '启动中...';
      btn.disabled = true;
      startBot('mm').finally(() => {
        btn.textContent = '启动做市商';
        btn.disabled = false;
      });
    });
  }

  const stopMMBtn = document.getElementById('stopMM');
  if (stopMMBtn) {
    stopMMBtn.addEventListener('click', (e) => {
      const btn = e.target;
      btn.textContent = '停止中...';
      btn.disabled = true;
      stopBot('mm').finally(() => {
        btn.textContent = '停止';
        btn.disabled = false;
      });
    });
  }

  const startArbBtn = document.getElementById('startArb');
  if (startArbBtn) {
    startArbBtn.addEventListener('click', (e) => {
      const btn = e.target;
      btn.textContent = '启动中...';
      btn.disabled = true;
      startBot('arb').finally(() => {
        btn.textContent = '启动套利';
        btn.disabled = false;
      });
    });
  }

  const stopArbBtn = document.getElementById('stopArb');
  if (stopArbBtn) {
    stopArbBtn.addEventListener('click', (e) => {
      const btn = e.target;
      btn.textContent = '停止中...';
      btn.disabled = true;
      stopBot('arb').finally(() => {
        btn.textContent = '停止';
        btn.disabled = false;
      });
    });
  }

  console.log('事件监听器绑定完成');
}

// 其余的事件监听器（不需要等待DOM的）
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
if (mmVenueSelect) {
  mmVenueSelect.addEventListener('change', applyToggles);
}

envEditor.addEventListener('input', () => {
  syncTogglesFromEnv(envEditor.value);
  updateMetricsPaths();
  updateFixPreview();
  runPreflightCheck();
});

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => activateTab(btn.dataset.tab || 'env'));
});

refreshMetrics.addEventListener('click', loadMetrics);
if (runNewbieCheckBtn) {
  runNewbieCheckBtn.addEventListener('click', runNewbieCheck);
}
if (applyBeginnerTemplateBtn) {
  applyBeginnerTemplateBtn.addEventListener('click', applyBeginnerTemplate);
}
if (runPreflightCheckBtn) {
  runPreflightCheckBtn.addEventListener('click', runPreflightCheck);
}
if (copyPreflightChecklistBtn) {
  copyPreflightChecklistBtn.addEventListener('click', copyPreflightChecklist);
}
runDiagnosticsBtn.addEventListener('click', runDiagnostics);
exportDiagnosticsBtn.addEventListener('click', exportDiagnostics);
exportMmEventsBtn?.addEventListener('click', exportMmEvents);
refreshArbSnapshot?.addEventListener('click', () => {
  loadArbSnapshot().catch(() => {});
  loadArbCommandStatus().catch(() => {});
});
arbTypeFilter?.addEventListener('change', renderArbList);
arbPlatformFilter?.addEventListener('change', renderArbList);
resetPlatformFilter?.addEventListener('click', () => {
  if (arbPlatformFilter) {
    Array.from(arbPlatformFilter.options).forEach(opt => opt.selected = true);
    pushLog({ type: 'system', level: 'system', message: '✅ 已重置平台过滤器' });
    renderArbList();
  }
});
arbMinReturn?.addEventListener('input', renderArbList);
arbMinProfitUsd?.addEventListener('input', renderArbList);
enableRecoveryTemplateBtn?.addEventListener('click', () => toggleRecoveryTemplate(true));
disableRecoveryTemplateBtn?.addEventListener('click', () => toggleRecoveryTemplate(false));
applyRecoveryTemplateSafeBtn?.addEventListener('click', () => applyRecoveryTemplatePreset('safe'));
applyRecoveryTemplateUltraBtn?.addEventListener('click', () => applyRecoveryTemplatePreset('ultra'));
applyRecoveryTemplateExtremeBtn?.addEventListener('click', () => applyRecoveryTemplatePreset('extreme'));
applyRecoveryTemplateResetBtn?.addEventListener('click', applyRecoveryTemplateReset);
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
if (applyConsistencyAvoidBtn) {
  applyConsistencyAvoidBtn.addEventListener('click', applyConsistencyAvoidHours);
}
refreshMmMetrics.addEventListener('click', loadMmMetrics);
if (applyMmPassiveBtn) {
  applyMmPassiveBtn.addEventListener('click', applyMmPassiveTemplate);
}
if (applyMmProbablePointsBtn) {
  applyMmProbablePointsBtn.addEventListener('click', applyMmProbablePointsTemplate);
}
if (applyMmProbableHedgeBtn) {
  applyMmProbableHedgeBtn.addEventListener('click', applyMmProbableHedgeTemplate);
}
if (applyArbSafeBtn) {
  applyArbSafeBtn.addEventListener('click', applyArbSafeTemplate);
}
if (mappingCheckMissingBtn) {
  mappingCheckMissingBtn.addEventListener('click', () => {
    checkMappingMissing().catch(() => {});
  });
}
if (mappingGenerateTemplateBtn) {
  mappingGenerateTemplateBtn.addEventListener('click', applyMappingTemplate);
}
if (mappingSuggestPredictBtn) {
  mappingSuggestPredictBtn.addEventListener('click', () => {
    suggestPredictMappings().catch(() => {});
  });
}
if (mappingCopyTemplateBtn) {
  mappingCopyTemplateBtn.addEventListener('click', () => {
    copyMappingTemplate().catch(() => {});
  });
}
if (mappingAutoCleanupBtn) {
  mappingAutoCleanupBtn.addEventListener('click', autoCleanupMappings);
}
if (mappingExportConfirmedBtn) {
  mappingExportConfirmedBtn.addEventListener('click', exportConfirmedMappings);
}
if (mappingRestoreLatestBtn) {
  mappingRestoreLatestBtn.addEventListener('click', () => {
    restoreLatestBackup().catch(() => {});
  });
}
if (mappingMissingList) {
  mappingMissingList.addEventListener('click', handleMissingListClick);
}
if (mappingBackupList) {
  mappingBackupList.addEventListener('click', (event) => {
    const target = event.target;
    if (!target || target.dataset.action !== 'restore-backup') return;
    const path = target.dataset.path;
    if (!path || !window.predictBot?.restoreMappingFromPath) return;
    window.predictBot.restoreMappingFromPath(path).then((result) => {
      if (!result?.ok) {
        pushLog({ type: 'system', level: 'stderr', message: result?.message || '恢复备份失败' });
        return;
      }
      loadMapping().then(() => {
        checkMappingMissing().catch(() => {});
        loadMappingBackups().catch(() => {});
      });
      pushLog({ type: 'system', level: 'system', message: `已恢复备份：${path}` });
    });
  });
}
if (mappingHideUnconfirmed) {
  mappingHideUnconfirmed.addEventListener('change', () => {
    if (!mappingMissingList?.dataset.missing) return;
    try {
      const missing = JSON.parse(mappingMissingList.dataset.missing || '[]');
      renderMissingList(missing);
    } catch {
      // ignore
    }
  });
}
if (mappingHideLowScore) {
  mappingHideLowScore.addEventListener('change', () => {
    if (!mappingMissingList?.dataset.missing) return;
    try {
      const missing = JSON.parse(mappingMissingList.dataset.missing || '[]');
      renderMissingList(missing);
    } catch {
      // ignore
    }
  });
}
if (mappingAutoSaveToggle) {
  mappingAutoSaveToggle.addEventListener('change', () => {
    if (mappingAutoSaveToggle.checked) {
      pushLog({ type: 'system', level: 'system', message: '已启用映射自动保存' });
    } else {
      pushLog({ type: 'system', level: 'system', message: '已关闭映射自动保存' });
    }
  });
}
if (mappingAutoReloadToggle) {
  mappingAutoReloadToggle.addEventListener('change', () => {
    if (mappingAutoReloadToggle.checked) {
      pushLog({ type: 'system', level: 'system', message: '保存后自动刷新已启用' });
    } else {
      pushLog({ type: 'system', level: 'system', message: '保存后自动刷新已关闭' });
    }
  });
}
if (mappingAutoRescanToggle) {
  mappingAutoRescanToggle.addEventListener('change', () => {
    if (mappingAutoRescanToggle.checked) {
      pushLog({ type: 'system', level: 'system', message: '保存后重扫已启用' });
    } else {
      pushLog({ type: 'system', level: 'system', message: '保存后重扫已关闭' });
    }
  });
}
if (mappingAutoBackupToggle) {
  mappingAutoBackupToggle.addEventListener('change', () => {
    if (mappingAutoBackupToggle.checked) {
      pushLog({ type: 'system', level: 'system', message: '自动备份已启用' });
    } else {
      pushLog({ type: 'system', level: 'system', message: '自动备份已关闭' });
    }
  });
}
if (mappingAutoWsKickToggle) {
  mappingAutoWsKickToggle.addEventListener('change', () => {
    if (mappingAutoWsKickToggle.checked) {
      pushLog({ type: 'system', level: 'system', message: '重扫后 WS 加速已启用' });
    } else {
      pushLog({ type: 'system', level: 'system', message: '重扫后 WS 加速已关闭' });
    }
  });
}
if (mappingAutoWsKickToggle) {
  mappingAutoWsKickToggle.addEventListener('change', () => {
    if (mappingAutoWsKickToggle.checked) {
      pushLog({ type: 'system', level: 'system', message: '重扫后 WS 加速已启用' });
    } else {
      pushLog({ type: 'system', level: 'system', message: '重扫后 WS 加速已关闭' });
    }
  });
}

init().catch((err) => {
  pushLog({ type: 'system', level: 'stderr', message: err?.message || '初始化失败' });
});

setInterval(() => {
  loadMetrics().catch(() => {});
  loadMmMetrics().catch(() => {});
  loadPointsStats().catch(() => {});
  loadArbSnapshot().catch(() => {});
  loadArbCommandStatus().catch(() => {});
}, 5000);
