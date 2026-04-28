/**
 * Predict.fun 做市商控制台 - 主进程
 * 
 * 功能：
 * 1. 一键启动/停止做市商
 * 2. 保守/激进模式切换（修改.env）
 * 3. 实时日志推送
 * 4. 系统状态检查
 * 5. 市场浏览与推荐
 * 6. JWT Token 获取（Predict.fun）
 * 7. Polymarket 平台配置
 */

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execSync } = require('child_process');
const https = require('https');
const http = require('http');

// 简易JSON存储（替代electron-store）
const STORE_PATH = path.join(app.getPath('userData'), 'config.json');
const store = {
  _data: {},
  _load() { try { this._data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')); } catch { this._data = {}; } },
  _save() { try { fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true }); fs.writeFileSync(STORE_PATH, JSON.stringify(this._data, null, 2)); } catch {} },
  get(key) { this._load(); return this._data[key]; },
  set(key, val) { this._load(); this._data[key] = val; this._save(); },
  delete(key) { this._load(); delete this._data[key]; this._save(); },
};
let mainWindow = null;
let appProcess = null;

// ==================== 窗口 ====================

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 860,
    minWidth: 900,
    minHeight: 700,
    title: 'Predict.fun 做市商控制台',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#0d0f1a',
    titleBarStyle: 'hiddenInset',
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ==================== 项目路径 ====================

function getProjectPath() {
  let projectPath = store.get('projectPath');
  // 验证缓存的路径是否仍然有效（跨平台或路径变更时）
  if (projectPath && !fs.existsSync(path.join(projectPath, 'package.json'))) {
    console.log(`⚠️  缓存路径无效: ${projectPath}，重新检测...`);
    store.delete('projectPath');
    projectPath = undefined;
  }
  if (!projectPath) {
    // 打包模式：runtime-dist 被 extraResources 复制到 resources/runtime-dist/
    const resourcesPath = path.dirname(app.getAppPath());
    const runtimePath = path.join(resourcesPath, 'runtime-dist');
    if (fs.existsSync(runtimePath)) {
      projectPath = runtimePath;
    } else {
      // fallback: asarUnpack 旧路径
      const unpackedPath = path.join(resourcesPath, 'app.asar.unpacked', 'runtime-dist');
      if (fs.existsSync(unpackedPath)) {
        projectPath = unpackedPath;
      } else {
        // fallback: 开发模式
        projectPath = path.resolve(__dirname, '..');
        if (!fs.existsSync(path.join(projectPath, 'package.json'))) {
          const devRuntime = path.resolve(__dirname, 'runtime-dist');
          if (fs.existsSync(devRuntime)) {
            projectPath = devRuntime;
          }
        }
      }
    }
    store.set('projectPath', projectPath);
  }
  return projectPath;
}

// 获取 .env 路径（用户数据目录，可读写）
function getEnvPath() {
  const userDataDir = app.getPath('userData');
  const userDataEnv = path.join(userDataDir, '.env');
  
  if (fs.existsSync(userDataEnv)) {
    return userDataEnv;
  }
  
  // 打包后不再包含 .env，创建空模板
  try {
    fs.mkdirSync(userDataDir, { recursive: true });
    const template = `# Predict.fun 市场做市商配置
# 请填写以下配置后保存
API_KEY=your_api_key_here
API_BASE_URL=https://api.predict.fun
PRIVATE_KEY=your_private_key_here
PREDICT_ACCOUNT_ADDRESS=your_account_address_here
RPC_URL=https://bsc-dataseed.binance.org
JWT_TOKEN=
MM_TRADING_MODE=conservative
MM_VENUE=predict
POLYMARKET_ENABLED=false
POLYMARKET_API_KEY=
POLYMARKET_PRIVATE_KEY=
POLYMARKET_FUNDER_ADDRESS=
MARKET_TOKEN_IDS=
`;
    fs.writeFileSync(userDataEnv, template, 'utf-8');
  } catch (e) {
    console.error('创建 .env 模板失败:', e);
  }
  
  return userDataEnv;
}

function getWatchlistPath() {
  return path.join(app.getPath('userData'), 'watchlist.json');
}

function getFlagPath() {
  return path.join(app.getPath('userData'), 'emergency-cancel.flag');
}

// ==================== .env 读写 ====================

function readEnv() {
  const envPath = getEnvPath();
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf-8');
  const config = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex < 0) continue;
    const key = trimmed.substring(0, eqIndex).trim();
    let value = trimmed.substring(eqIndex + 1).trim();
    // 剥离引号（.env里 KEY="value" 或 KEY='value' 都支持）
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    config[key] = value;
  }
  return config;
}

function writeEnv(key, value) {
  const envPath = getEnvPath();
  let content = '';
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf-8');
  }
  
  const lines = content.split('\n');
  let found = false;
  
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex < 0) continue;
    const existingKey = trimmed.substring(0, eqIndex).trim();
    if (existingKey === key) {
      lines[i] = `${key}=${value}`;
      found = true;
      break;
    }
  }
  
  if (!found) {
    lines.push(`${key}=${value}`);
  }
  
  fs.writeFileSync(envPath, lines.join('\n'), 'utf-8');
}

