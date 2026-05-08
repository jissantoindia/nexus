const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path    = require('path');
const https   = require('https');
const http    = require('http');
const fs      = require('fs');
const os      = require('os');
const isDev   = require('electron-is-dev');

// ── Icon ──────────────────────────────────────────────────────────────────────
const ICON_PATH = path.join(__dirname, 'icons/flash.png');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1024, minHeight: 640,
    icon: ICON_PATH, title: 'Nexus', backgroundColor: '#0f0f14', show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });

  const startURL = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../dist/index.html')}`;
  mainWindow.loadURL(startURL);
  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (process.platform === 'darwin') {
    const { nativeImage } = require('electron');
    app.dock.setIcon(nativeImage.createFromPath(path.join(__dirname, 'icons/flash.png')));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ─────────────────────────────────────────────────────────────────────────────
// IPC: CORS-free HTTP requests
// ─────────────────────────────────────────────────────────────────────────────
ipcMain.handle('nexus:send-request', async (_event, options) => {
  const axios    = require('axios');
  const FormData = require('form-data');
  const { method, url, headers = {}, bodyType, body } = options;

  try {
    const config = {
      method: method.toLowerCase(), url,
      headers: { ...headers },
      validateStatus: () => true,
      timeout: 30_000, responseType: 'arraybuffer', maxRedirects: 10,
    };

    const canHaveBody = !['get', 'head'].includes(method.toLowerCase());
    if (canHaveBody && bodyType && bodyType !== 'none') {
      if (bodyType === 'form-data') {
        const pairs = (() => { try { return JSON.parse(body || '[]'); } catch { return []; } })();
        const fd = new FormData();
        pairs.filter(p => p.enabled !== false && p.key).forEach(p => fd.append(p.key, p.value));
        config.data = fd;
        Object.assign(config.headers, fd.getHeaders());
      } else if (bodyType === 'urlencoded') {
        const pairs = (() => { try { return JSON.parse(body || '[]'); } catch { return []; } })();
        const usp = new URLSearchParams();
        pairs.filter(p => p.enabled !== false && p.key).forEach(p => usp.append(p.key, p.value));
        config.data = usp.toString();
        if (!config.headers['Content-Type'])
          config.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      } else if (body) {
        config.data = body;
        if (bodyType === 'json' && !config.headers['Content-Type'])
          config.headers['Content-Type'] = 'application/json';
        else if (bodyType === 'text' && !config.headers['Content-Type'])
          config.headers['Content-Type'] = 'text/plain';
      }
    }

    const start = Date.now();
    const res   = await axios(config);
    const time  = Date.now() - start;
    const buf   = Buffer.from(res.data);
    const rawText = buf.toString('utf-8');
    let data = rawText;
    try { data = JSON.parse(rawText); } catch { /* keep raw text */ }

    return { status: res.status, statusText: res.statusText, time, size: buf.length, data, headers: res.headers };
  } catch (err) {
    return { status: 0, statusText: 'Network Error', time: 0, size: 0, data: null, error: err.message };
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// IPC: Background Auto-Updater
// Downloads the update file silently, reports progress, then installs.
// ─────────────────────────────────────────────────────────────────────────────

let downloadedFilePath = null;

ipcMain.handle('nexus:start-update', async (_event, downloadUrl) => {
  if (!downloadUrl) return { error: 'No download URL provided' };

  try {
    // Resolve filename from URL
    const urlObj  = new URL(downloadUrl);
    const fileName = path.basename(urlObj.pathname) || `nexus-update-${process.platform}`;
    const destPath = path.join(os.tmpdir(), fileName);

    // ── Download with progress ─────────────────────────────────────────────
    await new Promise((resolve, reject) => {
      const protocol = urlObj.protocol === 'https:' ? https : http;

      function doRequest(url) {
        const parsedUrl = new URL(url);
        const opts = {
          hostname: parsedUrl.hostname,
          port:     parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
          path:     parsedUrl.pathname + parsedUrl.search,
          headers:  { 'User-Agent': 'Nexus-Desktop-Updater' },
        };

        const lib = parsedUrl.protocol === 'https:' ? https : http;
        lib.get(opts, (res) => {
          // Follow redirects
          if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
            return doRequest(res.headers.location);
          }
          if (res.statusCode !== 200) {
            return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
          }

          const total    = parseInt(res.headers['content-length'] || '0', 10);
          let downloaded = 0;
          const file     = fs.createWriteStream(destPath);

          res.on('data', (chunk) => {
            downloaded += chunk.length;
            const percent = total > 0 ? Math.round((downloaded / total) * 100) : -1;
            const mbDone  = (downloaded / 1024 / 1024).toFixed(1);
            const mbTotal = total > 0 ? (total / 1024 / 1024).toFixed(1) : '?';

            // Send progress to renderer
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('nexus:update-progress', {
                percent, transferred: mbDone, total: mbTotal,
              });
            }
          });

          res.pipe(file);
          file.on('finish', () => { file.close(); resolve(); });
          file.on('error', reject);
          res.on('error', reject);
        }).on('error', reject);
      }

      doRequest(downloadUrl);
    });

    downloadedFilePath = destPath;

    // Notify renderer download is complete
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('nexus:update-downloaded', { path: destPath });
    }

    return { success: true, path: destPath };
  } catch (err) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('nexus:update-error', { message: err.message });
    }
    return { error: err.message };
  }
});

ipcMain.handle('nexus:install-update', async () => {
  if (!downloadedFilePath || !fs.existsSync(downloadedFilePath)) {
    return { error: 'Update file not found' };
  }

  const filePath = downloadedFilePath;
  const platform = process.platform;

  try {
    if (platform === 'win32') {
      // Windows: run NSIS installer silently — /S = silent, /CURRENTUSER avoids UAC
      const { spawn } = require('child_process');
      spawn(filePath, ['/S', '/CURRENTUSER'], {
        detached: true, stdio: 'ignore',
      }).unref();
      setTimeout(() => app.quit(), 1500);

    } else if (platform === 'darwin') {
      // macOS: open the DMG — user drags to Applications (standard Mac UX)
      shell.openPath(filePath);

    } else {
      // Linux: make AppImage executable and launch it
      fs.chmodSync(filePath, '755');
      const { spawn } = require('child_process');
      spawn(filePath, [], { detached: true, stdio: 'ignore' }).unref();
      setTimeout(() => app.quit(), 1500);
    }

    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
});
