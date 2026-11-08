import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { TorrentEngine } from '../src/main/torrentEngine.js';
import { Store } from '../src/main/store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testMagnetWithFallbackTrackers() {
  const hash = '7e5596eea20f4c3ed1b314bf52bfa92668e634a0';
  const openTrackers = [
    'http://rutracker.ru/bt/announce.php?uk=',
    'udp://tracker.opentrackr.org:1337/announce',
    'udp://open.stealth.si:80/announce',
    'udp://tracker.openbittorrent.com:6969/announce',
    'udp://exodus.desync.com:6969/announce',
    'udp://9.rarbg.to:2920/announce',
    'udp://tracker.torrent.eu.org:451/announce'
  ];
  
  const magnetURI = `magnet:?xt=urn:btih:${hash}&dn=TorrentTest&` + openTrackers.map(tr => `tr=${encodeURIComponent(tr)}`).join('&');
  
  const tmpDir = path.join(os.tmpdir(), 'torrent-test-fallback-' + Date.now());
  fs.mkdirSync(tmpDir, { recursive: true });
  
  const store = new Store(tmpDir);
  store.saveSettings({ downloadPath: tmpDir });
  
  console.log('Initializing TorrentEngine with public trackers and DHT enabled...');
  const engine = new TorrentEngine(store, { dht: true, maxConns: 100 });
  
  console.log('Adding augmented magnet link...');
  const summary = await engine.addTorrent(magnetURI);
  console.log('Initial summary:', summary.name, summary.status, 'Trackers count:', summary.trackers.length);
  
  const startTime = Date.now();
  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      const updated = engine.getTorrentSummary(summary.infoHash);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      
      console.log(`[${elapsed}s] Status: ${updated.status} | Peers: ${updated.numPeers} | Down: ${(updated.downloadSpeed / 1024).toFixed(1)} KB/s`);
      
      if (updated.status !== 'metadata' && updated.name !== 'Loading Metadata...' && updated.name !== 'Fetching metadata...') {
        console.log('=== SUCCESS: METADATA RESOLVED FROM SWARM! ===');
        console.log('Name:', updated.name);
        console.log('Size:', (updated.length / (1024*1024)).toFixed(2), 'MB');
        console.log('Files:', updated.files.map(f => f.name));
        clearInterval(checkInterval);
        engine.destroy().then(() => {
          try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
          resolve();
        });
      }
      
      if (Date.now() - startTime > 30000) {
        console.log('Swarm check finished (30s).');
        console.log('Peers found:', updated.numPeers);
        clearInterval(checkInterval);
        engine.destroy().then(() => {
          try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
          resolve();
        });
      }
    }, 2000);
  });
}

testMagnetWithFallbackTrackers().catch(console.error);