// ==================== 进程管理 ====================

function startMainApp() {
  if (appProcess) {
    return { success: false, message: '做市商已在运行中' };
  }

  try {
    const projectPath = getProjectPath();

    if (!fs.existsSync(projectPath)) {
      throw new Error('项目路径不存在: ' + projectPath);
    }

    const packageJson = path.join(projectPath, 'package.json');
    if (!fs.existsSync(packageJson)) {
      throw new Error('package.json 缺失');
    }

    const platform = process.platform;

    // 检查 node 和 npm 可用性，优先用 node 直接启动（避免依赖 npm 在 PATH 中）
    function findCommand(name) {
      const paths = process.env.PATH?.split(platform === 'win32' ? ';' : ':') || [];
      const exts = platform === 'win32' ? ['.exe', '.cmd', ''] : [''];
      for (const dir of paths) {
        for (const ext of exts) {
          const full = path.join(dir, name + ext);
          if (fs.existsSync(full)) return full;
        }
      }
      return name; // fallback 让系统自己找
    }

    const nodePath = findCommand('node');
    const npmPath = platform === 'win32' ? findCommand('npm.cmd') : findCommand('npm');

    let command, args, spawnOptions;
    
    if (fs.existsSync(path.join(projectPath, 'node_modules', 'tsx'))) {
      // runtime-dist 里有 tsx，直接用 node 启动
      command = nodePath;
      args = ['--import', 'tsx', 'src/index.ts'];
    } else if (fs.existsSync(npmPath) || npmPath === 'npm' || npmPath === 'npm.cmd') {
      // fallback 用 npm
      command = npmPath;
      args = ['run', 'start:cli'];
    } else {
      throw new Error('找不到 node 或 npm，请确保已安装 Node.js');
    }

    spawnOptions = {
      cwd: projectPath,
      env: { ...process.env, ENV_PATH: getEnvPath() },
      stdio: ['ignore', 'pipe', 'pipe'],
    };

    // Windows 不支持 detached，会报 EINVAL
    if (platform !== 'win32') {
      spawnOptions.detached = true;
    }
    
    appProcess = spawn(command, args, spawnOptions);

    const pushLog = (data, type) => {
      try {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('app-log', { text: data.toString(), type });
        }
      } catch (_) {}
    };

    appProcess.stdout.on('data', (d) => pushLog(d, 'out'));
    appProcess.stderr.on('data', (d) => pushLog(d, 'err'));

    appProcess.on('close', (code) => {
      pushLog(Buffer.from(`进程退出 (code=${code})`), 'exit');
      appProcess = null;
      try {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('app-log', { text: '__EXIT__', type: 'exit' });
        }
      } catch (_) {}
    });

    appProcess.on('error', (err) => {
      pushLog(Buffer.from(err.message), 'err');
      appProcess = null;
    });

    return { success: true, message: '做市商已启动' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

function stopMainApp() {
  if (!appProcess) {
    return { success: false, message: '没有运行中的做市商' };
  }
  try {
    const pid = appProcess.pid;
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
    } else {
      // detached模式下杀整个进程组（npm + tsx + node），不留orphan
      try { process.kill(-pid, 'SIGTERM'); } catch (_) {
        // fallback: 只杀主进程
        appProcess.kill('SIGTERM');
      }
    }
    appProcess = null;
    return { success: true, message: '做市商已停止' };
  } catch (error) {
    appProcess = null;
    return { success: false, message: error.message };
  }
}

// ==================== 系统检查 ====================

function checkSystemEnvironment() {
  const checks = { node: false, npm: false, projectPath: false, envFile: false };
  try {
    execSync('node --version', { stdio: 'ignore' });
    checks.node = true;
  } catch (_) {}
  try {
    execSync('npm --version', { stdio: 'ignore' });
    checks.npm = true;
  } catch (_) {}
  try {
    const projectPath = getProjectPath();
    checks.projectPath = fs.existsSync(projectPath);
    checks.envFile = fs.existsSync(getEnvPath());
  } catch (_) {}
  return checks;
}

// ==================== HTTP 请求工具 ====================

function httpGet(urlStr, headers = {}, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const mod = url.protocol === 'https:' ? https : http;
    const req = mod.get(url, { headers, timeout }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${parsed?.message || parsed?.error || JSON.stringify(parsed)}`));
          } else {
            resolve({ status: res.statusCode, data: parsed });
          }
        } catch {
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
          } else {
            resolve({ status: res.statusCode, data: data });
          }
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function httpPost(urlStr, body, headers = {}, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const mod = url.protocol === 'https:' ? https : http;
    const bodyStr = JSON.stringify(body);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr), ...headers },
      timeout,
    };
    const req = mod.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${parsed?.message || parsed?.error || JSON.stringify(parsed)}`));
          } else {
            resolve({ status: res.statusCode, data: parsed });
          }
        } catch {
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
          } else {
            resolve({ status: res.statusCode, data: data });
          }
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(bodyStr);
    req.end();
  });
}

// ==================== 市场浏览 ====================

