import fs from 'fs';
import path from 'path';
import os from 'os';

export const DEFAULT_SETTINGS = Object.freeze({
  downloadPath: path.join(os.homedir(), 'Downloads', 'TorrentDownloads'),
  maxActiveDownloads: 5,
  maxActiveUploads: 5,
  downloadSpeedLimit: 0,
  uploadSpeedLimit: 0,
  port: 6881,
  dht: true,
});

/**
 * Safely writes JSON data to disk atomically using a temp file + rename.
 * Falls back to direct write if rename fails.
 *
 * @param {string} filePath
 * @param {any} data
 */
function atomicWriteJsonSync(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  const jsonString = JSON.stringify(data, null, 2);

  try {
    fs.writeFileSync(tempPath, jsonString, 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (_err) {
    // Fallback for atomic write failure
    try {
      fs.writeFileSync(filePath, jsonString, 'utf-8');
    } finally {
      if (fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch (_) {}
      }
    }
  }
}

/**
 * Safely reads and parses a JSON file.
 * Returns the fallback value if the file does not exist or contains invalid JSON.
 *
 * @param {string} filePath
 * @param {any} fallback
 * @returns {any}
 */
function readJsonSync(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (_err) {
    return fallback;
  }
}

/**
 * Persistent storage manager for application settings and active torrent list.
 */
export class Store {
  /**
   * @param {string} [userDataPath] - Directory path for storing settings and state JSON files.
   */
  constructor(userDataPath) {
    this.userDataPath = userDataPath || path.join(os.homedir(), '.torrent-desktop-app');
    this.settingsFile = path.join(this.userDataPath, 'settings.json');
    this.torrentsFile = path.join(this.userDataPath, 'torrents.json');
    this.defaultSettings = { ...DEFAULT_SETTINGS };
  }

  /**
   * Retrieves application settings merged with defaults.
   *
   * @returns {object} AppSettings
   */
  getSettings() {
    const saved = readJsonSync(this.settingsFile, null);
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) {
      return { ...this.defaultSettings };
    }
    return { ...this.defaultSettings, ...saved };
  }

  /**
   * Updates settings with the provided partial settings and persists to disk.
   *
   * @param {object} partial - Partial settings to merge.
   * @returns {object} Updated AppSettings
   */
  saveSettings(partial = {}) {
    const current = this.getSettings();
    const updated = { ...current, ...partial };
    atomicWriteJsonSync(this.settingsFile, updated);
    return updated;
  }

  /**
   * Retrieves the list of stored torrents.
   *
   * @returns {Array<object>} StoredTorrent[]
   */
  getTorrents() {
    const saved = readJsonSync(this.torrentsFile, null);
    if (!Array.isArray(saved)) {
      return [];
    }
    return saved;
  }

  /**
   * Persists the list of torrents to disk.
   *
   * @param {Array<object>} torrents - StoredTorrent[]
   */
  saveTorrents(torrents) {
    const list = Array.isArray(torrents) ? torrents : [];
    atomicWriteJsonSync(this.torrentsFile, list);
  }
}

export default Store;
