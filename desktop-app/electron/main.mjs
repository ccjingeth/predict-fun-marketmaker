import { app, BrowserWindow, ipcMain } from 'electron';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const devProjectRoot = path.resolve(__dirname, '..', '..');
const rendererPath = path.resolve(__dirname, '..', 'renderer', 'index.html');

const processes = new Map();
let mainWindow = null;

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function getProjectRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'bot');
  }
  return devProjectRoot;
}

function getUserDataRoot() {
  return path.join(app.getPath('userData'), 'bot');
}

function ensureUserDataAssets() {
  if (!app.isPackaged) {
    return;
  }

  const userRoot = getUserDataRoot();
  fs.mkdirSync(userRoot, { recursive: true });

  const envPath = path.join(userRoot, '.env');
  const mappingPath = path.join(userRoot, 'cross-platform-mapping.json');
  const dependencyPath = path.join(userRoot, 'dependency-constraints.json');
  const statePath = path.join(userRoot, 'cross-platform-state.json');
  const metricsPath = path.join(userRoot, 'cross-platform-metrics.json');

  if (!fs.existsSync(envPath)) {
    const templatePath = path.join(getProjectRoot(), '.env.example');
    let template = '';
    if (fs.existsSync(templatePath)) {
      template = fs.readFileSync(templatePath, 'utf8');
    }
    if (!template.includes('CROSS_PLATFORM_MAPPING_PATH')) {
      template = `${template.trim()}\nCROSS_PLATFORM_MAPPING_PATH=${mappingPath}\n`;
    } else {
      template = template.replace(
        /CROSS_PLATFORM_MAPPING_PATH=.*/g,
        `CROSS_PLATFORM_MAPPING_PATH=${mappingPath}`
      );
    }
    if (!template.includes('DEPENDENCY_CONSTRAINTS_PATH')) {
      template = `${template.trim()}\nDEPENDENCY_CONSTRAINTS_PATH=${dependencyPath}\n`;
    } else {
      template = template.replace(
        /DEPENDENCY_CONSTRAINTS_PATH=.*/g,
        `DEPENDENCY_CONSTRAINTS_PATH=${dependencyPath}`
      );
    }
    if (!template.includes('CROSS_PLATFORM_STATE_PATH')) {
      template = `${template.trim()}\nCROSS_PLATFORM_STATE_PATH=${statePath}\n`;
    } else {
      template = template.replace(/CROSS_PLATFORM_STATE_PATH=.*/g, `CROSS_PLATFORM_STATE_PATH=${statePath}`);
    }
    if (!template.includes('CROSS_PLATFORM_METRICS_PATH')) {
      template = `${template.trim()}\nCROSS_PLATFORM_METRICS_PATH=${metricsPath}\n`;
    } else {
      template = template.replace(/CROSS_PLATFORM_METRICS_PATH=.*/g, `CROSS_PLATFORM_METRICS_PATH=${metricsPath}`);
    }
    fs.writeFileSync(envPath, template.endsWith('\n') ? template : `${template}\n`, 'utf8');
  }

  if (!fs.existsSync(mappingPath)) {
    const mappingTemplate = path.join(getProjectRoot(), 'cross-platform-mapping.json');
    if (fs.existsSync(mappingTemplate)) {
      fs.copyFileSync(mappingTemplate, mappingPath);
    } else {
      fs.writeFileSync(mappingPath, '{\"entries\":[]}\n', 'utf8');
    }
  }

  if (!fs.existsSync(dependencyPath)) {
    const dependencyTemplate = path.join(getProjectRoot(), 'dependency-constraints.json');
    if (fs.existsSync(dependencyTemplate)) {
      fs.copyFileSync(dependencyTemplate, dependencyPath);
    } else {
      fs.writeFileSync(dependencyPath, '{\"conditions\":[],\"groups\":[],\"relations\":[]}\n', 'utf8');
    }
  }

  if (!fs.existsSync(statePath)) {
    fs.writeFileSync(statePath, '{\"version\":1,\"ts\":0}\n', 'utf8');
  }

  if (!fs.existsSync(metricsPath)) {
    fs.writeFileSync(metricsPath, '{\"version\":1,\"ts\":0,\"metrics\":{}}\n', 'utf8');
  }
}