async function fetchPredictMarkets() {
  const env = readEnv();
  const baseUrl = (env.API_BASE_URL || 'https://api.predict.fun').replace(/\/+$/, '');
  const apiKey = env.API_KEY || env.PREDICT_API_KEY || '';
  
  if (!apiKey) {
    throw new Error('未配置 API_KEY，请在认证面板中设置 Predict.fun API Key');
  }
  
  const headers = { 'Content-Type': 'application/json', 'x-api-key': apiKey };
  
  const collected = [];
  let after = undefined;
  let lastError = null;
  
  for (let page = 0; page < 20; page++) {
    const params = new URLSearchParams({ limit: '100', status: 'OPEN' });
    if (after) params.set('after', after);
    
    try {
      const res = await httpGet(`${baseUrl}/v1/markets?${params}`, headers);
      const payload = res.data?.data ?? res.data;
      const markets = Array.isArray(payload) ? payload : (payload?.markets ?? payload?.list ?? []);
      if (markets.length === 0) break;
      collected.push(...markets);
      // cursor 在根响应对象 res.data，不在 payload（payload 可能是数组）
      const cursor = res.data?.cursor;
      if (!cursor) break;
      after = cursor;
    } catch (err) {
      lastError = err;
      console.log(`[fetchPredictMarkets] /v1/markets failed: ${err.message}`);
      // fallback to /markets
      try {
        const res = await httpGet(`${baseUrl}/markets?${params}`, headers);
        const payload = res.data?.data ?? res.data;
        const markets = Array.isArray(payload) ? payload : (payload?.markets ?? []);
        if (markets.length === 0) break;
        collected.push(...markets);
        const cursor = res.data?.cursor;
        if (!cursor) break;
        after = cursor;
      } catch (err2) {
        lastError = err2;
        console.log(`[fetchPredictMarkets] fallback /markets failed: ${err2.message}`);
        break;
      }
    }
  }
  
  if (collected.length === 0 && lastError) {
    throw new Error(`获取市场失败: ${lastError.message}`);
  }
  
  // Normalize markets
  let markets = collected.map(m => {
    // API returns conditionId as market ID, but token_id is in outcomes[0].onChainId
    const outcomes = Array.isArray(m.outcomes) ? m.outcomes : [];
    const firstOutcome = outcomes[0];
    // token_id for orderbook API should be outcomes[0].onChainId
    const tokenId = firstOutcome?.onChainId || m.token_id || m.tokenId || m.clob_token_id || m.conditionId || '';

    // 更健壮的 maxSpreadCents 解析：尝试多种可能的 API 字段名
    let maxSpreadCents = 0;
    if (m.spreadThreshold) {
      maxSpreadCents = Math.round(m.spreadThreshold * 100);
    } else if (m.spread_threshold) {
      maxSpreadCents = Math.round(m.spread_threshold * 100);
    } else if (m.maxSpread) {
      maxSpreadCents = m.maxSpread > 1 ? Math.round(m.maxSpread) : Math.round(m.maxSpread * 100);
    } else if (m.maxSpreadCents) {
      maxSpreadCents = Math.round(m.maxSpreadCents);
    } else if (m.max_spread_cents) {
      maxSpreadCents = Math.round(m.max_spread_cents);
    } else if (m.liquidity_activation?.max_spread_cents) {
      maxSpreadCents = Math.round(m.liquidity_activation.max_spread_cents);
    } else if (m.liquidity_activation?.max_spread) {
      maxSpreadCents = Math.round(m.liquidity_activation.max_spread * 100);
    } else if (m.rewardMaxSpread) {
      maxSpreadCents = m.rewardMaxSpread > 1 ? Math.round(m.rewardMaxSpread) : Math.round(m.rewardMaxSpread * 100);
    } else if (m.reward_max_spread) {
      maxSpreadCents = m.reward_max_spread > 1 ? Math.round(m.reward_max_spread) : Math.round(m.reward_max_spread * 100);
    } else if (m.pointsMaxSpread) {
      maxSpreadCents = m.pointsMaxSpread > 1 ? Math.round(m.pointsMaxSpread) : Math.round(m.pointsMaxSpread * 100);
    } else if (m.points_max_spread) {
      maxSpreadCents = m.points_max_spread > 1 ? Math.round(m.points_max_spread) : Math.round(m.points_max_spread * 100);
    } else if (m.boost?.maxSpread) {
      maxSpreadCents = m.boost.maxSpread > 1 ? Math.round(m.boost.maxSpread) : Math.round(m.boost.maxSpread * 100);
    } else if (m.boost?.max_spread) {
      maxSpreadCents = m.boost.max_spread > 1 ? Math.round(m.boost.max_spread) : Math.round(m.boost.max_spread * 100);
    } else if (m.boost?.spreadThreshold) {
      maxSpreadCents = Math.round(m.boost.spreadThreshold * 100);
    }

    // 更健壮的 minShares 解析
    let minShares = m.shareThreshold || 0;
    if (!minShares && m.liquidity_activation?.min_shares) {
      minShares = m.liquidity_activation.min_shares;
    }
    if (!minShares && m.minShares) {
      minShares = m.minShares;
    }
    if (!minShares && m.min_shares) {
      minShares = m.min_shares;
    }
    if (!minShares && m.share_threshold) {
      minShares = m.share_threshold;
    }

    // 检测到积分标志但无法解析 maxSpreadCents 时记录调试信息
    const hasPointsFlags = !!(m.isBoosted || m.rewardsEnabled || m.liquidity_activation ||
                            m.liquidityActivation || m.boostEndsAt ||
                            (m.rewards && m.rewards.enabled) || m.rewardMaxSpread ||
                            m.reward_max_spread || m.pointsMaxSpread || m.points_max_spread ||
                            m.boost);
    if (hasPointsFlags && maxSpreadCents <= 0) {
      const relevantKeys = Object.keys(m).filter(k =>
        /spread|threshold|boost|reward|point|liquidity/i.test(k)
      );
      const relevantData = {};
      relevantKeys.forEach(k => { relevantData[k] = m[k]; });
      logToTerminal(`[fetchPredictMarkets] 市场 ${m.question?.substring(0, 40)} 有积分标志但无法解析 maxSpreadCents，相关字段: ${JSON.stringify(relevantData)}`);
    }

    // 积分检查：只要有有效的 maxSpreadCents（即 spreadThreshold）就认为有积分规则
    // isBoosted 只是额外积分活动，不是是否有积分的必要条件
    const pointsActive = maxSpreadCents > 0;

    // Extract best bid/ask from first outcome - API returns { price, size } objects
    let bestBid = null;
    let bestAsk = null;
    let bestBidSize = 0;
    let bestAskSize = 0;
    if (firstOutcome?.bestBid && typeof firstOutcome.bestBid === 'object') {
      bestBid = Number(firstOutcome.bestBid.price ?? 0) || null;
      bestBidSize = Number(firstOutcome.bestBid.size ?? firstOutcome.bestBid.shares ?? firstOutcome.bestBid.amount ?? firstOutcome.bestBid.quantity ?? firstOutcome.bestBid.volume ?? 0) || 0;
    } else {
      bestBid = m.best_bid || m.bestBid || null;
      bestBidSize = Number(m.best_bid_size || m.bestBidSize || m.bidSize || m.bid_size || m.bestBid?.size || 0);
    }
    if (firstOutcome?.bestAsk && typeof firstOutcome.bestAsk === 'object') {
      bestAsk = Number(firstOutcome.bestAsk.price ?? 0) || null;
      bestAskSize = Number(firstOutcome.bestAsk.size ?? firstOutcome.bestAsk.shares ?? firstOutcome.bestAsk.amount ?? firstOutcome.bestAsk.quantity ?? firstOutcome.bestAsk.volume ?? 0) || 0;
    } else {
      bestAsk = m.best_ask || m.bestAsk || null;
      bestAskSize = Number(m.best_ask_size || m.bestAskSize || m.askSize || m.ask_size || m.bestAsk?.size || 0);
    }

    return {
      token_id: tokenId,
      conditionId: m.conditionId,
      question: m.question || m.title || m.name || '',
      description: (m.description || '').substring(0, 200),
      venue: 'predict',
      end_date: m.end_date || m.endDate || '',
      boost_ends_at: m.boostEndsAt || '',
      volume_24h: m.volume_24h || m.volume24h || (m.stats?.volume24hr) || 0,
      outcome: m.outcome || '',
      outcomes: outcomes.map(o => ({
        token_id: o.token_id || o.tokenId || o.onChainId || '',
        outcome: o.outcome || o.name || '',
        price: o.price || 0,
        status: o.status || 'OPEN',
      })),
      points_active: pointsActive,
      max_spread_cents: maxSpreadCents,
      min_shares: minShares,
      // 兼容后端 screenMarket() 的积分规则检查（后端使用 getEffectiveLiquidityActivation）
      liquidity_activation: pointsActive ? {
        active: true,
        min_shares: minShares > 0 ? minShares : undefined,
        max_spread_cents: maxSpreadCents > 0 ? maxSpreadCents : undefined,
        max_spread: maxSpreadCents > 0 ? maxSpreadCents / 100 : undefined,
        description: 'api-points',
      } : undefined,
      best_bid: bestBid,
      best_ask: bestAsk,
      best_bid_size: bestBidSize,
      best_ask_size: bestAskSize,
      spread_pct: (bestBid && bestAsk) ? ((bestAsk - bestBid) / bestBid) * 100 : null,
    };
  }).filter(m => {
    // 基础过滤：必须有 token_id 和 question
    if (!(m.token_id || m.conditionId) || !m.question) return false;

    // 只过滤已结算/已关闭的市场（保留即将结算的，由 screenMarketUI 标记为不可交易）
    // API 传 status=OPEN 时 outcome.status 可能是 null/undefined，也算 OPEN
    const hasOpenOutcome = m.outcomes.some(o => !o.status || o.status === 'OPEN');
    if (m.outcomes.length > 0 && !hasOpenOutcome) return false;

    return true;
  });

  return markets;
}

