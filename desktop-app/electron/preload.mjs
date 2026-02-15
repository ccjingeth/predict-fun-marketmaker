import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('predictBot', {
  readEnv: () => ipcRenderer.invoke('read-env'),
  writeEnv: (text) => ipcRenderer.invoke('write-env', text),
  readMapping: () => ipcRenderer.invoke('read-mapping'),
  writeMapping: (text) => ipcRenderer.invoke('write-mapping', text),
  readDependency: () => ipcRenderer.invoke('read-dependency'),
  writeDependency: (text) => ipcRenderer.invoke('write-dependency', text),
  readMetrics: () => ipcRenderer.invoke('read-metrics'),
  readMmMetrics: () => ipcRenderer.invoke('read-mm-metrics'),
  readPlatformMarkets: (platform) => ipcRenderer.invoke('read-platform-markets', platform),
  triggerRescan: () => ipcRenderer.invoke('trigger-rescan'),
  runDiagnostics: () => ipcRenderer.invoke('run-diagnostics'),
  exportDiagnostics: () => ipcRenderer.invoke('export-diagnostics'),
  startBot: (type) => ipcRenderer.invoke('start-bot', type),
  stopBot: (type) => ipcRenderer.invoke('stop-bot', type),
  getStatus: () => ipcRenderer.invoke('status'),
  onLog: (callback) => ipcRenderer.on('bot-log', (_, payload) => callback(payload)),
  onStatus: (callback) => ipcRenderer.on('bot-status', (_, payload) => callback(payload)),
});
