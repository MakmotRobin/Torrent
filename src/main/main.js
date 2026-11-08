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
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
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

  return await createWindow();
}

/**
 * Performs graceful shutdown of torrent engine and resources.
 */
export async function cleanup() {
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

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', async () => {
    await cleanup();
  });
}

export default {
  createWindow,
  initApp,
  cleanup,
  setupEngineBroadcasting,
};
