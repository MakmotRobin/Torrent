/**
 * Utility formatters and parsers for torrent data.
 */

/**
 * Format bytes into human-readable string (B, KB, MB, GB, TB, PB).
 * @param {number} bytes 
 * @param {number} [decimals=2] 
 * @returns {string}
 */
export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0 || !Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const unitIndex = Math.min(Math.max(i, 0), sizes.length - 1);

  if (unitIndex === 0) {
    return `${Math.round(bytes)} B`;
  }

  return `${(bytes / Math.pow(k, unitIndex)).toFixed(dm)} ${sizes[unitIndex]}`;
}

/**
 * Format transfer speed (bytes/sec) into human-readable string.
 * @param {number} bytesPerSec 
 * @returns {string}
 */
export function formatSpeed(bytesPerSec) {
  if (!bytesPerSec || !Number.isFinite(bytesPerSec) || bytesPerSec <= 0) {
    return '0 B/s';
  }

  return `${formatBytes(bytesPerSec)}/s`;
}

/**
 * Format estimated time remaining (ETA) in seconds into a friendly human-readable format.
 * @param {number} seconds 
 * @returns {string}
 */
export function formatETA(seconds) {
  if (seconds === 0) {
    return 'Done';
  }

  if (!Number.isFinite(seconds) || seconds < 0) {
    return '∞';
  }

  const sec = Math.round(seconds);
  if (sec === 0) {
    return 'Done';
  }

  if (sec < 60) {
    return `${sec}s`;
  }

  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const remainingSecs = sec % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  return remainingSecs > 0 ? `${minutes}m ${remainingSecs}s` : `${minutes}m`;
}

/**
 * Parse and validate torrent input string (magnet URI or infohash).
 * @param {string} input 
 * @returns {{ type: 'magnet' | 'infohash' | 'invalid', value: string }}
 */
export function parseTorrentInput(input) {
  if (typeof input !== 'string') {
    return { type: 'invalid', value: '' };
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return { type: 'invalid', value: '' };
  }

  if (trimmed.toLowerCase().startsWith('magnet:?')) {
    return { type: 'magnet', value: trimmed };
  }

  // 40-character hexadecimal SHA-1 infohash
  if (/^[0-9a-fA-F]{40}$/.test(trimmed)) {
    return { type: 'infohash', value: trimmed.toLowerCase() };
  }

  // 32-character base32 infohash
  if (/^[2-7a-zA-Z]{32}$/.test(trimmed)) {
    return { type: 'infohash', value: trimmed.toLowerCase() };
  }

  return { type: 'invalid', value: trimmed };
}
