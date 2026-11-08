import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import EventEmitter from 'events';
import { Store } from '../src/main/store.js';
import { TorrentEngine } from '../src/main/torrentEngine.js';
import { registerIpcHandlers } from '../src/main/ipcHandlers.js';
import { setupEngineBroadcasting } from '../src/main/main.js';
import { createTorrentAPI } from '../src/preload/preload.mjs';

describe('End-to-End Application Pipeline & Desktop Packaging', () => {
  let tmpDir;
  let store;
  let engine;
  let handlers;
  let listeners;
  let ipcMain;
  let ipcRenderer;
  let mockDialog;
  let mockShell;
  let mockWindow;
  let api;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'torrent-e2e-'));
    store = new Store(tmpDir);

    handlers = new Map();
    listeners = new Map();

    ipcMain = {
      handle: vi.fn((channel, handler) => {
        handlers.set(channel, handler);
      }),
    };

    ipcRenderer = {
      invoke: async (channel, ...args) => {
        const handler = handlers.get(channel);
        if (!handler) {
          throw new Error(`Unhandled IPC channel in test: ${channel}`);
        }
        return await handler({}, ...args);
      },
      on: (channel, callback) => {
        if (!listeners.has(channel)) listeners.set(channel, []);
        listeners.get(channel).push(callback);
      },
      removeListener: (channel, callback) => {
        const list = listeners.get(channel) || [];
        listeners.set(
          channel,
          list.filter((cb) => cb !== callback)
        );
      },
      emit: (channel, ...args) => {
        const list = listeners.get(channel) || [];
        list.forEach((cb) => cb({}, ...args));
      },
    };

    mockDialog = {
      showOpenDialog: vi.fn().mockImplementation(async (opts) => {
        if (opts.properties?.includes('openFile')) {
          return { canceled: false, filePaths: [path.join(tmpDir, 'test.torrent')] };
        }
        if (opts.properties?.includes('openDirectory')) {
          return { canceled: false, filePaths: [path.join(tmpDir, 'custom-downloads')] };
        }
        return { canceled: true, filePaths: [] };
      }),
    };

    mockShell = {
      openPath: vi.fn().mockResolvedValue(''),
    };

    mockWindow = {
      isDestroyed: vi.fn().mockReturnValue(false),
      webContents: {
        send: vi.fn((channel, data) => {
          ipcRenderer.emit(channel, data);
        }),
      },
    };

    api = createTorrentAPI(ipcRenderer);
  });

  afterEach(async () => {
    if (engine) {
      await engine.destroy();
      engine = null;
    }
    if (tmpDir && fs.existsSync(tmpDir)) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (_) {}
    }
  });

  it('runs complete pipeline: settings -> add torrent -> pause/resume -> priority -> events -> removal', async () => {
    // 1. Initialize engine with store
    engine = new TorrentEngine(store, {
      dht: false,
      updateInterval: 50,
      autoLoad: false,
    });

    // 2. Wire IPC handlers and broadcasting
    registerIpcHandlers(ipcMain, engine, store, mockDialog, mockShell);
    setupEngineBroadcasting(engine, () => mockWindow);

    // 3. Settings flow via preload API
    const initialSettings = await api.getSettings();
    expect(initialSettings.maxActiveDownloads).toBe(5);

    const savedSettings = await api.saveSettings({
      maxActiveDownloads: 10,
      downloadPath: path.join(tmpDir, 'downloads'),
    });
    expect(savedSettings.maxActiveDownloads).toBe(10);
    expect(store.getSettings().maxActiveDownloads).toBe(10);

    // 4. File dialog flows via preload API
    const chosenFile = await api.selectTorrentFile();
    expect(chosenFile).toBe(path.join(tmpDir, 'test.torrent'));

    const chosenDir = await api.selectDownloadDirectory();
    expect(chosenDir).toBe(path.join(tmpDir, 'custom-downloads'));

    // 5. Setup event listener in frontend
    const receivedUpdates = [];
    const unsubscribe = api.onTorrentUpdate((torrents) => {
      receivedUpdates.push(torrents);
    });

    // 6. Add known public legal torrent magnet link (Ubuntu 24.04 ISO)
    const ubuntuMagnet =
      'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=ubuntu-24.04-desktop-amd64.iso&tr=https%3A%2F%2Ftorrent.ubuntu.com%2Fannounce';

    const summary = await api.addTorrent(ubuntuMagnet);
    expect(summary).toBeDefined();
    expect(summary.infoHash).toBe('08ada5a7a6183aae1e09d831df6748d566095a10');
    expect(summary.name).toBe('ubuntu-24.04-desktop-amd64.iso');
    expect(['metadata', 'downloading']).toContain(summary.status);
    expect(summary.paused).toBe(false);
    expect(summary.files).toBeInstanceOf(Array);
    expect(summary.trackers).toBeInstanceOf(Array);
    expect(summary.peers).toBeInstanceOf(Array);

    // Verify torrent persisted in store
    const persisted = store.getTorrents();
    expect(persisted).toHaveLength(1);
    expect(persisted[0].infoHash).toBe('08ada5a7a6183aae1e09d831df6748d566095a10');

    // 7. Pause torrent
    const pauseSuccess = await api.pauseTorrent(summary.infoHash);
    expect(pauseSuccess).toBe(true);

    const pausedSummary = engine.getTorrentSummary(summary.infoHash);
    expect(pausedSummary.status).toBe('paused');
    expect(pausedSummary.paused).toBe(true);

    // 8. Resume torrent
    const resumeSuccess = await api.resumeTorrent(summary.infoHash);
    expect(resumeSuccess).toBe(true);

    const resumedSummary = engine.getTorrentSummary(summary.infoHash);
    expect(resumedSummary.paused).toBe(false);

    // 9. Set file priority
    const prioritySuccess = await api.setFilePriority(summary.infoHash, 0, 0);
    expect(prioritySuccess).toBe(true);

    // 10. Open containing folder
    await api.openDownloadFolder(summary.infoHash);
    expect(mockShell.openPath).toHaveBeenCalled();

    // 11. Verify real-time updates were dispatched through webContents.send
    expect(mockWindow.webContents.send).toHaveBeenCalledWith('torrent:update', expect.any(Array));
    expect(receivedUpdates.length).toBeGreaterThan(0);
    const lastUpdate = receivedUpdates[receivedUpdates.length - 1];
    expect(lastUpdate.find((t) => t.infoHash === summary.infoHash)).toBeDefined();

    unsubscribe();

    // 12. Remove torrent
    const removeSuccess = await api.removeTorrent(summary.infoHash, false);
    expect(removeSuccess).toBe(true);
    expect(engine.getAllTorrentsSummary()).toHaveLength(0);
    expect(store.getTorrents()).toHaveLength(0);
  });

  it('verifies real WebTorrent client instance handles magnet link addition and cleanup', async () => {
    // Tests real WebTorrent lifecycle with legal torrent
    engine = new TorrentEngine(store, {
      dht: false,
      updateInterval: 0,
      autoLoad: false,
    });

    const debianMagnet =
      'magnet:?xt=urn:btih:c12fe1c06bba254a9dc9f519b335380dc1f74c26&dn=debian-12.0.0-amd64-netinst.iso';

    const summary = await engine.addTorrent(debianMagnet);

    expect(summary.infoHash).toBe('c12fe1c06bba254a9dc9f519b335380dc1f74c26');
    expect(summary.name).toBe('debian-12.0.0-amd64-netinst.iso');
    expect(['metadata', 'downloading']).toContain(summary.status);

    // Engine global stats reflect the new torrent
    const stats = engine.getGlobalStats();
    expect(stats.totalTorrents).toBe(1);
    expect(stats.downloadSpeed).toBe(0);
    expect(stats.uploadSpeed).toBe(0);

    // Clean destruction
    await engine.destroy();
    engine = null;
  });

  it('verifies production loadFile fallback path exists in main.js', () => {
    const distPath = path.join(__dirname, '../dist/index.html');
    // Ensure dist/index.html was generated by build
    expect(fs.existsSync(distPath)).toBe(true);

    const htmlContent = fs.readFileSync(distPath, 'utf-8');
    expect(htmlContent).toContain('<div id="root"></div>');
    expect(htmlContent).toContain('src="./assets/');
  });
});