async function fetchPolymarketMarkets() {
  try {
    // Use Gamma API to get active markets with rewards
    const res = await httpGet('https://gamma-api.polymarket.com/markets?closed=false&order=volume24hr&ascending=false&limit=100');
    const rawMarkets = res.data?.data ?? res.data;
    const markets = Array.isArray(rawMarkets) ? rawMarkets : [];
    
    return markets.map(m => {
      let clobTokenIds = [], outcomes = [], outcomePrices = [];
      try { clobTokenIds = m.clobTokenIds ? JSON.parse(m.clobTokenIds) : []; } catch {}
      try { outcomes = m.outcomes ? JSON.parse(m.outcomes) : []; } catch {}
      try { outcomePrices = m.outcomePrices ? JSON.parse(m.outcomePrices) : []; } catch {}
      
      return {
        token_id: clobTokenIds[0] || m.conditionId || '',
        question: m.question || '',
        description: (m.description || '').substring(0, 200),
        venue: 'polymarket',
        end_date: m.endDate || m.end_date_iso || '',
        volume_24h: parseFloat(m.volume24hr || 0),
        outcome: outcomes[0] || '',
        outcomes: outcomes.map((o, i) => ({
          token_id: clobTokenIds[i] || '',
          outcome: o,
          price: parseFloat(outcomePrices[i] || 0),
        })),
        points_active: !!(m.rewardsEnabled || m.active),
        max_spread_cents: 0,
        min_shares: 0,
        polymarket_slug: m.slug || '',
        polymarket_rewards: m.rewardsEnabled || false,
        polymarket_daily_rate: parseFloat(m.rewardDailyRate || 0),
      };
    }).filter(m => m.token_id && m.question);
  } catch (err) {
    return { error: err.message };
  }
}

