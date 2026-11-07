import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import EventEmitter from 'events';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { TorrentEngine } from '../src/main/torrentEngine.js';
import { createTorrentAPI } from '../src/preload/preload.js';

describe('TorrentEngine', () => {
  let engine;
  let mockStore;
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-test-'));
    mockStore = {
      getSettings: vi.fn().mockReturnValue({
        downloadPath: tmpDir,
        maxActiveDownloads: 5,
        maxActiveUploads: 5,
        downloadSpeedLimit: 0,
        uploadSpeedLimit: 0,
        port: 6881,
        dht: false,
      }),
      saveSettings: vi.fn(),
      getTorrents: vi.fn().mockReturnValue([]),
      saveTorrents: vi.fn(),
    };
    engine = new TorrentEngine(mockStore, { dht: false, updateInterval: 0, autoLoad: false });
  });

  afterEach(async () => {
    if (engine) {
      await engine.destroy();
    }
    if (tmpDir && fs.existsSync(tmpDir)) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (_) {}
    }
  });

  it('initializes with empty torrent list', () => {
    const summary = engine.getAllTorrentsSummary();
    expect(summary).toEqual([]);
  });

  it('calculates global stats accurately when empty', () => {
    const stats = engine.getGlobalStats();
    expect(stats.downloadSpeed).toBe(0);
    expect(stats.uploadSpeed).toBe(0);
    expect(stats.activeCount).toBe(0);
    expect(stats.totalTorrents).toBe(0);
    expect(stats.ratio).toBe(0);
  });

  it('adds a mock torrent and calculates summary and stats correctly', async () => {
    const mockFile = {
      name: 'ubuntu.iso',
      path: 'ubuntu.iso',
      length: 1000000,
      downloaded: 500000,
      progress: 0.5,
      select: vi.fn(),
      deselect: vi.fn(),
    };

    const mockTorrent = Object.assign(new EventEmitter(), {
      infoHash: '08ada5a7a6183aae1e09d831df6748d566095a10',
      name: 'Ubuntu 24.04',
      length: 1000000,
      downloaded: 500000,
      uploaded: 100000,
      downloadSpeed: 50000,
      uploadSpeed: 10000,
      progress: 0.5,
      ratio: 0.2,
      ready: true,
      done: false,
      numPeers: 12,
      timeRemaining: 10000,
      files: [mockFile],
      wires: [{
        remoteAddress: '192.168.1.10',
        remotePort: 51413,
        clientName: 'Transmission 4.0',
        downloadSpeed: () => 25000,
        uploadSpeed: () => 5000,
      }],
      announce: ['udp://tracker.opentrackr.org:1337/announce'],
      pause: vi.fn(),
      resume: vi.fn(),
    });

    const mockClient = {
      add: vi.fn().mockReturnValue(mockTorrent),
      remove: vi.fn((_t, _opts, cb) => cb && cb()),
      destroy: vi.fn((cb) => cb && cb()),
      on: vi.fn(),
      torrents: [mockTorrent],
    };

    const customEngine = new TorrentEngine(mockStore, {
      client: mockClient,
      updateInterval: 0,
      autoLoad: false,
    });

    const magnet = 'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Ubuntu+24.04';
    const summary = await customEngine.addTorrent(magnet);

    expect(mockClient.add).toHaveBeenCalled();
    expect(summary.infoHash).toBe('08ada5a7a6183aae1e09d831df6748d566095a10');
    expect(summary.name).toBe('Ubuntu 24.04');
    expect(summary.progress).toBe(0.5);
    expect(summary.status).toBe('downloading');
    expect(summary.timeRemaining).toBe(10); // 10000ms / 1000 = 10s
    expect(summary.files).toHaveLength(1);
    expect(summary.peers).toHaveLength(1);
    expect(summary.peers[0].addr).toBe('192.168.1.10:51413');

    const stats = customEngine.getGlobalStats();
    expect(stats.activeCount).toBe(1);
    expect(stats.downloadSpeed).toBe(50000);
    expect(stats.uploadSpeed).toBe(10000);
    expect(stats.totalTorrents).toBe(1);

    await customEngine.destroy();
  });

  it('prevents adding duplicate torrents and returns existing summary', async () => {
    const mockTorrent = Object.assign(new EventEmitter(), {
      infoHash: '08ada5a7a6183aae1e09d831df6748d566095a10',
      name: 'Ubuntu 24.04',
      ready: true,
      files: [],
      wires: [],
    });

    const mockClient = {
      add: vi.fn().mockReturnValue(mockTorrent),
      remove: vi.fn((_t, _opts, cb) => cb && cb()),
      destroy: vi.fn((cb) => cb && cb()),
      on: vi.fn(),
      torrents: [mockTorrent],
    };

    const customEngine = new TorrentEngine(mockStore, {
      client: mockClient,
      updateInterval: 0,
      autoLoad: false,
    });

    const magnet = 'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Ubuntu+24.04';
    await customEngine.addTorrent(magnet);
    expect(mockClient.add).toHaveBeenCalledTimes(1);

    // Adding the exact same magnet again
    const secondSummary = await customEngine.addTorrent(magnet);
    expect(mockClient.add).toHaveBeenCalledTimes(1); // did not re-add
    expect(secondSummary.infoHash).toBe('08ada5a7a6183aae1e09d831df6748d566095a10');

    await customEngine.destroy();
  });

  it('handles pause and resume operations cleanly', async () => {
    const mockTorrent = Object.assign(new EventEmitter(), {
      infoHash: '1111111111111111111111111111111111111111',
      name: 'Test Torrent',
      ready: true,
      files: [],
      wires: [],
      pause: vi.fn(),
      resume: vi.fn(),
    });

    const mockClient = {
      add: vi.fn().mockReturnValue(mockTorrent),
      remove: vi.fn((_t, _opts, cb) => cb && cb()),
      destroy: vi.fn((cb) => cb && cb()),
      on: vi.fn(),
      torrents: [mockTorrent],
    };

    const customEngine = new TorrentEngine(mockStore, {
      client: mockClient,
      updateInterval: 0,
      autoLoad: false,
    });

    await customEngine.addTorrent('1111111111111111111111111111111111111111');

    // Pause
    const pausedResult = customEngine.pauseTorrent('1111111111111111111111111111111111111111');
    expect(pausedResult).toBe(true);
    expect(mockTorrent.pause).toHaveBeenCalled();

    let summary = customEngine.getTorrentSummary('1111111111111111111111111111111111111111');
    expect(summary.paused).toBe(true);
    expect(summary.status).toBe('paused');

    // Resume
    const resumeResult = customEngine.resumeTorrent('1111111111111111111111111111111111111111');
    expect(resumeResult).toBe(true);
    expect(mockTorrent.resume).toHaveBeenCalled();

    summary = customEngine.getTorrentSummary('1111111111111111111111111111111111111111');
    expect(summary.paused).toBe(false);

    await customEngine.destroy();
  });

  it('sets file priorities and deselects files', async () => {
    const mockFiles = [
      { name: 'file1.mp4', select: vi.fn(), deselect: vi.fn() },
      { name: 'file2.txt', select: vi.fn(), deselect: vi.fn() },
    ];

    const mockTorrent = Object.assign(new EventEmitter(), {
      infoHash: '2222222222222222222222222222222222222222',
      name: 'Multi-file Torrent',
      ready: true,
      files: mockFiles,
      wires: [],
    });

    const mockClient = {
      add: vi.fn().mockReturnValue(mockTorrent),
      remove: vi.fn((_t, _opts, cb) => cb && cb()),
      destroy: vi.fn((cb) => cb && cb()),
      on: vi.fn(),
      torrents: [mockTorrent],
    };

    const customEngine = new TorrentEngine(mockStore, {
      client: mockClient,
      updateInterval: 0,
      autoLoad: false,
    });

    await customEngine.addTorrent('2222222222222222222222222222222222222222');

    // Deselect file2
    const priorityResult = customEngine.setFilePriority('2222222222222222222222222222222222222222', 1, 'dont_download');
    expect(priorityResult).toBe(true);
    expect(mockFiles[1].deselect).toHaveBeenCalled();

    const summary = customEngine.getTorrentSummary('2222222222222222222222222222222222222222');
    expect(summary.files[1].selected).toBe(false);
    expect(summary.files[1].priority).toBe('dont_download');

    // Re-select file2
    customEngine.setFilePriority('2222222222222222222222222222222222222222', 1, 'normal');
    expect(mockFiles[1].select).toHaveBeenCalled();

    await customEngine.destroy();
  });

  it('removes torrent with and without deleting payload files', async () => {
    const torrentFolder = path.join(tmpDir, 'downloaded_folder');
    fs.mkdirSync(torrentFolder, { recursive: true });
    fs.writeFileSync(path.join(torrentFolder, 'payload.bin'), 'some data');

    const mockTorrent = Object.assign(new EventEmitter(), {
      infoHash: '3333333333333333333333333333333333333333',
      name: 'downloaded_folder',
      path: tmpDir,
      ready: true,
      files: [],
      wires: [],
    });

    const mockClient = {
      add: vi.fn().mockReturnValue(mockTorrent),
      remove: vi.fn((_t, opts, cb) => cb && cb()),
      destroy: vi.fn((cb) => cb && cb()),
      on: vi.fn(),
      torrents: [mockTorrent],
    };

    const customEngine = new TorrentEngine(mockStore, {
      client: mockClient,
      updateInterval: 0,
      autoLoad: false,
    });

    await customEngine.addTorrent('3333333333333333333333333333333333333333', { path: tmpDir, name: 'downloaded_folder' });

    // Removing with deleteFiles: true
    expect(fs.existsSync(torrentFolder)).toBe(true);
    const removed = await customEngine.removeTorrent('3333333333333333333333333333333333333333', true);
    expect(removed).toBe(true);
    expect(mockClient.remove).toHaveBeenCalled();
    expect(fs.existsSync(torrentFolder)).toBe(false); // Payload folder was unlinked

    expect(customEngine.getTorrentSummary('3333333333333333333333333333333333333333')).toBeNull();

    await customEngine.destroy();
  });

  it('restores persisted torrents on startup', async () => {
    mockStore.getTorrents.mockReturnValue([
      {
        infoHash: '4444444444444444444444444444444444444444',
        name: 'Restored Torrent',
        source: '4444444444444444444444444444444444444444',
        path: tmpDir,
        paused: true,
      },
    ]);

    const mockTorrent = Object.assign(new EventEmitter(), {
      infoHash: '4444444444444444444444444444444444444444',
      name: 'Restored Torrent',
      ready: true,
      files: [],
      wires: [],
      pause: vi.fn(),
    });

    const mockClient = {
      add: vi.fn().mockReturnValue(mockTorrent),
      remove: vi.fn((_t, _opts, cb) => cb && cb()),
      destroy: vi.fn((cb) => cb && cb()),
      on: vi.fn(),
      torrents: [mockTorrent],
    };

    const autoEngine = new TorrentEngine(mockStore, {
      client: mockClient,
      autoLoad: true,
      updateInterval: 0,
    });

    // Wait a tick for autoLoad
    await new Promise((r) => setTimeout(r, 50));

    expect(mockClient.add).toHaveBeenCalled();
    const summary = autoEngine.getTorrentSummary('4444444444444444444444444444444444444444');
    expect(summary).toBeDefined();
    expect(summary.name).toBe('Restored Torrent');
    expect(summary.paused).toBe(true);

    await autoEngine.destroy();
  });

  it('exposes typed IPC channels in preload torrentAPI', async () => {
    const mockIpc = {
      invoke: vi.fn().mockResolvedValue('ok'),
      on: vi.fn(),
      removeListener: vi.fn(),
    };

    const api = createTorrentAPI(mockIpc);

    await api.addTorrent('magnet:?xt=urn:btih:08ada5a7', { path: '/downloads' });
    expect(mockIpc.invoke).toHaveBeenCalledWith('torrent:add', 'magnet:?xt=urn:btih:08ada5a7', { path: '/downloads' });

    await api.pauseTorrent('hash1');
    expect(mockIpc.invoke).toHaveBeenCalledWith('torrent:pause', 'hash1');

    await api.resumeTorrent('hash1');
    expect(mockIpc.invoke).toHaveBeenCalledWith('torrent:resume', 'hash1');

    await api.removeTorrent('hash1', true);
    expect(mockIpc.invoke).toHaveBeenCalledWith('torrent:remove', 'hash1', true);

    await api.setFilePriority('hash1', 2, 'dont_download');
    expect(mockIpc.invoke).toHaveBeenCalledWith('torrent:setFilePriority', 'hash1', 2, 'dont_download');

    await api.getSettings();
    expect(mockIpc.invoke).toHaveBeenCalledWith('settings:get');

    await api.saveSettings({ maxActiveDownloads: 10 });
    expect(mockIpc.invoke).toHaveBeenCalledWith('settings:save', { maxActiveDownloads: 10 });

    await api.openDownloadFolder('hash1');
    expect(mockIpc.invoke).toHaveBeenCalledWith('shell:openDownloadFolder', 'hash1');

    // Subscriptions
    const callback = vi.fn();
    const unsubscribe = api.onTorrentUpdate(callback);
    expect(mockIpc.on).toHaveBeenCalledWith('torrent:update', expect.any(Function));

    unsubscribe();
    expect(mockIpc.removeListener).toHaveBeenCalledWith('torrent:update', expect.any(Function));
  });
});
