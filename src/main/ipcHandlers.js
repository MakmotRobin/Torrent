import electron from 'electron';

const defaultDialog = typeof electron === 'object' && electron !== null ? electron.dialog : undefined;
const defaultShell = typeof electron === 'object' && electron !== null ? electron.shell : undefined;

/**
 * Registers all IPC handlers for torrent operations, settings persistence, file dialogs, and native shell.
 *
 * @param {object} ipcMain - Electron ipcMain instance
 * @param {object} engine - TorrentEngine instance
 * @param {object} store - Store instance
 * @param {object} [dialog] - Electron dialog module (mockable)
 * @param {object} [shell] - Electron shell module (mockable)
 */
export function registerIpcHandlers(
  ipcMain,
  engine,
  store,
  dialog = defaultDialog,
  shell = defaultShell
) {
  // torrent:add (source, options)
  ipcMain.handle('torrent:add', async (_event, source, options) => {
    return await engine.addTorrent(source, options);
  });

  // torrent:pause (infoHash)
  ipcMain.handle('torrent:pause', async (_event, infoHash) => {
    return engine.pauseTorrent(infoHash);
  });

  // torrent:resume (infoHash)
  ipcMain.handle('torrent:resume', async (_event, infoHash) => {
    return engine.resumeTorrent(infoHash);
  });

  // torrent:remove (infoHash, deleteFiles)
  ipcMain.handle('torrent:remove', async (_event, infoHash, deleteFiles) => {
    return await engine.removeTorrent(infoHash, deleteFiles);
  });

  // torrent:setPriority / torrent:setFilePriority (infoHash, fileIndex, priority)
  const handleSetPriority = async (_event, infoHash, fileIndex, priority) => {
    return engine.setFilePriority(infoHash, fileIndex, priority);
  };
  ipcMain.handle('torrent:setPriority', handleSetPriority);
  ipcMain.handle('torrent:setFilePriority', handleSetPriority);

  // torrent:openFolder / shell:openDownloadFolder (infoHash)
  const handleOpenFolder = async (_event, infoHash) => {
    let targetPath = null;
    if (infoHash && typeof engine?.getTorrentSummary === 'function') {
      const summary = engine.getTorrentSummary(infoHash);
      targetPath = summary?.path;
    }
    if (!targetPath) {
      if (typeof engine?.getDownloadPath === 'function') {
        targetPath = engine.getDownloadPath();
      } else if (typeof store?.getSettings === 'function') {
        targetPath = store.getSettings()?.downloadPath;
      }
    }
    if (targetPath && shell && typeof shell.openPath === 'function') {
      return await shell.openPath(targetPath);
    }
    return null;
  };
  ipcMain.handle('torrent:openFolder', handleOpenFolder);
  ipcMain.handle('shell:openDownloadFolder', handleOpenFolder);

  // settings:get ()
  ipcMain.handle('settings:get', async () => {
    return store?.getSettings ? store.getSettings() : {};
  });

  // settings:save (settings)
  ipcMain.handle('settings:save', async (_event, newSettings) => {
    return store?.saveSettings ? store.saveSettings(newSettings) : newSettings;
  });

  // dialog:openTorrentFile / dialog:selectTorrentFile ()
  const handleSelectTorrentFile = async () => {
    if (!dialog || typeof dialog.showOpenDialog !== 'function') {
      return null;
    }
    const result = await dialog.showOpenDialog({
      title: 'Select Torrent File',
      filters: [
        { name: 'Torrent Files', extensions: ['torrent'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });
    if (result && !result.canceled && Array.isArray(result.filePaths) && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  };
  ipcMain.handle('dialog:openTorrentFile', handleSelectTorrentFile);
  ipcMain.handle('dialog:selectTorrentFile', handleSelectTorrentFile);

  // dialog:selectDownloadDirectory ()
  const handleSelectDownloadDirectory = async () => {
    if (!dialog || typeof dialog.showOpenDialog !== 'function') {
      return null;
    }
    const result = await dialog.showOpenDialog({
      title: 'Select Download Directory',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result && !result.canceled && Array.isArray(result.filePaths) && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  };
  ipcMain.handle('dialog:selectDownloadDirectory', handleSelectDownloadDirectory);

  // Convenience queries for initial load
  ipcMain.handle('torrent:getAll', async () => {
    return engine?.getAllTorrentsSummary ? engine.getAllTorrentsSummary() : [];
  });

  ipcMain.handle('stats:get', async () => {
    return engine?.getGlobalStats ? engine.getGlobalStats() : {};
  });
}

export default registerIpcHandlers;
