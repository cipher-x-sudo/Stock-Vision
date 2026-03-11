const { app, BrowserWindow, ipcMain, dialog, shell, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

let autoUpdater = null;
try {
  autoUpdater = require('electron-updater').autoUpdater;
} catch (_) {
  // electron-updater optional; app runs without auto-update
}

// Suppress Chromium SSL/network error logging (e.g. handshake failed)
app.commandLine.appendSwitch('log-level', '3');

let mainWindow = null;

// Set GITHUB_UPDATE_TOKEN env var if the repo is private. Use a classic token (ghp_xxx) with minimal scope.
const GITHUB_UPDATE_TOKEN = process.env.GITHUB_UPDATE_TOKEN || '';
const GITHUB_UPDATE_OWNER = 'cipher-x-sudo';
const GITHUB_UPDATE_REPO = 'veo4k';

function sendToRenderer(channel, ...args) {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    mainWindow.webContents.send(channel, ...args);
  }
}

const PORT = process.env.PORT || 8765;
const API_URL = `http://127.0.0.1:${PORT}`;
const ROOT = path.join(__dirname, '..');
let backendProcess = null;

function spawnBackend() {
  let nodePath;
  let backendEntry;
  let cwd;
  const env = { ...process.env, PORT: String(PORT) };

  if (app.isPackaged) {
    const resourcesPath = process.resourcesPath;
    nodePath = path.join(resourcesPath, 'node', 'node.exe');
    backendEntry = path.join(resourcesPath, 'backend', 'index.js');
    cwd = path.join(resourcesPath, 'backend');
    env.APP_ROOT = cwd;
    env.USER_DATA = app.getPath('userData');
    env.PLAYWRIGHT_BROWSERS_PATH = path.join(resourcesPath, 'playwright-browsers');
  } else {
    nodePath = process.platform === 'win32' ? 'node' : 'node';
    backendEntry = path.join(ROOT, 'backend', 'index.js');
    cwd = path.join(ROOT, 'backend');
  }

  const args = app.isPackaged ? [backendEntry] : [path.join(ROOT, 'backend', 'index.js')];
  const proc = spawn(nodePath, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
  });
  proc.stdout.on('data', (d) => process.stdout.write(d.toString()));
  proc.stderr.on('data', (d) => process.stderr.write(d.toString()));
  proc.on('error', (e) => console.error('Backend spawn error:', e));
  proc.on('exit', (code, sig) => {
    if (code != null && code !== 0) console.error('Backend exit', code, sig);
  });
  return proc;
}

function waitForServer(maxMs = 60000) {
  const start = Date.now();
  const url = new URL('/api/health', API_URL);
  return new Promise((resolve, reject) => {
    function check() {
      const req = http.get(url, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 400) return resolve();
        retry();
      });
      req.on('error', retry);
      function retry() {
        req.destroy();
        if (Date.now() - start > maxMs) reject(new Error('Server startup timeout'));
        else setTimeout(check, 500);
      }
    }
    check();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    resizable: true,
    title: 'Nexus Studio',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.on('closed', () => { mainWindow = null; });
}

ipcMain.handle('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Download Folder'
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('open-path', async (_, pathStr) => {
  if (!pathStr || typeof pathStr !== 'string') return '';
  return shell.openPath(pathStr.trim());
});

ipcMain.handle('show-notification', (_, opts) => {
  const title = opts?.title ?? 'Notification';
  const body = opts?.body ?? '';
  try {
    const n = new Notification({ title, body });
    n.show();
  } catch (e) {
    console.error('[notification]', e?.message || e);
  }
});

// Divide image files in a folder into random batch subfolders (batch_1, batch_2, ...)
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.ico', '.tiff', '.tif']);
ipcMain.handle('divide-videos-into-batches', async (_, payload) => {
  const folderPath = payload?.folderPath;
  const assetsPerFolder = payload?.assetsPerFolder;
  if (!folderPath || typeof folderPath !== 'string' || !folderPath.trim()) {
    return { success: false, error: 'Please select a folder.' };
  }
  const perFolder = typeof assetsPerFolder === 'number' ? Math.floor(assetsPerFolder) : parseInt(assetsPerFolder, 10);
  if (!Number.isFinite(perFolder) || perFolder < 1) {
    return { success: false, error: 'Assets per folder must be at least 1.' };
  }
  const dir = folderPath.trim();
  try {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      return { success: false, error: 'Folder does not exist or is not a directory.' };
    }
    const names = fs.readdirSync(dir);
    const imageFiles = names.filter((name) => {
      const ext = path.extname(name).toLowerCase();
      if (!IMAGE_EXTENSIONS.has(ext)) return false;
      const full = path.join(dir, name);
      try {
        return fs.statSync(full).isFile();
      } catch {
        return false;
      }
    });
    if (imageFiles.length === 0) {
      return { success: false, error: 'No image files found in the selected folder (jpg, png, gif, webp, etc.).' };
    }
    // Fisher–Yates shuffle
    for (let i = imageFiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [imageFiles[i], imageFiles[j]] = [imageFiles[j], imageFiles[i]];
    }
    const numBatches = Math.ceil(imageFiles.length / perFolder);
    for (let i = 0; i < numBatches; i++) {
      const batchDir = path.join(dir, `batch_${i + 1}`);
      fs.mkdirSync(batchDir, { recursive: true });
    }
    let moved = 0;
    for (let i = 0; i < imageFiles.length; i++) {
      const batchIndex = Math.floor(i / perFolder);
      const batchDir = path.join(dir, `batch_${batchIndex + 1}`);
      const src = path.join(dir, imageFiles[i]);
      const dest = path.join(batchDir, imageFiles[i]);
      fs.renameSync(src, dest);
      moved++;
    }
    return { success: true, batchesCreated: numBatches, filesMoved: moved };
  } catch (e) {
    const msg = e?.message || String(e);
    return { success: false, error: msg };
  }
});

