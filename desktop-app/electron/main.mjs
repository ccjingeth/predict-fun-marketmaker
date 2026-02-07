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

ipcMain.handle('start-bot', (_, type) => spawnBot(type));
ipcMain.handle('stop-bot', (_, type) => stopBot(type));
ipcMain.handle('status', () => getStatus());