// ==================== JWT 获取 ====================

async function fetchPredictJwt() {
  const env = readEnv();
  const baseUrl = (env.API_BASE_URL || 'https://api.predict.fun').replace(/\/+$/, '');
  const apiKey = env.API_KEY || env.PREDICT_API_KEY || '';
  const privateKey = env.PRIVATE_KEY || '';
  const accountAddress = env.PREDICT_ACCOUNT_ADDRESS || '';
  
  if (!apiKey) return { success: false, message: 'API_KEY 未配置，请在认证面板中设置' };
  if (!privateKey || privateKey === '0x0000000000000000000000000000000000000000000000000000000000000001') {
    return { success: false, message: 'PRIVATE_KEY 未配置或为占位符' };
  }
  
  const headers = { 'Content-Type': 'application/json', 'x-api-key': apiKey };
  
  async function retryHttp(fn, retries = 3, delayMs = 2000) {
    for (let i = 0; i < retries; i++) {
      try { return await fn(); }
      catch (err) {
        if (i === retries - 1) throw err;
        console.log(`[JWT] 重试 ${i+1}/${retries-1} (${err.message})...`);
        await new Promise(r => setTimeout(r, delayMs * (i + 1)));
      }
    }
  }
  
  try {
    // Step 1: Get auth message
    let message = '';
    try {
      const res = await retryHttp(() => httpGet(`${baseUrl}/v1/auth/message`, headers));
      const payload = res.data?.data ?? res.data;
      message = typeof payload === 'string' ? payload : String(payload?.message || '');
    } catch {
      const res = await retryHttp(() => httpGet(`${baseUrl}/auth/message`, headers));
      const payload = res.data?.data ?? res.data;
      message = typeof payload === 'string' ? payload : String(payload?.message || '');
    }
    
    if (!message) {
      return { success: false, message: '无法获取 auth message，请检查 API_KEY' };
    }
    
    // Step 2: Sign message using ethers (require from project)
    const projectPath = getProjectPath();
    let signature = '';
    let signerAddress = accountAddress;
    
    // Validate address: reject placeholder / zero addresses
    const isValidAddr = /^0x[0-9a-fA-F]{40}$/.test(accountAddress || '') && (accountAddress || '').toLowerCase() !== '0x' + '0'.repeat(40);
    if (!isValidAddr) {
      signerAddress = '';
    }
    
    try {
      // Try using the project's ethers dependency
      const ethersPath = path.join(projectPath, 'node_modules', 'ethers');
      if (!fs.existsSync(ethersPath)) {
        return { success: false, message: 'ethers 未安装，请先 npm install' };
      }
      
      // Use dynamic require
      const { Wallet } = require(ethersPath);
      const wallet = new Wallet(privateKey);
      if (!signerAddress) signerAddress = wallet.address;
      
      // Check if predict SDK is available for account signing
      let usedAccountSigner = false;
      if (isValidAddr) {
        try {
          const sdkPath = path.join(projectPath, 'node_modules', '@predictdotfun', 'sdk');
          if (fs.existsSync(sdkPath)) {
            const { OrderBuilder, ChainId } = require(sdkPath);
            const chainId = ChainId?.BnbMainnet ?? 56;
            const orderBuilder = await OrderBuilder.make(chainId, wallet, {
              predictAccount: accountAddress,
            });
            signature = await orderBuilder.signPredictAccountMessage(message);
            usedAccountSigner = true;
          }
        } catch (sdkErr) {
          console.log(`[JWT] PredictAccount signer failed: ${sdkErr.message}, falling back to EOA`);
        }
      }
      
      if (!usedAccountSigner) {
        signature = await wallet.signMessage(message);
        if (!signerAddress) signerAddress = wallet.address;
      }
    } catch (err) {
      return { success: false, message: '签名失败: ' + err.message };
    }
    
    // Step 3: Exchange for JWT
    let token = '';
    try {
      const res = await retryHttp(() => httpPost(`${baseUrl}/v1/auth`, { signer: signerAddress, signature, message }, headers));
      const data = res.data?.data ?? res.data;
      token = data?.token || data?.jwt || data?.accessToken || '';
    } catch {
      try {
        const res = await retryHttp(() => httpPost(`${baseUrl}/auth`, { signer: signerAddress, signature, message }, headers));
        const data = res.data?.data ?? res.data;
        token = data?.token || data?.jwt || data?.accessToken || '';
      } catch (err2) {
        return { success: false, message: 'JWT 请求失败: ' + err2.message };
      }
    }
    
    if (!token) {
      return { success: false, message: 'Auth 成功但未返回 token' };
    }
    
    // Step 4: Write to .env
    writeEnv('JWT_TOKEN', token);
    
    return { 
      success: true, 
      message: `JWT 获取成功! Signer: ${signerAddress.slice(0, 10)}...`,
      token: token.slice(0, 20) + '...',
      signer: signerAddress,
    };
  } catch (err) {
    return { success: false, message: 'JWT 获取失败: ' + err.message };
  }
}

