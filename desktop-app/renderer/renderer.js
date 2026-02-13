const envEditor = document.getElementById('envEditor');
const mappingEditor = document.getElementById('mappingEditor');
const dependencyEditor = document.getElementById('dependencyEditor');
const logOutput = document.getElementById('logOutput');
const logFilter = document.getElementById('logFilter');
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

const logs = [];
const MAX_LOGS = 800;

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
  logOutput.innerHTML = '';
  const fragment = document.createDocumentFragment();

  const view = logs.filter((entry) => {
    if (filter === 'all') return true;
    return entry.type === filter;
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

function pushLog(entry) {
  logs.push(entry);
  if (logs.length > MAX_LOGS) {
    logs.shift();
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

async function loadMetrics() {
  try {
    const raw = await window.predictBot.readMetrics();
    if (!raw) {
      setMetricsStatus('无数据', false);
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

    setMetricText(metricSuccessRate, `${formatNumber(successRate, 1)}%`);
    setMetricText(metricSuccessRaw, `${successes}/${attempts} 成功`);
    setMetricText(metricAttempts, `${attempts}`);
    setMetricText(metricPreflight, formatMs(metrics.emaPreflightMs));
    setMetricText(metricExec, formatMs(metrics.emaExecMs));
    setMetricText(metricTotal, formatMs(metrics.emaTotalMs));
    setMetricText(metricPostDrift, formatBps(metrics.emaPostTradeDriftBps));
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
    setMetricText(metricUpdatedAt, formatTimestamp(data.ts));
    setMetricsStatus('已更新', true);
  } catch (error) {
    setMetricsStatus('读取失败', false);
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
  await loadMetrics();
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
});

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => activateTab(btn.dataset.tab || 'env'));
});

refreshMetrics.addEventListener('click', loadMetrics);

init().catch((err) => {
  pushLog({ type: 'system', level: 'stderr', message: err?.message || '初始化失败' });
});

setInterval(() => {
  loadMetrics().catch(() => {});
}, 5000);
