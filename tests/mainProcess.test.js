import { describe, it, expect, vi, beforeEach } from 'vitest';
import EventEmitter from 'events';
import { registerIpcHandlers } from '../src/main/ipcHandlers.js';
import { setupEngineBroadcasting, cleanup, handleIncomingArg, setupDownloadsFolderWatcher } from '../src/main/main.js';

describe('IPC Handlers', () => {
  let ipcMain;
  let mockEngine;
  let mockStore;
  let mockDialog;
  let mockShell;
  let handlers;

  beforeEach(() => {
    handlers = new Map();
    ipcMain = {
      handle: vi.fn((channel, handler) => {
        handlers.set(channel, handler);
      }),
      on: vi.fn(),
    };

    mockEngine = {
      addTorrent: vi.fn().mockResolvedValue({ infoHash: 'abc', name: 'test' }),
      pauseTorrent: vi.fn().mockReturnValue(true),
      resumeTorrent: vi.fn().mockReturnValue(true),
      removeTorrent: vi.fn().mockResolvedValue(true),
      setFilePriority: vi.fn().mockReturnValue(true),
      getTorrentSummary: vi.fn((hash) => {
        if (hash === 'abc') {
          return { infoHash: 'abc', path: '/downloads/test' };
        }
        return null;
      }),
      getDownloadPath: vi.fn().mockReturnValue('/downloads'),
      getAllTorrentsSummary: vi.fn().mockReturnValue([{ infoHash: 'abc' }]),
      getGlobalStats: vi.fn().mockReturnValue({ downloadSpeed: 100, uploadSpeed: 50 }),
    };

    mockStore = {
      getSettings: vi.fn().mockReturnValue({ downloadPath: '/downloads', maxActiveDownloads: 5 }),
      saveSettings: vi.fn().mockImplementation((settings) => ({ downloadPath: '/downloads', ...settings })),
    };

    mockDialog = {
      showOpenDialog: vi.fn().mockResolvedValue({ canceled: false, filePaths: ['/path/to/file.torrent'] }),
    };

    mockShell = {
      openPath: vi.fn().mockResolvedValue(''),
    };
  });

  it('registers all required torrent, settings, shell, and dialog IPC channels', () => {
    registerIpcHandlers(ipcMain, mockEngine, mockStore, mockDialog, mockShell);

    const registered = ipcMain.handle.mock.calls.map((call) => call[0]);

    // Core brief requirements
    expect(registered).toContain('torrent:add');
    expect(registered).toContain('torrent:pause');
    expect(registered).toContain('torrent:resume');
    expect(registered).toContain('torrent:remove');
    expect(registered).toContain('torrent:setPriority');
    expect(registered).toContain('torrent:openFolder');
    expect(registered).toContain('settings:get');
    expect(registered).toContain('settings:save');
    expect(registered).toContain('dialog:openTorrentFile');
    expect(registered).toContain('dialog:selectDownloadDirectory');

    // Preload compatibility aliases
    expect(registered).toContain('torrent:setFilePriority');
    expect(registered).toContain('shell:openDownloadFolder');
    expect(registered).toContain('dialog:selectTorrentFile');
  });

  describe('Channel Invocations', () => {
    beforeEach(() => {
      registerIpcHandlers(ipcMain, mockEngine, mockStore, mockDialog, mockShell);
    });

    it('handles torrent:add', async () => {
      const handler = handlers.get('torrent:add');
      const result = await handler({}, 'magnet:?xt=urn:btih:abc', { path: '/custom' });

      expect(mockEngine.addTorrent).toHaveBeenCalledWith('magnet:?xt=urn:btih:abc', { path: '/custom' });
      expect(result).toEqual({ infoHash: 'abc', name: 'test' });
    });

    it('handles torrent:pause', async () => {
      const handler = handlers.get('torrent:pause');
      const result = await handler({}, 'abc');

      expect(mockEngine.pauseTorrent).toHaveBeenCalledWith('abc');
      expect(result).toBe(true);
    });

    it('handles torrent:resume', async () => {
      const handler = handlers.get('torrent:resume');
      const result = await handler({}, 'abc');

      expect(mockEngine.resumeTorrent).toHaveBeenCalledWith('abc');
      expect(result).toBe(true);
    });

    it('handles torrent:remove', async () => {
      const handler = handlers.get('torrent:remove');
      const result = await handler({}, 'abc', true);

      expect(mockEngine.removeTorrent).toHaveBeenCalledWith('abc', true);
      expect(result).toBe(true);
    });

    it('handles torrent:setPriority and torrent:setFilePriority', async () => {
      const handler = handlers.get('torrent:setPriority');
      const result = await handler({}, 'abc', 0, 'dont_download');

      expect(mockEngine.setFilePriority).toHaveBeenCalledWith('abc', 0, 'dont_download');
      expect(result).toBe(true);

      const aliasHandler = handlers.get('torrent:setFilePriority');
      await aliasHandler({}, 'abc', 1, 'normal');
      expect(mockEngine.setFilePriority).toHaveBeenCalledWith('abc', 1, 'normal');
    });

    it('handles torrent:openFolder and shell:openDownloadFolder', async () => {
      const handler = handlers.get('torrent:openFolder');
      await handler({}, 'abc');

      expect(mockEngine.getTorrentSummary).toHaveBeenCalledWith('abc');
      expect(mockShell.openPath).toHaveBeenCalledWith('/downloads/test');

      // Test fallback to default download path if torrent not found
      await handler({}, 'unknown-hash');
      expect(mockShell.openPath).toHaveBeenCalledWith('/downloads');

      // Test alias shell:openDownloadFolder
      const aliasHandler = handlers.get('shell:openDownloadFolder');
      await aliasHandler({}, 'abc');
      expect(mockShell.openPath).toHaveBeenCalledWith('/downloads/test');
    });

    it('handles settings:get and settings:save', async () => {
      const getHandler = handlers.get('settings:get');
      const settings = await getHandler({});
      expect(mockStore.getSettings).toHaveBeenCalled();
      expect(settings).toEqual({ downloadPath: '/downloads', maxActiveDownloads: 5 });

      const saveHandler = handlers.get('settings:save');
      const updated = await saveHandler({}, { maxActiveDownloads: 10 });
      expect(mockStore.saveSettings).toHaveBeenCalledWith({ maxActiveDownloads: 10 });
      expect(updated).toEqual({ downloadPath: '/downloads', maxActiveDownloads: 10 });
    });

    it('handles dialog:openTorrentFile and dialog:selectTorrentFile when file is selected', async () => {
      const handler = handlers.get('dialog:openTorrentFile');
      const result = await handler({});

      expect(mockDialog.showOpenDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: ['openFile'],
          filters: expect.arrayContaining([{ name: 'Torrent Files', extensions: ['torrent'] }]),
        })
      );
      expect(result).toBe('/path/to/file.torrent');

      const aliasHandler = handlers.get('dialog:selectTorrentFile');
      const aliasResult = await aliasHandler({});
      expect(aliasResult).toBe('/path/to/file.torrent');
    });

    it('handles dialog:openTorrentFile when dialog is canceled', async () => {
      mockDialog.showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: [] });
      const handler = handlers.get('dialog:openTorrentFile');
      const result = await handler({});

      expect(result).toBeNull();
    });

    it('handles dialog:selectDownloadDirectory when directory is selected', async () => {
      mockDialog.showOpenDialog.mockResolvedValueOnce({
        canceled: false,
        filePaths: ['/selected/downloads'],
      });
      const handler = handlers.get('dialog:selectDownloadDirectory');
      const result = await handler({});

      expect(mockDialog.showOpenDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.arrayContaining(['openDirectory']),
        })
      );
      expect(result).toBe('/selected/downloads');
    });

    it('handles dialog:selectDownloadDirectory when canceled', async () => {
      mockDialog.showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: [] });
      const handler = handlers.get('dialog:selectDownloadDirectory');
      const result = await handler({});

      expect(result).toBeNull();
    });
  });

  describe('Main process lifecycle and event broadcasting', () => {
    it('broadcasts torrent and stats updates to window webContents', () => {
      const emitter = new EventEmitter();
      const mockWindow = {
        isDestroyed: vi.fn().mockReturnValue(false),
        webContents: {
          send: vi.fn(),
        },
      };

      setupEngineBroadcasting(emitter, () => mockWindow);

      emitter.emit('torrent:update', [{ infoHash: '123' }]);
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('torrent:update', [{ infoHash: '123' }]);

      emitter.emit('stats:update', { downloadSpeed: 500 });
      expect(mockWindow.webContents.send).toHaveBeenCalledWith('stats:update', { downloadSpeed: 500 });
    });

    it('does not send events if window is destroyed or null', () => {
      const emitter = new EventEmitter();
      const mockWindow = {
        isDestroyed: vi.fn().mockReturnValue(true),
        webContents: {
          send: vi.fn(),
        },
      };

      setupEngineBroadcasting(emitter, () => mockWindow);
      emitter.emit('torrent:update', []);
      expect(mockWindow.webContents.send).not.toHaveBeenCalled();

      const emitter2 = new EventEmitter();
      setupEngineBroadcasting(emitter2, () => null);
      emitter2.emit('torrent:update', []);
      // Should not throw or crash
    });

    it('cleans up resources cleanly', async () => {
      await expect(cleanup()).resolves.toBeUndefined();
    });

    it('handles incoming magnet links and torrent arguments', async () => {
      const mockEng = { addTorrent: vi.fn().mockResolvedValue({}) };
      const res = await handleIncomingArg('magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567', mockEng);
      expect(res).toBe(true);
      expect(mockEng.addTorrent).toHaveBeenCalled();

      const invalid = await handleIncomingArg('not-a-torrent', mockEng);
      expect(invalid).toBe(false);
    });

    it('handles downloads folder watcher setup cleanly', () => {
      const mockEng = { addTorrent: vi.fn() };
      const watcher = setupDownloadsFolderWatcher(mockEng, '/non/existent/path');
      expect(watcher).toBeNull();
    });
  });
});