function getEnvPath() {
  if (app.isPackaged) {
    ensureUserDataAssets();
    return path.join(getUserDataRoot(), '.env');
  }
  return path.join(devProjectRoot, '.env');
}

function readEnvFile() {
  const envPath = getEnvPath();
  if (!fs.existsSync(envPath)) {
    return '';
  }
  return fs.readFileSync(envPath, 'utf8');
}

function writeEnvFile(text) {
  const envPath = getEnvPath();
  fs.writeFileSync(envPath, text.endsWith('\n') ? text : `${text}\n`, 'utf8');
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
      if (key) {
        map.set(key, value);
      }
    });
  return map;
}

function resolveConfigPath(value, fallbackPath) {
  if (!value) return fallbackPath;
  if (path.isAbsolute(value)) return value;
  return path.join(getProjectRoot(), value);
}

function resolveMappingPath() {
  const envText = readEnvFile();
  const env = parseEnv(envText);
  const fallback = path.join(getUserDataRoot(), 'cross-platform-mapping.json');
  return resolveConfigPath(env.get('CROSS_PLATFORM_MAPPING_PATH'), fallback);
}

function resolveDependencyPath() {
  const envText = readEnvFile();
  const env = parseEnv(envText);
  const fallback = path.join(getUserDataRoot(), 'dependency-constraints.json');
  return resolveConfigPath(env.get('DEPENDENCY_CONSTRAINTS_PATH'), fallback);
}

function resolveStatePath() {
  const envText = readEnvFile();
  const env = parseEnv(envText);
  const fallback = path.join(getUserDataRoot(), 'cross-platform-state.json');
  return resolveConfigPath(env.get('CROSS_PLATFORM_STATE_PATH'), fallback);
}

function resolveMetricsPath() {
  const envText = readEnvFile();
  const env = parseEnv(envText);
  const fallback = path.join(getUserDataRoot(), 'cross-platform-metrics.json');
  return resolveConfigPath(env.get('CROSS_PLATFORM_METRICS_PATH'), fallback);
}

function readTextFile(filePath, fallback = '') {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  return fs.readFileSync(filePath, 'utf8');
}

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeTextFile(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text.endsWith('\n') ? text : `${text}\n`, 'utf8');
}

function getStatus() {
  return {
    marketMaker: processes.has('mm'),
    arbitrage: processes.has('arb'),
  };
}

function sendStatus() {
  sendToRenderer('bot-status', getStatus());
}

function resolveNodeBinary() {
  return process.env.NODE_BINARY || (process.platform === 'win32' ? 'node.exe' : 'node');
}

function spawnBot(type) {
  if (processes.has(type)) {
    return { ok: false, message: '进程已在运行' };
  }

  const projectRoot = getProjectRoot();
  const envPath = getEnvPath();
  const mappingPath = path.join(getUserDataRoot(), 'cross-platform-mapping.json');
  const dependencyPath = path.join(getUserDataRoot(), 'dependency-constraints.json');

  let command;
  let args;

  if (app.isPackaged) {
    const entry = type === 'mm' ? 'dist/index.js' : 'dist/arbitrage-bot.js';
    const entryPath = path.join(projectRoot, entry);
    if (!fs.existsSync(entryPath)) {
      return { ok: false, message: `未找到打包后的脚本: ${entryPath}` };
    }
    command = resolveNodeBinary();
    args = [entryPath];
  } else {
    const entry = type === 'mm' ? 'src/index.ts' : 'src/arbitrage-bot.ts';
    command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    args = ['tsx', entry];
  }

  const child = spawn(command, args, {
    cwd: projectRoot,
    env: {
      ...process.env,
      ENV_PATH: envPath,
      CROSS_PLATFORM_MAPPING_PATH: mappingPath,
      DEPENDENCY_CONSTRAINTS_PATH: dependencyPath,
    },
    shell: false,
  });

  processes.set(type, child);

  child.stdout.on('data', (data) => {
    sendToRenderer('bot-log', { type, level: 'stdout', message: data.toString() });
  });

  child.stderr.on('data', (data) => {
    sendToRenderer('bot-log', { type, level: 'stderr', message: data.toString() });
  });

  child.on('exit', (code, signal) => {
    processes.delete(type);
    sendToRenderer('bot-log', {
      type,
      level: 'system',
      message: `进程退出 (${type}) code=${code ?? 'null'} signal=${signal ?? 'null'}`,
    });
    sendStatus();
  });

  sendToRenderer('bot-log', { type, level: 'system', message: `启动进程 (${type})` });
  sendStatus();
  return { ok: true };
}

