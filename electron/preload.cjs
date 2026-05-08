/**
 * preload.cjs — sandboxed bridge between Electron main process and React renderer.
 * Exposes only explicitly whitelisted APIs via contextBridge.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /** True when running inside Electron (not a browser tab) */
  isElectron: true,

  /** CORS-free HTTP requests via Node.js */
  sendRequest: (options) => ipcRenderer.invoke('nexus:send-request', options),

  // ── Auto-updater ────────────────────────────────────────────────────────
  /** Start background download of the update file at `url` */
  startUpdate: (url) => ipcRenderer.invoke('nexus:start-update', url),

  /** Run the downloaded installer and quit the app */
  installUpdate: () => ipcRenderer.invoke('nexus:install-update'),

  /** Listen for download progress: { percent, transferred, total } */
  onUpdateProgress: (cb) => {
    ipcRenderer.on('nexus:update-progress', (_e, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('nexus:update-progress');
  },

  /** Called when the file has fully downloaded */
  onUpdateDownloaded: (cb) => {
    ipcRenderer.on('nexus:update-downloaded', (_e, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('nexus:update-downloaded');
  },

  /** Called if the download fails */
  onUpdateError: (cb) => {
    ipcRenderer.on('nexus:update-error', (_e, data) => cb(data));
    return () => ipcRenderer.removeAllListeners('nexus:update-error');
  },
});
