import EventEmitter from 'events';
import fs from 'fs';
import path from 'path';
import os from 'os';
import WebTorrent from 'webtorrent';
import { parseTorrentInput } from '../shared/formatters.js';

/**
 * Core BitTorrent engine wrapping WebTorrent client,
 * managing torrent lifecycle, event dispatching, disk persistence, and bandwidth stats.
 */
export class TorrentEngine extends EventEmitter {
  /**
   * @param {object} store - Store instance for settings and torrent persistence
   * @param {object} [options] - Engine and WebTorrent options
   */
  constructor(store, options = {}) {
    super();
    this.store = store;
    this.options = { ...options };

    // Active managed torrents map: infoHash -> entry { infoHash, name, source, path, paused, filePriorities, errorMessage, addedAt, torrent }
    this.torrents = new Map();

    const clientOpts = {
      dht: options.dht ?? true,
      maxConns: options.maxConns || 55,
      ...options.clientOptions,
    };

    // Allow injecting client for test mocks
    this.client = options.client || new WebTorrent(clientOpts);

    // Guard against uncaught client errors crashing process
    if (this.client && typeof this.client.on === 'function') {
      this.client.on('error', (err) => {
        this.emit('client:error', err);
      });
    }

    // Tick interval for broadcasting live download/upload transfer speeds
    const intervalMs = options.updateInterval ?? 1000;
    if (intervalMs > 0) {
      this._updateInterval = setInterval(() => {
        this._emitUpdates();
      }, intervalMs);
      if (this._updateInterval?.unref) {
        this._updateInterval.unref();
      }
    }

    // Auto-restore persisted torrents unless explicitly disabled
    if (options.autoLoad !== false) {
      this.loadPersistedTorrents();
    }
  }

  /**
   * Resolves default or custom download directory.
   * @returns {string}
   */
  getDownloadPath() {
    const settings = this.store?.getSettings?.();
    return settings?.downloadPath || path.join(os.homedir(), 'Downloads', 'TorrentDownloads');
  }

  /**
   * Adds a torrent via magnet link, torrent file buffer, or info hash.
   *
   * @param {string|Buffer} source
   * @param {object} [options]
   * @returns {Promise<object>} TorrentSummary
   */
  async addTorrent(source, options = {}) {
    if (!source) {
      throw new Error('Torrent source is required');
    }

    const downloadPath = options.path || this.getDownloadPath();

    // Attempt to identify infoHash beforehand if string
    const parsed = typeof source === 'string' ? parseTorrentInput(source) : null;
    let initialHash = parsed?.type === 'infohash' ? parsed.value.toLowerCase() : null;
    if (parsed?.type === 'magnet') {
      const match = source.match(/xt=urn:btih:([a-zA-Z0-9]+)/i);
      if (match) {
        initialHash = match[1].toLowerCase();
      }
    }

    // Check for duplicate entry
    if (initialHash && this.torrents.has(initialHash)) {
      return this.getTorrentSummary(initialHash);
    }

    let initialName = options.name;
    if (!initialName && typeof source === 'string' && source.startsWith('magnet:?')) {
      const dnMatch = source.match(/dn=([^&]+)/i);
      if (dnMatch) {
        try {
          initialName = decodeURIComponent(dnMatch[1].replace(/\+/g, ' '));
        } catch (_) {
          initialName = dnMatch[1];
        }
      }
    }

    const state = {
      infoHash: initialHash,
      name: initialName || (typeof source === 'string' && !source.startsWith('magnet:') ? path.basename(source) : 'Loading Metadata...'),
      source: typeof source === 'string' ? source : (source.name || 'torrent-file'),
      path: downloadPath,
      paused: Boolean(options.paused),
      filePriorities: { ...(options.filePriorities || {}) },
      errorMessage: null,
      addedAt: options.addedAt || new Date().toISOString(),
      torrent: null,
    };

    if (initialHash) {
      this.torrents.set(initialHash, state);
    }

    return new Promise((resolve, reject) => {
      let resolved = false;

      const finish = (summary) => {
        if (!resolved) {
          resolved = true;
          resolve(summary);
        }
      };

      const clientOpts = {
        path: downloadPath,
        ...options.torrentOptions,
      };

      try {
        const torrent = this.client.add(source, clientOpts);
        state.torrent = torrent;

        const onInfoHash = () => {
          if (torrent.infoHash) {
            const newHash = torrent.infoHash.toLowerCase();
            if (initialHash && initialHash !== newHash) {
              this.torrents.delete(initialHash);
            }
            state.infoHash = newHash;
            this.torrents.set(newHash, state);
          }
          if (torrent.magnetURI) {
            state.source = torrent.magnetURI;
          } else if (state.infoHash && (!state.source || state.source === 'torrent-file')) {
            state.source = state.infoHash;
          }
          this._emitUpdates();
          this.persistTorrents();
          finish(this.getTorrentSummary(state.infoHash || initialHash));
        };

        if (torrent.infoHash) {
          onInfoHash();
        } else if (typeof torrent.once === 'function') {
          torrent.once('infoHash', onInfoHash);
        }

        if (typeof torrent.on === 'function') {
          torrent.on('metadata', () => {
            state.name = torrent.name || state.name;
            if (torrent.magnetURI) {
              state.source = torrent.magnetURI;
            } else if (state.infoHash && (!state.source || state.source === 'torrent-file')) {
              state.source = state.infoHash;
            }
            if (state.filePriorities) {
              this._applyFilePriorities(torrent, state.filePriorities);
            }
            if (state.paused && typeof torrent.pause === 'function') {
              torrent.pause();
            }
            this.persistTorrents();
            this._emitUpdates();
            finish(this.getTorrentSummary(state.infoHash || initialHash));
          });

          torrent.on('download', () => {
            // High-frequency chunk downloads rely on periodic timer interval
          });

          torrent.on('upload', () => {
            // High-frequency chunk uploads rely on periodic timer interval
          });

          torrent.on('done', () => {
            this.persistTorrents();
            this._emitUpdates();
          });

          torrent.on('wire', () => {
            // Wire connections rely on periodic timer interval
          });

          torrent.on('error', (err) => {
            state.errorMessage = err.message || String(err);
            this._emitUpdates();
            finish(this.getTorrentSummary(state.infoHash || initialHash));
          });
        }

        // If added in paused state, pause torrent
        if (state.paused && typeof torrent.pause === 'function') {
          torrent.pause();
        }

        // Ensure promise resolves even before swarm metadata completes
        setTimeout(() => {
          finish(this.getTorrentSummary(state.infoHash || initialHash));
        }, 150);

      } catch (err) {
        state.errorMessage = err.message;
        if (initialHash) {
          finish(this.getTorrentSummary(initialHash));
        } else {
          reject(err);
        }
      }
    });
  }