function stopBot(type) {
  const child = processes.get(type);
  if (!child) {
    return { ok: false, message: '进程未运行' };
  }

  child.kill('SIGTERM');

  setTimeout(() => {
    if (!child.killed) {
      child.kill('SIGKILL');
    }
  }, 5000);

  return { ok: true };
}

function buildDiagnostics() {
  const items = [];
  const envPath = getEnvPath();
  const envText = readEnvFile();
  const env = parseEnv(envText);
  const mappingPath = resolveMappingPath();
  const dependencyPath = resolveDependencyPath();
  const metricsPath = resolveMetricsPath();
  const statePath = resolveStatePath();

  if (!envText || !envText.trim()) {
    items.push({ level: 'error', title: '环境变量', message: '.env 为空或不存在' });
  } else {
    items.push({ level: 'ok', title: '环境变量', message: `已加载 ${envPath}` });
  }

  const apiKey = env.get('API_KEY');
  const privateKey = env.get('PRIVATE_KEY');
  const jwtToken = env.get('JWT_TOKEN');
  const enableTrading = (env.get('ENABLE_TRADING') || '').toLowerCase() === 'true';

  if (!apiKey) {
    items.push({ level: 'error', title: 'API_KEY', message: 'Predict API Key 未配置' });
  } else {
    items.push({ level: 'ok', title: 'API_KEY', message: '已配置' });
  }

  if (!privateKey) {
    items.push({ level: 'error', title: 'PRIVATE_KEY', message: '钱包私钥未配置' });
  } else {
    items.push({ level: 'ok', title: 'PRIVATE_KEY', message: '已配置' });
  }

  if (enableTrading && !jwtToken) {
    items.push({ level: 'warn', title: 'JWT_TOKEN', message: '实盘模式未检测到 JWT_TOKEN' });
  } else if (jwtToken) {
    items.push({ level: 'ok', title: 'JWT_TOKEN', message: '已配置' });
  }

  const mapping = readJsonFile(mappingPath);
  if (!mapping) {
    items.push({ level: 'warn', title: '跨平台映射', message: '映射文件缺失或格式错误' });
  } else {
    const entries = Array.isArray(mapping.entries) ? mapping.entries.length : 0;
    items.push({ level: entries > 0 ? 'ok' : 'warn', title: '跨平台映射', message: `entries=${entries}` });
  }

  const dependencyEnabled = (env.get('DEPENDENCY_ARB_ENABLED') || '').toLowerCase() === 'true';
  if (dependencyEnabled) {
    const dependency = readJsonFile(dependencyPath);
    if (!dependency) {
      items.push({ level: 'warn', title: '依赖约束', message: '依赖套利已启用但 JSON 为空/错误' });
    } else {
      const groups = Array.isArray(dependency.groups) ? dependency.groups.length : 0;
      items.push({ level: groups > 0 ? 'ok' : 'warn', title: '依赖约束', message: `groups=${groups}` });
    }
  }

  const crossEnabled = (env.get('CROSS_PLATFORM_ENABLED') || '').toLowerCase() === 'true';
  if (crossEnabled) {
    const polyKey = env.get('POLYMARKET_API_KEY');
    const opKey = env.get('OPINION_API_KEY');
    if (!polyKey && !opKey) {
      items.push({
        level: 'warn',
        title: '跨平台密钥',
        message: '跨平台已启用但未检测到 Polymarket/Opinion API Key',
      });
    } else {
      items.push({ level: 'ok', title: '跨平台密钥', message: '已检测到至少一个平台密钥' });
    }
  }

  const wsPredict = (env.get('PREDICT_WS_ENABLED') || '').toLowerCase() === 'true';
  const wsPoly = (env.get('POLYMARKET_WS_ENABLED') || '').toLowerCase() === 'true';
  const wsOpinion = (env.get('OPINION_WS_ENABLED') || '').toLowerCase() === 'true';
  if (!wsPredict && !wsPoly && !wsOpinion) {
    items.push({ level: 'warn', title: 'WebSocket', message: 'WS 未开启，行情更新可能延迟' });
  } else {
    items.push({
      level: 'ok',
      title: 'WebSocket',
      message: `Predict=${wsPredict ? '开' : '关'} Polymarket=${wsPoly ? '开' : '关'} Opinion=${wsOpinion ? '开' : '关'}`,
    });
  }

  const metrics = readJsonFile(metricsPath);
  if (!metrics || !metrics.ts) {
    items.push({ level: 'warn', title: '指标文件', message: '指标文件缺失或无更新' });
  } else {
    const ageMs = Date.now() - Number(metrics.ts || 0);
    items.push({
      level: ageMs > 60000 ? 'warn' : 'ok',
      title: '指标文件',
      message: `最近更新 ${Math.round(ageMs / 1000)}s 前`,
    });
  }

  const state = readJsonFile(statePath);
  if (!state || !state.ts) {
    items.push({ level: 'warn', title: '状态文件', message: '状态文件缺失或未保存' });
  } else {
    items.push({ level: 'ok', title: '状态文件', message: '已存在' });
  }

  items.push({
    level: 'ok',
    title: '运行状态',
    message: `做市商=${processes.has('mm') ? '运行中' : '未运行'} / 套利=${processes.has('arb') ? '运行中' : '未运行'}`,
  });

  return { items };
}

