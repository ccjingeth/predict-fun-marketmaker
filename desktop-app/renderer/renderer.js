const envEditor = document.getElementById('envEditor');
const mappingEditor = document.getElementById('mappingEditor');
const dependencyEditor = document.getElementById('dependencyEditor');
const logOutput = document.getElementById('logOutput');
const logFilter = document.getElementById('logFilter');
const failureCategoryFilter = document.getElementById('failureCategoryFilter');
const globalStatus = document.getElementById('globalStatus');
const tradingMode = document.getElementById('tradingMode');
const statusMM = document.getElementById('statusMM');
const statusArb = document.getElementById('statusArb');
const toggleInputs = Array.from(document.querySelectorAll('.toggle input[data-env]'));
const tabButtons = Array.from(document.querySelectorAll('.tab-button'));
const tabPanels = Array.from(document.querySelectorAll('.tab-panel'));
const metricsStatus = document.getElementById('metricsStatus');
const metricSuccessRate = document.getElementById('metricSuccessRate');
const metricSuccessRaw = document.getElementById('metricSuccessRaw');
const metricAttempts = document.getElementById('metricAttempts');
const metricPreflight = document.getElementById('metricPreflight');
const metricExec = document.getElementById('metricExec');
const metricTotal = document.getElementById('metricTotal');
const metricPostDrift = document.getElementById('metricPostDrift');
const metricQuality = document.getElementById('metricQuality');
const metricChunkFactor = document.getElementById('metricChunkFactor');
const metricChunkDelay = document.getElementById('metricChunkDelay');
const metricAlerts = document.getElementById('metricAlerts');
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
const applyFixTemplateBtn = document.getElementById('applyFixTemplate');
const weightSuccess = document.getElementById('weightSuccess');
const weightDrift = document.getElementById('weightDrift');
const weightQuality = document.getElementById('weightQuality');
const weightStale = document.getElementById('weightStale');
const weightSuccessVal = document.getElementById('weightSuccessVal');
const weightDriftVal = document.getElementById('weightDriftVal');
const weightQualityVal = document.getElementById('weightQualityVal');
const weightStaleVal = document.getElementById('weightStaleVal');
const resetRiskWeightsBtn = document.getElementById('resetRiskWeights');
const metricRiskScore = document.getElementById('metricRiskScore');
const metricRiskBar = document.getElementById('metricRiskBar');
const chartSuccess = document.getElementById('chartSuccess');
const chartDrift = document.getElementById('chartDrift');
const chartRisk = document.getElementById('chartRisk');
const metricAlertsList = document.getElementById('metricAlertsList');
const riskBreakdownList = document.getElementById('riskBreakdownList');
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
  stale: 1,
};

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
  if (!weightSuccess || !weightDrift || !weightQuality || !weightStale) return;
  weightSuccess.value = riskWeights.success.toFixed(1);
  weightDrift.value = riskWeights.drift.toFixed(1);
  weightQuality.value = riskWeights.quality.toFixed(1);
  weightStale.value = riskWeights.stale.toFixed(1);
  if (weightSuccessVal) weightSuccessVal.textContent = riskWeights.success.toFixed(1);
  if (weightDriftVal) weightDriftVal.textContent = riskWeights.drift.toFixed(1);
  if (weightQualityVal) weightQualityVal.textContent = riskWeights.quality.toFixed(1);
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
    ['success', 'drift', 'quality', 'stale'].forEach((key) => {
      const value = Number(parsed?.[key]);
      if (Number.isFinite(value)) {
        riskWeights[key] = Math.max(0, Math.min(2, value));
      }
    });
  } catch {
    // ignore
  }
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
  bind(weightStale, 'stale', weightStaleVal);
  if (resetRiskWeightsBtn) {
    resetRiskWeightsBtn.addEventListener('click', () => {
      riskWeights.success = 1;
      riskWeights.drift = 1;
      riskWeights.quality = 1;
      riskWeights.stale = 1;
      updateRiskWeightsUI();
      saveRiskWeights();
      loadMetrics();
      pushLog({ type: 'system', level: 'system', message: '已重置风险权重' });
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
  logOutput.innerHTML = '';
  const fragment = document.createDocumentFragment();

  const view = logs.filter((entry) => {
    if (filter === 'all') return true;
    return entry.type === filter;
  }).filter((entry) => {
    if (category === 'all') return true;
    return entry.category === category;
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
  if (/volatility/.test(text)) return '高波动';
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
  failureEvents.push({ ts: Date.now(), category });
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

function getFailureAdvice(line) {
  const hints = [];
  if (/insufficient depth|insufficient/i.test(line)) {
    hints.push('降低下单量或调低 CROSS_PLATFORM_DEPTH_USAGE');
    hints.push('开启 CROSS_PLATFORM_ADAPTIVE_SIZE=true');
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
  if (!entries.length) {
    const item = document.createElement('div');
    item.className = 'health-item ok';
    item.textContent = '暂无修复建议。';
    fixPreviewList.appendChild(item);
    return;
  }
  entries.forEach((entry) => {
    const row = document.createElement('div');
    row.className = 'health-item warn';
    const label = document.createElement('div');
    label.className = 'health-label';
    label.textContent = entry.key;
    const hint = document.createElement('div');
    hint.className = 'health-hint';
    const current = env.get(entry.key);
    hint.textContent = `当前: ${current ?? '未设置'} → 建议: ${entry.value}`;
    row.appendChild(label);
    row.appendChild(hint);
    fixPreviewList.appendChild(row);
  });

  renderFixSelect(entries, env);
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
  entries.forEach((entry) => {
    const row = document.createElement('div');
    row.className = 'health-item';

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
    hint.textContent = `当前: ${current ?? '未设置'} → 建议: ${entry.value}`;

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
}

function applySelectedFixes() {
  if (!fixSelectList) return;
  const checkboxes = Array.from(fixSelectList.querySelectorAll('input[type="checkbox"]'));
  let text = envEditor.value || '';
  let applied = 0;
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
  pushLog({ type: 'system', level: 'system', message: `已应用 ${applied} 条修复建议（请保存生效）` });
}

function buildFixTemplate() {
  const categories = new Map();
  for (const [line, count] of failureCounts.entries()) {
    const category = classifyFailure(line);
    categories.set(category, (categories.get(category) || 0) + count);
  }
  const topCategory = Array.from(categories.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
  const template = [];
  template.push('# 自动修复建议（根据高频失败分类生成）');
  if (!topCategory) {
    template.push('# 暂无足够失败数据，建议先运行一段时间再应用。');
    return template.join('\n');
  }
  template.push(`# 主要问题: ${topCategory}`);
  if (topCategory === '深度不足') {
    template.push('CROSS_PLATFORM_ADAPTIVE_SIZE=true');
    template.push('CROSS_PLATFORM_DEPTH_USAGE=0.25');
    template.push('CROSS_PLATFORM_CHUNK_MAX_SHARES=8');
  } else if (topCategory === 'VWAP 偏离') {
    template.push('CROSS_PLATFORM_SLIPPAGE_BPS=250');
    template.push('CROSS_PLATFORM_EXECUTION_VWAP_CHECK=true');
    template.push('CROSS_PLATFORM_RECHECK_MS=300');
  } else if (topCategory === '价格漂移') {
    template.push('CROSS_PLATFORM_PRICE_DRIFT_BPS=40');
    template.push('CROSS_PLATFORM_RECHECK_MS=300');
    template.push('CROSS_PLATFORM_STABILITY_SAMPLES=3');
  } else if (topCategory === '高波动') {
    template.push('CROSS_PLATFORM_VOLATILITY_BPS=80');
    template.push('CROSS_PLATFORM_STABILITY_SAMPLES=3');
  } else if (topCategory === '未成交订单') {
    template.push('CROSS_PLATFORM_POST_FILL_CHECK=true');
    template.push('CROSS_PLATFORM_USE_FOK=true');
  } else if (topCategory === '权限/密钥') {
    template.push('# 请补齐 API_KEY / PRIVATE_KEY / JWT_TOKEN');
  } else if (topCategory === '熔断触发') {
    template.push('CROSS_PLATFORM_CIRCUIT_MAX_FAILURES=3');
    template.push('CROSS_PLATFORM_CIRCUIT_COOLDOWN_MS=120000');
  } else if (topCategory === '冷却触发') {
    template.push('CROSS_PLATFORM_GLOBAL_MIN_QUALITY=0.8');
    template.push('CROSS_PLATFORM_GLOBAL_COOLDOWN_MS=120000');
  } else if (topCategory === '映射/依赖') {
    template.push('# 检查 cross-platform-mapping.json 与 dependency-constraints.json');
  } else if (topCategory === '网络/请求') {
    template.push('ARB_WS_HEALTH_LOG_MS=5000');
    template.push('PREDICT_WS_STALE_MS=20000');
  } else {
    template.push('# 先应用保守档位再观察。');
  }
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
    if (metricsSnapshot.postTradeDriftBps > metricsSnapshot.driftLimit) {
      advice.push('Post-trade drift 偏高：建议加大分块/缩小深度使用。');
    }
    if (metricsSnapshot.qualityScore < metricsSnapshot.minQuality) {
      advice.push('质量分偏低：建议开启自动降级或暂时降低频率。');
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

function updateCharts() {
  const successSeries = metricsHistory.map((item) => item.successRate);
  const driftSeries = metricsHistory.map((item) => item.postTradeDriftBps);
  const riskSeries = metricsHistory.map((item) => item.riskScore);
  drawSparkline(chartSuccess, successSeries, '#6aa3ff');
  drawSparkline(chartDrift, driftSeries, '#f7c46c');
  drawSparkline(chartRisk, riskSeries, '#ff6b6b');
}

function updateAlerts({ successRate, postTradeDriftBps, qualityScore, cooldownUntil, metricsAgeMs }) {
  if (!metricAlertsList) return;
  const env = parseEnv(envEditor.value || '');
  const minQuality = Number(env.get('CROSS_PLATFORM_GLOBAL_MIN_QUALITY') || 0.7);
  const driftLimit = Number(env.get('CROSS_PLATFORM_POST_TRADE_DRIFT_BPS') || 80);
  const warnings = [];

  if (metricsAgeMs > 60000) {
    warnings.push('指标更新超过 60 秒，可能数据过期。');
  }
  if (successRate < 60) {
    warnings.push('成功率偏低，建议提高滑点保护或缩小执行量。');
  }
  if (postTradeDriftBps > driftLimit) {
    warnings.push('Post-trade drift 偏高，建议检查深度与映射准确性。');
  }
  if (qualityScore < minQuality) {
    warnings.push('质量分偏低，系统可能触发降级或冷却。');
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
    item.className = 'alert-item';
    item.textContent = text;
    metricAlertsList.appendChild(item);
  });
}

function computeRiskLevel({ successRate, postTradeDriftBps, qualityScore, metricsAgeMs }) {
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
    const successRate = attempts > 0 ? (successes / attempts) * 100 : 0;
    const postTradeDriftBps = Number(metrics.emaPostTradeDriftBps || 0);
    const updatedAt = Number(data.ts || 0);
    const metricsAgeMs = updatedAt ? Date.now() - updatedAt : Infinity;

    setMetricText(metricSuccessRate, `${formatNumber(successRate, 1)}%`);
    setMetricText(metricSuccessRaw, `${successes}/${attempts} 成功`);
    setMetricText(metricAttempts, `${attempts}`);
    setMetricText(metricPreflight, formatMs(metrics.emaPreflightMs));
    setMetricText(metricExec, formatMs(metrics.emaExecMs));
    setMetricText(metricTotal, formatMs(metrics.emaTotalMs));
    setMetricText(metricPostDrift, formatBps(postTradeDriftBps));
    setMetricText(metricQuality, formatNumber(data.qualityScore, 2));
    setMetricText(metricChunkFactor, formatNumber(data.chunkFactor, 2));
    setMetricText(metricChunkDelay, formatMs(data.chunkDelayMs));
    setMetricText(metricAlerts, `${metrics.postTradeAlerts || 0}`);
    setMetricText(metricBlockedTokens, `${(data.blockedTokens || []).length}`);
    setMetricText(metricBlockedPlatforms, `${(data.blockedPlatforms || []).length}`);
    const cooldownUntil = Number(data.globalCooldownUntil || 0);
    setMetricText(
      metricCooldown,
      cooldownUntil && cooldownUntil > Date.now() ? `冷却中：${formatTimestamp(cooldownUntil)}` : '未触发'
    );
    setMetricText(metricLastError, metrics.lastError || '无');
    setMetricText(metricUpdatedAt, formatTimestamp(updatedAt));

    if (updatedAt && successRate >= 0) {
      const last = metricsHistory[metricsHistory.length - 1];
      if (!last || last.ts !== updatedAt) {
        metricsHistory.push({
          ts: updatedAt,
          successRate,
          postTradeDriftBps,
          riskScore: 0,
        });
        if (metricsHistory.length > METRICS_HISTORY_MAX) {
          metricsHistory.shift();
        }
      }
    }

    updateCharts();
    const metricsSnapshot = {
      successRate,
      postTradeDriftBps,
      qualityScore: Number(data.qualityScore || 0),
      cooldownUntil,
      metricsAgeMs,
      driftLimit: Number(parseEnv(envEditor.value || '').get('CROSS_PLATFORM_POST_TRADE_DRIFT_BPS') || 80),
      minQuality: Number(parseEnv(envEditor.value || '').get('CROSS_PLATFORM_GLOBAL_MIN_QUALITY') || 0.7),
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
  updateRiskWeightsUI();
  bindRiskWeightInputs();
  await loadMetrics();
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
downgradeProfileBtn.addEventListener('click', () => applyDowngradeProfile('safe'));
downgradeSafeBtn.addEventListener('click', () => applyDowngradeProfile('safe'));
downgradeUltraBtn.addEventListener('click', () => applyDowngradeProfile('ultra'));
applyFixTemplateBtn.addEventListener('click', applyFixTemplate);

init().catch((err) => {
  pushLog({ type: 'system', level: 'stderr', message: err?.message || '初始化失败' });
});

setInterval(() => {
  loadMetrics().catch(() => {});
}, 5000);