// ==================== 市场推荐与筛选 ====================

function recommendMarkets(markets, mode) {
  const isConservative = mode !== 'aggressive';

  return markets.map(m => {
    let score = 0;
    let reasons = [];
    const maxSpread = m.max_spread_cents || 0;
    const minShares = m.min_shares || 100;
    const bookSpread = m.best_bid && m.best_ask ?
      (m.best_ask - m.best_bid) * 100 : 999;
    const bufferPerSide = maxSpread > 0 && bookSpread < 999 ? (maxSpread - bookSpread) / 2 : 0;

    // ===== Layer 0: Points active = essential =====
    if (!m.points_active || maxSpread <= 0) {
      return { ...m, score: -50, reasons: ['无积分规则'], recommended: false };
    }
    score += 20;
    reasons.push('有积分(' + maxSpread + 'c/' + minShares + '股)');

    // ===== Layer 0.5: 硬性过滤 — 即将结算（fetchPredictMarkets已过滤，这里兜底） =====
    if (m.end_date) {
      const hoursLeft = (new Date(m.end_date) - Date.now()) / 3600000;
      if (hoursLeft <= 24) {
        return { ...m, score: -100, reasons: ['24h内到期🚫'], recommended: false };
      }
    }

    // ===== Layer 1: 简化筛选：只检查盘口价差是否超过积分上限 =====
    if (bookSpread > maxSpread) {
      return { ...m, score: 0, reasons: [...reasons, '盘口价差超过积分上限'], recommended: false };
    }

    // ===== Layer 2: Buffer quality scoring =====
    score += Math.min(25, Math.floor(bufferPerSide * 4));
    reasons.push('缓冲' + bufferPerSide.toFixed(1) + 'c');

    // Buffer utilization: lower is better (more room to quote)
    const bufferUtilization = bookSpread / maxSpread;
    if (bufferUtilization < 0.3) {
      score += 10;
      reasons.push('盘口宽松');
    } else if (bufferUtilization > 0.7) {
      score -= 5;
      reasons.push('盘口拥挤');
    }

    // ===== Layer 3: Points efficiency scoring =====
    const pointsEfficiency = (bufferPerSide / Math.max(minShares, 1)) * 1000;
    score += Math.min(20, Math.floor(pointsEfficiency * 2));

    // min_shares越低，资金门槛越低，评分越高
    if (minShares <= 50) {
      score += 15;
      reasons.push('低门槛(' + minShares + '股)');
    } else if (minShares <= 100) {
      score += 10;
      reasons.push('门槛低(' + minShares + '股)');
    } else if (minShares <= 200) {
      score += 5;
      reasons.push('门槛中等');
    } else {
      score -= 5;
      reasons.push('门槛高(' + minShares + '股)');
    }

    // max_spread奖励：更大的max_spread = 更大的盈利空间
    if (maxSpread >= 8) {
      score += 8;
      reasons.push('宽价差(' + maxSpread + 'c)');
    } else if (maxSpread >= 6) {
      score += 5;
      reasons.push('标准价差');
    }

    // ===== Layer 4: Liquidity scoring (volume-based, 辅助参考) =====
    const vol = m.volume_24h || 0;
    if (vol > 50000) {
      score += 6;
      reasons.push('极高成交量');
    } else if (vol > 20000) {
      score += 4;
      reasons.push('高成交量');
    } else if (vol > 10000) {
      score += 2;
      reasons.push('中高成交量');
    } else if (vol > 2000) {
      score += 1;
    } else if (vol <= 500) {
      score -= 3;
      reasons.push('低成交量');
    }

    // ===== Layer 5: L1+L2 Depth scoring (核心新增) =====
    // L1+L2 深度越大，我们挂第3/4档越安全（吃单者先吃前面档位）
    const l1Depth = (m.best_bid_size || 0) + (m.best_ask_size || 0);
    const minFrontDepth = isConservative ? 6000 : 4000;
    if (l1Depth === 0) {
      // API 不返回 size 数据，不加分不扣分，由后端确认
      reasons.push('盘口深度待确认');
    } else if (l1Depth >= minFrontDepth * 3) {
      score += 25;
      reasons.push('L1+L2极深(' + Math.floor(l1Depth) + ')');
    } else if (l1Depth >= minFrontDepth * 2) {
      score += 18;
      reasons.push('L1+L2很深(' + Math.floor(l1Depth) + ')');
    } else if (l1Depth >= minFrontDepth) {
      score += 12;
      reasons.push('L1+L2充足(' + Math.floor(l1Depth) + ')');
    } else if (l1Depth >= minFrontDepth * 0.5) {
      score += 4;
      reasons.push('L1+L2一般(' + Math.floor(l1Depth) + ')');
    } else {
      score -= 15;
      reasons.push('L1+L2薄弱(' + Math.floor(l1Depth) + ')');
    }

    // ===== Layer 6: Time risk scoring =====
    if (m.end_date) {
      const daysLeft = (new Date(m.end_date) - Date.now()) / 86400000;
      if (daysLeft > 60) {
        score += 12;
        reasons.push('超长期市场');
      } else if (daysLeft > 30) {
        score += 10;
        reasons.push('长期市场');
      } else if (daysLeft > 14) {
        score += 6;
        reasons.push(`${Math.floor(daysLeft)}天后到期`);
      } else if (daysLeft > 7) {
        score += 2;
        reasons.push('2周内到期');
      } else if (daysLeft > 3) {
        score -= 8;
        reasons.push('1周内到期⚠️');
      } else {
        score -= 20;
        reasons.push('3天内到期❗');
      }
    }

    // ===== Layer 7: Price quality (if available) =====
    if (m.best_bid && m.best_ask) {
      const midPrice = (m.best_bid + m.best_ask) / 2;
      // 避免极端价格市场（接近0或1）
      if (midPrice > 0.1 && midPrice < 0.9) {
        score += 3;
      } else if (midPrice < 0.05 || midPrice > 0.95) {
        score -= 5;
        reasons.push('极端价格');
      }
    }

    return { ...m, score, reasons, recommended: score >= 40 };
  }).sort((a, b) => b.score - a.score);
}