  /**
   * Pauses an active torrent.
   *
   * @param {string} infoHash
   * @returns {boolean}
   */
  pauseTorrent(infoHash) {
    const key = (infoHash || '').toLowerCase();
    const entry = this.torrents.get(key);
    if (!entry) return false;

    entry.paused = true;
    if (entry.torrent && typeof entry.torrent.pause === 'function') {
      entry.torrent.pause();
    }
    this.persistTorrents();
    this._emitUpdates();
    return true;
  }

  /**
   * Resumes a paused torrent.
   *
   * @param {string} infoHash
   * @returns {boolean}
   */
  resumeTorrent(infoHash) {
    const key = (infoHash || '').toLowerCase();
    const entry = this.torrents.get(key);
    if (!entry) return false;

    entry.paused = false;
    if (entry.torrent && typeof entry.torrent.resume === 'function') {
      entry.torrent.resume();
    }
    this.persistTorrents();
    this._emitUpdates();
    return true;
  }

  /**
   * Removes a torrent, optionally deleting payload data files from disk.
   *
   * @param {string} infoHash
   * @param {boolean} [deleteFiles=false]
   * @returns {Promise<boolean>}
   */
  async removeTorrent(infoHash, deleteFiles = false) {
    const key = (infoHash || '').toLowerCase();
    const entry = this.torrents.get(key);
    if (!entry) return false;

    const torrent = entry.torrent;
    const savePath = entry.path || torrent?.path;
    const torrentName = entry.name || torrent?.name;

    if (torrent && this.client) {
      await new Promise((resolve) => {
        let finished = false;
        const done = () => {
          if (!finished) {
            finished = true;
            resolve();
          }
        };

        const timer = setTimeout(done, 2000);

        try {
          this.client.remove(torrent, { destroyStore: deleteFiles }, () => {
            clearTimeout(timer);
            done();
          });
        } catch (_) {
          clearTimeout(timer);
          done();
        }
      });
    }

    if (deleteFiles && savePath && torrentName) {
      try {
        const fullPath = path.join(savePath, torrentName);
        if (fs.existsSync(fullPath)) {
          fs.rmSync(fullPath, { recursive: true, force: true });
        }
      } catch (err) {
        console.error('Error deleting torrent payload files:', err);
      }
    }

    this.torrents.delete(key);
    this.persistTorrents();
    this._emitUpdates();
    return true;
  }