// --- Auto-updater (packaged app only) --
function updaterLog(msg, data) {
  const payload = data !== undefined ? ` ${JSON.stringify(data)}` : '';
  console.log(`[updater] ${msg}${payload}`);
}

function setupAutoUpdater() {
  if (!autoUpdater) {
    updaterLog('skipped (electron-updater not installed)');
    return;
  }
  if (!app.isPackaged) {
    updaterLog('skipped (not packaged)');
    return;
  }
  updaterLog('setup', { version: app.getVersion(), autoDownload: true });
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // Private repo: pass token so electron-updater uses PrivateGitHubProvider (GitHub API). Classic token (ghp_xxx) required.
  if (GITHUB_UPDATE_TOKEN) {
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: GITHUB_UPDATE_OWNER,
      repo: GITHUB_UPDATE_REPO,
      private: true,
      token: GITHUB_UPDATE_TOKEN,
    });
    updaterLog('feed set (private repo)', { owner: GITHUB_UPDATE_OWNER, repo: GITHUB_UPDATE_REPO });
  } else {
    updaterLog('using default feed from package.json (public repo)');
  }

  autoUpdater.on('checking-for-update', () => {
    updaterLog('checking-for-update');
    sendToRenderer('update-checking');
  });
  autoUpdater.on('update-available', (info) => {
    updaterLog('update-available', { version: info?.version, releaseDate: info?.releaseDate });
    sendToRenderer('update-available', info);
  });
  autoUpdater.on('update-not-available', (info) => {
    updaterLog('update-not-available', info ? { version: info.version } : {});
    sendToRenderer('update-not-available', info);
  });
  autoUpdater.on('download-progress', (progress) => {
    updaterLog('download-progress', { percent: Math.round(progress.percent), bytesPerSecond: progress.bytesPerSecond });
    sendToRenderer('update-download-progress', progress);
  });
  autoUpdater.on('update-downloaded', (info) => {
    updaterLog('update-downloaded', { version: info?.version });
    sendToRenderer('update-downloaded', info);
  });
  autoUpdater.on('error', (err) => {
    updaterLog('error', { message: err?.message || String(err), stack: err?.stack });
    sendToRenderer('update-error', err.message || String(err));
  });

  updaterLog('scheduling initial check in 5s');
  setTimeout(() => {
    updaterLog('running initial checkForUpdates()');
    autoUpdater.checkForUpdates().catch((e) => updaterLog('initial check failed', { error: e?.message || String(e) }));
  }, 5000);
}

ipcMain.handle('check-for-updates', async () => {
  updaterLog('IPC check-for-updates called');
  if (!autoUpdater || !app.isPackaged) {
    updaterLog('check-for-updates rejected: not packaged or no updater');
    return { ok: false, reason: 'not-packaged' };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    updaterLog('check-for-updates result', { ok: true, updateInfo: result?.updateInfo ?? null });
    return { ok: true, updateInfo: result?.updateInfo ?? null };
  } catch (e) {
    updaterLog('check-for-updates failed', { reason: e?.message || String(e) });
    return { ok: false, reason: e?.message || String(e) };
  }
});

ipcMain.handle('restart-to-install', () => {
  if (!autoUpdater || !app.isPackaged) return;
  updaterLog('IPC restart-to-install called', { ready: autoUpdater.isQuitAndInstallAllowed?.() ?? 'n/a' });
  try {
    autoUpdater.quitAndInstall(false, true);
  } catch (e) {
    updaterLog('quitAndInstall error', { error: e?.message || String(e) });
  }
});

ipcMain.handle('is-update-ready', () => autoUpdater && app.isPackaged && autoUpdater.isQuitAndInstallAllowed());

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();
  mainWindow.loadFile(path.join(__dirname, 'loading.html'));
  backendProcess = spawnBackend();

  waitForServer()
    .then(() => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadURL(API_URL);
    })
    .catch((e) => {
      console.error(e);
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadURL(API_URL);
    });

  app.on('window-all-closed', () => {
    if (backendProcess) {
      backendProcess.kill();
      backendProcess = null;
    }
    app.quit();
  });
});

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
});