// ==================== IPC ====================

// ==================== IPC Handlers ====================
// 所有handler统一try-catch，防止单个报错让前端卡死

function safeHandle(channel, fn) {
  ipcMain.handle(channel, async (...args) => {
    try { return await fn(...args); }
    catch (e) { return { success: false, message: e?.message || String(e) }; }
  });
}

safeHandle('start-app', async () => startMainApp());
safeHandle('stop-app', async () => stopMainApp());
safeHandle('get-app-status', async () => ({ running: !!appProcess, pid: appProcess?.pid ?? null }));

// 紧急撤单: 写入 flag 文件，子进程定期检查
safeHandle('emergency-cancel-all', async () => {
  if (!appProcess) {
    return { success: false, message: '没有运行中的做市商' };
  }
  const flagPath = getFlagPath();
  fs.writeFileSync(flagPath, String(Date.now()), 'utf-8');
  console.log('[紧急撤单] 已发送撤单信号');
  return { success: true, message: '撤单信号已发送，做市商正在执行' };
});

safeHandle('open-project-folder', async () => { shell.openPath(getProjectPath()); return { success: true }; });
safeHandle('open-config-file', async () => {
  const envPath = getEnvPath();
  shell.openPath(envPath);
  return { success: true };
});
safeHandle('check-system', async () => checkSystemEnvironment());
safeHandle('get-project-path', async () => getProjectPath());
safeHandle('set-project-path', async (_, p) => { store.set('projectPath', p); return { success: true }; });
safeHandle('select-project-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow || undefined, { properties: ['openDirectory'], title: '选择项目文件夹' });
  if (!result.canceled && result.filePaths.length > 0) {
    store.set('projectPath', result.filePaths[0]);
    return { success: true, path: result.filePaths[0] };
  }
  return { success: false };
});

safeHandle('get-config', async () => readEnv());
safeHandle('set-config', async (_, key, value) => { writeEnv(key, value); return { success: true }; });
safeHandle('set-trading-mode', async (_, mode) => {
  if (mode !== 'conservative' && mode !== 'aggressive') {
    return { success: false, message: '无效模式' };
  }
  writeEnv('MM_TRADING_MODE', mode);
  return { success: true };
});

// ===== 市场 =====
safeHandle('fetch-predict-markets', async () => {
  const markets = await fetchPredictMarkets();
  return { success: true, markets };
});

safeHandle('fetch-polymarket-markets', async () => {
  const result = await fetchPolymarketMarkets();
  if (result.error) return { success: false, message: result.error, markets: [] };
  return { success: true, markets: result };
});

safeHandle('recommend-markets', async (_, markets, mode) => {
  return recommendMarkets(markets, mode);
});