function exportDiagnosticsBundle() {
  const timestamp = new Date();
  const stamp = timestamp
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .replace('Z', '');
  const outputDir = path.join(getUserDataRoot(), 'diagnostics', `diag_${stamp}`);
  fs.mkdirSync(outputDir, { recursive: true });

  const envPath = getEnvPath();
  const mappingPath = resolveMappingPath();
  const dependencyPath = resolveDependencyPath();
  const metricsPath = resolveMetricsPath();
  const statePath = resolveStatePath();

  const report = {
    version: 1,
    ts: Date.now(),
    envPath,
    mappingPath,
    dependencyPath,
    metricsPath,
    statePath,
    diagnostics: buildDiagnostics().items,
  };

  fs.writeFileSync(path.join(outputDir, 'diagnostics.json'), JSON.stringify(report, null, 2), 'utf8');

  const copies = [
    { src: envPath, name: 'env.txt' },
    { src: mappingPath, name: 'cross-platform-mapping.json' },
    { src: dependencyPath, name: 'dependency-constraints.json' },
    { src: metricsPath, name: 'cross-platform-metrics.json' },
    { src: statePath, name: 'cross-platform-state.json' },
  ];

  copies.forEach((file) => {
    if (fs.existsSync(file.src)) {
      fs.copyFileSync(file.src, path.join(outputDir, file.name));
    }
  });

  return outputDir;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 780,
    minWidth: 1100,
    minHeight: 680,
    backgroundColor: '#0f1222',
    title: 'Predict.fun 控制台',
    webPreferences: {
      preload: path.resolve(__dirname, 'preload.mjs'),
    },
  });

  mainWindow.loadFile(rendererPath);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('read-env', () => readEnvFile());
ipcMain.handle('write-env', (_, text) => {
  writeEnvFile(text);
  return { ok: true };
});
ipcMain.handle('read-mapping', () => readTextFile(resolveMappingPath(), '{\"entries\":[]}\n'));
ipcMain.handle('write-mapping', (_, text) => {
  writeTextFile(resolveMappingPath(), text);
  return { ok: true };
});
ipcMain.handle('read-dependency', () =>
  readTextFile(resolveDependencyPath(), '{\"conditions\":[],\"groups\":[],\"relations\":[]}\n')
);
ipcMain.handle('write-dependency', (_, text) => {
  writeTextFile(resolveDependencyPath(), text);
  return { ok: true };
});
ipcMain.handle('read-metrics', () => readTextFile(resolveMetricsPath(), '{\"version\":1,\"ts\":0,\"metrics\":{}}'));
ipcMain.handle('run-diagnostics', () => {
  try {
    const result = buildDiagnostics();
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, message: error?.message || String(error) };
  }
});
ipcMain.handle('export-diagnostics', () => {
  try {
    const outputDir = exportDiagnosticsBundle();
    return { ok: true, path: outputDir };
  } catch (error) {
    return { ok: false, message: error?.message || String(error) };
  }
});

ipcMain.handle('start-bot', (_, type) => spawnBot(type));
ipcMain.handle('stop-bot', (_, type) => stopBot(type));
ipcMain.handle('status', () => getStatus());