  /**
   * Configures selective file priority ('normal', 'low', 'dont_download').
   *
   * @param {string} infoHash
   * @param {number} fileIndex
   * @param {string|boolean} priority
   * @returns {boolean}
   */
  setFilePriority(infoHash, fileIndex, priority) {
    const key = (infoHash || '').toLowerCase();
    const entry = this.torrents.get(key);
    if (!entry) return false;

    if (!entry.filePriorities) {
      entry.filePriorities = {};
    }

    const normalizedPriority = (priority === false || priority === 'dont_download')
      ? 'dont_download'
      : (priority || 'normal');

    entry.filePriorities[fileIndex] = normalizedPriority;

    if (entry.torrent && entry.torrent.files && entry.torrent.files[fileIndex]) {
      const file = entry.torrent.files[fileIndex];
      if (normalizedPriority === 'dont_download') {
        if (typeof file.deselect === 'function') file.deselect();
      } else {
        if (typeof file.select === 'function') file.select();
      }
    }

    this.persistTorrents();
    this._emitUpdates();
    return true;
  }

  /**
   * Generates summary object for a single torrent.
   *
   * @param {string} infoHash
   * @returns {object|null}
   */
  getTorrentSummary(infoHash) {
    const key = (infoHash || '').toLowerCase();
    const entry = this.torrents.get(key);
    if (!entry) return null;

    const t = entry.torrent;
    const isPaused = Boolean(entry.paused);
    const isReady = Boolean(t?.ready);
    const isDone = Boolean(t?.done || (t?.progress === 1));

    let status = 'downloading';
    if (entry.errorMessage) {
      status = 'error';
    } else if (isPaused) {
      status = 'paused';
    } else if (!isReady) {
      status = 'metadata';
    } else if (isDone) {
      status = (t.uploadSpeed > 0 || (t.numPeers > 0 && !isPaused)) ? 'seeding' : 'completed';
    } else if (t.numPeers === 0 && t.downloadSpeed === 0) {
      status = 'connecting';
    } else {
      status = 'downloading';
    }

    let timeRemaining = Infinity;
    if (isDone) {
      timeRemaining = 0;
    } else if (!isPaused && t && t.timeRemaining && Number.isFinite(t.timeRemaining)) {
      timeRemaining = Math.max(0, Math.round(t.timeRemaining / 1000));
    }

    const files = (t?.files || []).map((file, idx) => {
      const p = entry.filePriorities?.[idx] || 'normal';
      return {
        index: idx,
        name: file.name,
        path: file.path,
        length: file.length || 0,
        downloaded: file.downloaded || 0,
        progress: file.progress || 0,
        selected: p !== 'dont_download',
        priority: p,
      };
    });

    const peers = (t?.wires || []).map((wire) => ({
      addr: wire.remoteAddress ? `${wire.remoteAddress}:${wire.remotePort || ''}` : (wire.peerId || 'Unknown'),
      client: wire.peerExtendedHandshake?.v || wire.clientName || 'BitTorrent Client',
      downloadSpeed: typeof wire.downloadSpeed === 'function' ? wire.downloadSpeed() : (wire.downloadSpeed || 0),
      uploadSpeed: typeof wire.uploadSpeed === 'function' ? wire.uploadSpeed() : (wire.uploadSpeed || 0),
    }));

    const announceList = Array.isArray(t?.announce) ? t.announce : [];
    const trackers = announceList.flat().map((url) => ({
      announce: url,
      status: 'working',
    }));

    let pieces = [];
    if (t?.bitfield && t?.pieces?.length) {
      try {
        pieces = Array.from({ length: t.pieces.length }, (_, i) => Boolean(t.bitfield.get(i)));
      } catch (_) {
        pieces = [];
      }
    }

    return {
      infoHash: entry.infoHash || key,
      name: t?.name || entry.name || 'Unknown',
      length: t?.length || 0,
      downloaded: t?.downloaded || 0,
      uploaded: t?.uploaded || 0,
      downloadSpeed: isPaused ? 0 : (t?.downloadSpeed || 0),
      uploadSpeed: isPaused ? 0 : (t?.uploadSpeed || 0),
      progress: t?.progress || 0,
      ratio: t?.ratio || 0,
      status,
      timeRemaining,
      numPeers: t?.numPeers || (t?.wires ? t.wires.length : 0),
      paused: isPaused,
      path: entry.path || t?.path || '',
      magnetURI: t?.magnetURI || (typeof entry.source === 'string' && entry.source.startsWith('magnet:') ? entry.source : ''),
      pieceLength: t?.pieceLength || 0,
      numPieces: t?.pieces?.length || 0,
      pieces,
      files,
      peers,
      trackers,
      errorMessage: entry.errorMessage || null,
      addedAt: entry.addedAt,
    };
  }

