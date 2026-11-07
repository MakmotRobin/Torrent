import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Store } from '../src/main/store.js';

describe('Store', () => {
  let tmpDir;
  let store;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'torrent-test-'));
    store = new Store(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns default settings when store is empty', () => {
    const settings = store.getSettings();
    expect(settings.downloadPath).toBeDefined();
    expect(settings.maxActiveDownloads).toBe(5);
    expect(settings.downloadSpeedLimit).toBe(0);
    expect(settings.uploadSpeedLimit).toBe(0);
  });

  it('updates and persists settings', () => {
    const updated = store.saveSettings({ maxActiveDownloads: 10 });
    expect(updated.maxActiveDownloads).toBe(10);
    expect(updated.downloadPath).toBeDefined();

    const freshStore = new Store(tmpDir);
    const freshSettings = freshStore.getSettings();
    expect(freshSettings.maxActiveDownloads).toBe(10);
    expect(freshSettings.downloadPath).toBe(updated.downloadPath);
  });

  it('persists and retrieves torrent list', () => {
    const list = [{ infoHash: 'abc123', name: 'test.iso', paused: false }];
    store.saveTorrents(list);
    const loaded = store.getTorrents();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('test.iso');
    expect(loaded[0].infoHash).toBe('abc123');

    const freshStore = new Store(tmpDir);
    expect(freshStore.getTorrents()).toEqual(list);
  });

  it('handles corrupted settings file gracefully by falling back to defaults', () => {
    const settingsFile = path.join(tmpDir, 'settings.json');
    fs.writeFileSync(settingsFile, '{ bad json: true', 'utf-8');

    const settings = store.getSettings();
    expect(settings.maxActiveDownloads).toBe(5);
    expect(settings.downloadPath).toBeDefined();
  });

  it('handles corrupted torrents file gracefully by returning empty array', () => {
    const torrentsFile = path.join(tmpDir, 'torrents.json');
    fs.writeFileSync(torrentsFile, 'not-json', 'utf-8');

    expect(store.getTorrents()).toEqual([]);
  });

  it('creates directory if it does not exist', () => {
    const nestedDir = path.join(tmpDir, 'nested', 'store');
    const nestedStore = new Store(nestedDir);

    nestedStore.saveSettings({ maxActiveDownloads: 8 });
    expect(fs.existsSync(nestedDir)).toBe(true);
    expect(nestedStore.getSettings().maxActiveDownloads).toBe(8);
  });

  it('performs atomic writes without leaving temporary files behind', () => {
    store.saveSettings({ maxActiveDownloads: 7 });
    store.saveTorrents([{ infoHash: 'def456', name: 'sample.mkv', paused: true }]);

    const files = fs.readdirSync(tmpDir);
    const tmpFiles = files.filter(f => f.includes('.tmp.'));
    expect(tmpFiles).toHaveLength(0);
    expect(files).toContain('settings.json');
    expect(files).toContain('torrents.json');
  });
});
