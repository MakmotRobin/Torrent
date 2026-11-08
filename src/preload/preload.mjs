import electron from 'electron';

/**
 * Creates the typed torrent API interface over Electron IPC.
 *
 * @param {object} [ipc=electron?.ipcRenderer]
 * @returns {object} torrentAPI
 */
export function createTorrentAPI(ipc = electron?.ipcRenderer) {
  return {
    getAllTorrents: () => ipc?.invoke('torrent:getAll'),
    addTorrent: (source, options) => ipc?.invoke('torrent:add', source, options),
    pauseTorrent: (infoHash) => ipc?.invoke('torrent:pause', infoHash),
    resumeTorrent: (infoHash) => ipc?.invoke('torrent:resume', infoHash),
    removeTorrent: (infoHash, deleteFiles = false) => ipc?.invoke('torrent:remove', infoHash, deleteFiles),
    setFilePriority: (infoHash, fileIndex, priority) =>
      ipc?.invoke('torrent:setFilePriority', infoHash, fileIndex, priority),
    getSettings: () => ipc?.invoke('settings:get'),
    saveSettings: (settings) => ipc?.invoke('settings:save', settings),
    openDownloadFolder: (infoHash) => ipc?.invoke('shell:openDownloadFolder', infoHash),
    selectTorrentFile: () => ipc?.invoke('dialog:selectTorrentFile'),
    selectDownloadDirectory: () => ipc?.invoke('dialog:selectDownloadDirectory'),

    onTorrentUpdate: (callback) => {
      const handler = (_event, torrents) => callback(torrents);
      ipc?.on('torrent:update', handler);
      return () => ipc?.removeListener?.('torrent:update', handler);
    },
    onStatsUpdate: (callback) => {
      const handler = (_event, stats) => callback(stats);
      ipc?.on('stats:update', handler);
      return () => ipc?.removeListener?.('stats:update', handler);
    },
  };
}

export const torrentAPI = createTorrentAPI();

if (electron?.contextBridge?.exposeInMainWorld) {
  electron.contextBridge.exposeInMainWorld('torrentAPI', torrentAPI);
}

export default torrentAPI;