  /**
   * Returns list of summaries for all managed torrents.
   * @returns {Array<object>}
   */
  getAllTorrentsSummary() {
    const list = [];
    for (const [key] of this.torrents) {
      const summary = this.getTorrentSummary(key);
      if (summary) {
        list.push(summary);
      }
    }
    return list;
  }

  /**
   * Calculates aggregated global transfer statistics across all active swarms.
   * @returns {object}
   */
  getGlobalStats() {
    let downloadSpeed = 0;
    let uploadSpeed = 0;
    let activeCount = 0;
    let totalDownloaded = 0;
    let totalUploaded = 0;

    for (const [, entry] of this.torrents) {
      const t = entry.torrent;
      if (t) {
        downloadSpeed += t.downloadSpeed || 0;
        uploadSpeed += t.uploadSpeed || 0;
        totalDownloaded += t.downloaded || 0;
        totalUploaded += t.uploaded || 0;
        if (!entry.paused && (t.downloadSpeed > 0 || t.uploadSpeed > 0 || (t.ready && !t.done))) {
          activeCount++;
        }
      }
    }

    if (this.client) {
      if (downloadSpeed === 0 && typeof this.client.downloadSpeed === 'number') {
        downloadSpeed = this.client.downloadSpeed;
      }
      if (uploadSpeed === 0 && typeof this.client.uploadSpeed === 'number') {
        uploadSpeed = this.client.uploadSpeed;
      }
    }

    const ratio = totalDownloaded > 0 ? (totalUploaded / totalDownloaded) : 0;

    return {
      downloadSpeed,
      uploadSpeed,
      activeCount,
      totalTorrents: this.torrents.size,
      totalDownloaded,
      totalUploaded,
      ratio,
      dhtNodes: this.client?.dht?.nodes?.length || 0,
    };
  }

  /**
   * Persists active torrents metadata and priority selections to Store.
   */
  persistTorrents() {
    if (!this.store || typeof this.store.saveTorrents !== 'function') return;
    const list = [];
    for (const [key, entry] of this.torrents) {
      const source = (entry.source && entry.source !== 'torrent-file')
        ? entry.source
        : (entry.torrent?.magnetURI || entry.infoHash || key);
      list.push({
        infoHash: entry.infoHash || key,
        name: entry.name,
        source,
        path: entry.path,
        paused: Boolean(entry.paused),
        filePriorities: entry.filePriorities || {},
        addedAt: entry.addedAt,
      });
    }
    this.store.saveTorrents(list);
  }

  /**
   * Restores persisted torrents from Store on launch.
   */
  async loadPersistedTorrents() {
    if (!this.store || typeof this.store.getTorrents !== 'function') return;
    const savedList = this.store.getTorrents();
    if (!Array.isArray(savedList)) return;

    for (const item of savedList) {
      const source = (item.source && item.source !== 'torrent-file')
        ? item.source
        : (item.magnetURI || item.infoHash);
      if (source) {
        try {
          await this.addTorrent(source, {
            path: item.path,
            paused: item.paused,
            filePriorities: item.filePriorities,
            addedAt: item.addedAt,
            name: item.name,
          });
        } catch (err) {
          console.error(`Failed to restore persisted torrent ${item.infoHash}:`, err);
        }
      }
    }
  }

  /**
   * Internal helper to apply file priority selections.
   */
  _applyFilePriorities(torrent, filePriorities) {
    if (!torrent || !torrent.files || !filePriorities) return;
    for (const [indexStr, priority] of Object.entries(filePriorities)) {
      const idx = Number(indexStr);
      const file = torrent.files[idx];
      if (file) {
        if (priority === 'dont_download' || priority === false) {
          if (typeof file.deselect === 'function') file.deselect();
        } else if (priority === 'normal' || priority === true || priority === 'low') {
          if (typeof file.select === 'function') file.select();
        }
      }
    }
  }

  /**
   * Emits batch updates to listeners.
   */
  _emitUpdates() {
    this.emit('torrent:update', this.getAllTorrentsSummary());
    this.emit('stats:update', this.getGlobalStats());
  }

  /**
   * Cleanly closes WebTorrent client and clears update timers.
   */
  async destroy() {
    if (this._updateInterval) {
      clearInterval(this._updateInterval);
      this._updateInterval = null;
    }
    if (this.client) {
      await new Promise((resolve) => {
        try {
          this.client.destroy(() => resolve());
        } catch (_) {
          resolve();
        }
      });
    }
  }
}

export default TorrentEngine;