safeHandle('apply-market-selection', async (_, tokenIdsStr) => {
  // 将选中的 token_ids 写入 .env 的 MARKET_TOKEN_IDS
  if (!tokenIdsStr || typeof tokenIdsStr !== 'string') {
    return { success: false, message: '无效的市场ID列表' };
  }
  const envPath = getEnvPath();
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
  }
  // 更新或添加 MARKET_TOKEN_IDS
  const newLine = ['MARKET_TOKEN_IDS=', tokenIdsStr].join('');
  const idx = envContent.indexOf('MARKET_TOKEN_IDS=');
  if (idx >= 0) {
    const endIdx = envContent.indexOf('\n', idx);
    const oldLine = endIdx >= 0 ? envContent.substring(idx, endIdx) : envContent.substring(idx);
    envContent = envContent.split(oldLine).join(newLine);
  } else {
    envContent = [envContent.trimEnd(), newLine, ''].join('\n');
  }
  fs.writeFileSync(envPath, envContent, 'utf-8');
  const count = tokenIdsStr.split(',').filter(s => s.trim()).length;
  console.log(`[市场选择] 已写入 ${count} 个市场到 MARKET_TOKEN_IDS`);
  return { success: true, count };
});

safeHandle('add-market-to-watch', async (_, tokenId, question) => {
  const watchPath = getWatchlistPath();
  let watchlist = [];
  try {
    if (fs.existsSync(watchPath)) {
      watchlist = JSON.parse(fs.readFileSync(watchPath, 'utf-8'));
    }
  } catch {}
  if (!watchlist.find(w => w.token_id === tokenId)) {
    watchlist.push({ token_id: tokenId, question, added_at: Date.now() });
    fs.writeFileSync(watchPath, JSON.stringify(watchlist, null, 2));
  }
  return { success: true };
});

safeHandle('remove-market-from-watch', async (_, tokenId) => {
  const watchPath = getWatchlistPath();
  try {
    if (fs.existsSync(watchPath)) {
      let watchlist = JSON.parse(fs.readFileSync(watchPath, 'utf-8'));
      watchlist = watchlist.filter(w => w.token_id !== tokenId);
      fs.writeFileSync(watchPath, JSON.stringify(watchlist, null, 2));
    }
  } catch {}
  return { success: true };
});

safeHandle('get-watchlist', async () => {
  const watchPath = getWatchlistPath();
  try {
    if (fs.existsSync(watchPath)) {
      return { success: true, watchlist: JSON.parse(fs.readFileSync(watchPath, 'utf-8')) };
    }
  } catch {}
  return { success: true, watchlist: [] };
});

// ===== JWT =====
safeHandle('fetch-jwt', async () => {
  return await fetchPredictJwt();
});

safeHandle('get-jwt-status', async () => {
  const env = readEnv();
  const hasJwt = !!(env.JWT_TOKEN && env.JWT_TOKEN.length > 20);
  const hasApiKey = !!(env.API_KEY || env.PREDICT_API_KEY);
  const hasPrivateKey = !!(env.PRIVATE_KEY && env.PRIVATE_KEY !== '0x0000000000000000000000000000000000000000000000000000000000000001');
  const hasAccount = !!(env.PREDICT_ACCOUNT_ADDRESS);
  return { hasJwt, hasApiKey, hasPrivateKey, hasAccount };
});

// ===== Polymarket =====
safeHandle('set-platform', async (_, venue) => {
  if (venue !== 'predict' && venue !== 'polymarket' && venue !== 'both') {
    return { success: false, message: '无效平台' };
  }
  writeEnv('MM_VENUE', venue === 'both' ? 'predict' : venue);
  if (venue === 'both' || venue === 'polymarket') {
    writeEnv('POLYMARKET_ENABLED', 'true');
  } else {
    writeEnv('POLYMARKET_ENABLED', 'false');
  }
  return { success: true };
});

safeHandle('get-polymarket-status', async () => {
  const env = readEnv();
  return {
    enabled: env.POLYMARKET_ENABLED === 'true' || env.MM_VENUE === 'polymarket',
    hasApiKey: !!(env.POLYMARKET_API_KEY),
    hasPrivateKey: !!(env.POLYMARKET_PRIVATE_KEY),
    hasFunder: !!(env.POLYMARKET_FUNDER_ADDRESS),
    venue: env.MM_VENUE || 'predict',
  };
});

// ==================== 生命周期 ====================

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// 做市商运行中关闭窗口时杀进程组
app.on('window-all-closed', () => {
  if (appProcess) {
    console.log('🛑 做市商还在运行，发送 SIGTERM...');
    try {
      const pid = appProcess.pid;
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
      } else {
        try { process.kill(-pid, 'SIGTERM'); } catch (_) { appProcess.kill('SIGTERM'); }
      }
    } catch (_) {}
    appProcess = null;
  }
  if (process.platform !== 'darwin') app.quit();
});

// 窗口关闭前确保子进程被杀
app.on('before-quit', () => {
  if (appProcess) {
    try {
      const pid = appProcess.pid;
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
      } else {
        try { process.kill(-pid, 'SIGTERM'); } catch (_) {}
      }
    } catch (_) {}
    appProcess = null;
  }
});

process.on('uncaughtException', (error) => console.error('未捕获的异常:', error));
process.on('unhandledRejection', (reason) => console.error('未处理的 Promise 拒绝:', reason));
