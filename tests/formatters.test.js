import { describe, it, expect } from 'vitest';
import { formatBytes, formatSpeed, formatETA, parseTorrentInput } from '../src/shared/formatters.js';

describe('Formatters', () => {
  describe('formatBytes', () => {
    it('formats bytes to human readable sizes', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(1024)).toBe('1.00 KB');
      expect(formatBytes(1048576 * 5.5)).toBe('5.50 MB');
      expect(formatBytes(1073741824 * 3.25)).toBe('3.25 GB');
    });

    it('supports custom decimal precision', () => {
      expect(formatBytes(1024, 0)).toBe('1 KB');
      expect(formatBytes(1048576 * 1.555, 1)).toBe('1.6 MB');
      expect(formatBytes(1048576 * 1.555, 3)).toBe('1.555 MB');
    });

    it('handles small bytes below 1 KB', () => {
      expect(formatBytes(500)).toBe('500 B');
      expect(formatBytes(1)).toBe('1 B');
    });

    it('handles edge cases gracefully', () => {
      expect(formatBytes(-10)).toBe('0 B');
      expect(formatBytes(NaN)).toBe('0 B');
      expect(formatBytes(null)).toBe('0 B');
      expect(formatBytes(undefined)).toBe('0 B');
    });
  });

  describe('formatSpeed', () => {
    it('formats transfer speeds', () => {
      expect(formatSpeed(0)).toBe('0 B/s');
      expect(formatSpeed(1536000)).toBe('1.46 MB/s');
    });

    it('handles speed units correctly', () => {
      expect(formatSpeed(1024)).toBe('1.00 KB/s');
      expect(formatSpeed(1073741824)).toBe('1.00 GB/s');
    });

    it('handles negative or invalid speeds gracefully', () => {
      expect(formatSpeed(-100)).toBe('0 B/s');
      expect(formatSpeed(NaN)).toBe('0 B/s');
      expect(formatSpeed(null)).toBe('0 B/s');
    });
  });

  describe('formatETA', () => {
    it('formats ETA', () => {
      expect(formatETA(0)).toBe('Done');
      expect(formatETA(45)).toBe('45s');
      expect(formatETA(125)).toBe('2m 5s');
      expect(formatETA(3700)).toBe('1h 1m');
      expect(formatETA(Infinity)).toBe('∞');
    });

    it('formats exact minutes and hours without trailing 0s', () => {
      expect(formatETA(60)).toBe('1m');
      expect(formatETA(3600)).toBe('1h');
    });

    it('formats days for long downloads', () => {
      expect(formatETA(90000)).toBe('1d 1h');
      expect(formatETA(86400)).toBe('1d');
    });

    it('handles invalid or negative ETA gracefully', () => {
      expect(formatETA(-5)).toBe('∞');
      expect(formatETA(NaN)).toBe('∞');
      expect(formatETA(null)).toBe('∞');
    });
  });

  describe('parseTorrentInput', () => {
    it('parses magnet links and hashes', () => {
      const magnet = 'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Ubuntu';
      const parsed = parseTorrentInput(magnet);
      expect(parsed.type).toBe('magnet');
      expect(parsed.value).toBe(magnet);

      expect(parseTorrentInput('invalid-string').type).toBe('invalid');
    });

    it('parses 40-character hex infohashes', () => {
      const hexHash = '08ada5a7a6183aae1e09d831df6748d566095a10';
      const result = parseTorrentInput(hexHash);
      expect(result.type).toBe('infohash');
      expect(result.value).toBe(hexHash.toLowerCase());

      const uppercaseHash = '08ADA5A7A6183AAE1E09D831DF6748D566095A10';
      const upperResult = parseTorrentInput(uppercaseHash);
      expect(upperResult.type).toBe('infohash');
      expect(upperResult.value).toBe(hexHash.toLowerCase());
    });

    it('parses 32-character base32 infohashes', () => {
      const b32Hash = 'JZW2K2VGEEZK4HQZZYY5Q3OVDVEAMWQQ';
      const result = parseTorrentInput(b32Hash);
      expect(result.type).toBe('infohash');
      expect(result.value).toBe(b32Hash.toLowerCase());
    });

    it('handles whitespace in inputs', () => {
      const magnet = '  magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10  ';
      expect(parseTorrentInput(magnet).type).toBe('magnet');
      expect(parseTorrentInput(magnet).value).toBe(magnet.trim());

      const hexHash = '  08ada5a7a6183aae1e09d831df6748d566095a10  ';
      expect(parseTorrentInput(hexHash).type).toBe('infohash');
    });

    it('handles empty or non-string inputs gracefully', () => {
      expect(parseTorrentInput('')).toEqual({ type: 'invalid', value: '' });
      expect(parseTorrentInput('   ')).toEqual({ type: 'invalid', value: '' });
      expect(parseTorrentInput(null)).toEqual({ type: 'invalid', value: '' });
      expect(parseTorrentInput(undefined)).toEqual({ type: 'invalid', value: '' });
    });
  });
});
