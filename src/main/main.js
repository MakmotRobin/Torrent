import electron from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { Store } from './store.js';
import { TorrentEngine } from './torrentEngine.js';
import { registerIpcHandlers } from './ipcHandlers.js';

const { app, BrowserWindow, ipcMain, dialog, shell } = electron || {};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let store = null;
let engine = null;
let downloadsWatcher = null;

/**
 * Handles an incoming command line argument or URL (magnet link, .torrent file, or HTTP URL).
 *
 * @param {string} arg
 * @param {object} engineInstance
 * @returns {Promise<boolean>}
 */
export async function handleIncomingArg(arg, engineInstance) {
  if (!arg || typeof arg !== 'string') return false;
  const trimmed = arg.trim();
  const isMagnet = trimmed.toLowerCase().startsWith('magnet:?');
  const isTorrentFile = trimmed.toLowerCase().endsWith('.torrent') && fs.existsSync(trimmed);
  const isHex = /^[a-fA-F0-9]{40}$/.test(trimmed);
  const isBase32 = /^[a-zA-Z2-7]{32}$/.test(trimmed);
  const isHttpUrl = /^https?:\/\/.+/i.test(trimmed);

  if (isMagnet || isTorrentFile || isHex || isBase32 || isHttpUrl) {
    try {
      if (engineInstance && typeof engineInstance.addTorrent === 'function') {
        await engineInstance.addTorrent(trimmed);
        return true;
      }
    } catch (err) {
      console.warn('Failed to auto-add torrent argument:', err.message);
    }
  }
  return false;
}

/**
 * Starts watching the user's Downloads folder for newly downloaded .torrent files,
 * automatically loading and starting them.
 *
 * @param {object} engineInstance
 * @param {string} [folderPath]
 * @returns {fs.FSWatcher|null}
 */
export function setupDownloadsFolderWatcher(engineInstance, folderPath) {
  const watchDir = folderPath || path.join(process.env.USERPROFILE || process.env.HOME || '', 'Downloads');
  if (!watchDir || !fs.existsSync(watchDir)) return null;

  try {
    const watcher = fs.watch(watchDir, (eventType, filename) => {
      if (filename && filename.toLowerCase().endsWith('.torrent')) {
        const fullPath = path.join(watchDir, filename);
        setTimeout(async () => {
          if (fs.existsSync(fullPath)) {
            try {
              if (engineInstance && typeof engineInstance.addTorrent === 'function') {
                await engineInstance.addTorrent(fullPath);
                console.log('Auto-started torrent from Downloads folder:', filename);
              }
            } catch (err) {
              console.warn('Failed to auto-start torrent from Downloads:', err.message);
            }
          }
        }, 800);
      }
    });
    return watcher;
  } catch (err) {
    console.warn('Could not watch Downloads folder:', err.message);
    return null;
  }
}

/**
 * Creates and configures the main desktop BrowserWindow.
 *
 * @returns {Promise<object>} mainWindow
 */
export async function createWindow() {
  const iconPath = process.platform === 'win32'
    ? path.join(__dirname, '../../assets/icon.ico')
    : path.join(__dirname, '../../assets/icon.png');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#18181b', // zinc-900 dark theme
    title: 'Torrent Desktop',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.webContents.once('did-finish-load', () => {
    if (engine && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('torrent:update', engine.getAllTorrentsSummary());
      mainWindow.webContents.send('stats:update', engine.getGlobalStats());
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  const distPath = path.join(__dirname, '../../dist/index.html');

  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
  } else if (fs.existsSync(distPath)) {
    await mainWindow.loadFile(distPath);
  } else {
    // Default fallback to Vite dev server port
    await mainWindow.loadURL('http://localhost:5173');
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

/**
 * Connects TorrentEngine real-time event updates to the renderer window via webContents.
 *
 * @param {object} engineInstance
 * @param {Function} getWindow
 */
export function setupEngineBroadcasting(engineInstance, getWindow) {
  if (!engineInstance || typeof engineInstance.on !== 'function') return;

  engineInstance.on('torrent:update', (torrents) => {
    const win = getWindow();
    if (win && !win.isDestroyed() && win.webContents) {
      win.webContents.send('torrent:update', torrents);
    }
  });

  engineInstance.on('stats:update', (stats) => {
    const win = getWindow();
    if (win && !win.isDestroyed() && win.webContents) {
      win.webContents.send('stats:update', stats);
    }
  });
}

/**
 * Initializes store, torrent engine, IPC handlers, and launches window.
 */
export async function initApp() {
  store = new Store();
  engine = new TorrentEngine(store);

  if (ipcMain) {
    registerIpcHandlers(ipcMain, engine, store, dialog, shell);
  }

  setupEngineBroadcasting(engine, () => mainWindow);

  // Set as default protocol client for magnet links in Windows
  if (app && typeof app.setAsDefaultProtocolClient === 'function') {
    try {
      if (process.defaultApp && process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('magnet', process.execPath, [path.resolve(process.argv[1])]);
      } else {
        app.setAsDefaultProtocolClient('magnet');
      }
    } catch (_) {}
  }

  // Handle single instance lock and incoming second-instance links
  if (app && typeof app.requestSingleInstanceLock === 'function') {
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
      if (typeof app.exit === 'function') {
        app.exit(0);
      } else {
        app.quit();
      }
      return null;
    }

    app.on('second-instance', async (event, commandLine) => {
      if (!mainWindow || mainWindow.isDestroyed()) {
        mainWindow = await createWindow();
      } else {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
      if (Array.isArray(commandLine)) {
        for (const arg of commandLine) {
          handleIncomingArg(arg, engine);
        }
      }
    });
  }

  // Process initial command line arguments (e.g. clicked magnet link or .torrent file)
  if (Array.isArray(process.argv)) {
    for (const arg of process.argv.slice(1)) {
      handleIncomingArg(arg, engine);
    }
  }

  // Start watching user's Downloads folder for newly saved .torrent files
  downloadsWatcher = setupDownloadsFolderWatcher(engine);

  return await createWindow();
}

/**
 * Performs graceful shutdown of torrent engine and resources.
 */
export async function cleanup() {
  if (downloadsWatcher) {
    try {
      downloadsWatcher.close();
    } catch (_) {}
    downloadsWatcher = null;
  }
  if (engine) {
    await engine.destroy();
    engine = null;
  }
}

// App lifecycle hooks when running in Electron runtime
if (app && typeof app.whenReady === 'function') {
  app.whenReady().then(async () => {
    await initApp();

    app.on('activate', async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        await createWindow();
      }
    });
  });

  let isQuitting = false;
  const handleExit = async () => {
    if (isQuitting) return;
    isQuitting = true;
    try {
      await cleanup();
    } catch (_) {}
    if (app && typeof app.exit === 'function') {
      app.exit(0);
    }
  };

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      handleExit();
    }
  });

  app.on('before-quit', () => {
    handleExit();
  });
}

export default {
  createWindow,
  initApp,
  cleanup,
  setupEngineBroadcasting,
  handleIncomingArg,
  setupDownloadsFolderWatcher,
};
