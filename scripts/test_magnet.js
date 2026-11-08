import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { TorrentEngine } from '../src/main/torrentEngine.js';
import { Store } from '../src/main/store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testMagnet() {
  const magnetURI = 'magnet:?xt=urn:btih:7e5596eea20f4c3ed1b314bf52bfa92668e634a0&tr=http%3A%2F%2Frutracker.ru%2Fbt%2Fannounce.php%3Fuk%3D';
  
  const tmpDir = path.join(os.tmpdir(), 'torrent-test-' + Date.now());
  fs.mkdirSync(tmpDir, { recursive: true });
  
  const store = new Store(tmpDir);
  store.saveSettings({ downloadPath: tmpDir });
  
  console.log('Initializing TorrentEngine...');
  const engine = new TorrentEngine(store, { dht: true, maxConns: 55 });
  
  console.log('Adding magnet link:', magnetURI);
  const summary = await engine.addTorrent(magnetURI);
  console.log('Torrent added successfully with initial summary:');
  console.log({
    infoHash: summary.infoHash,
    name: summary.name,
    status: summary.status,
    downloadPath: summary.downloadPath,
    trackers: summary.trackers
  });
  
  console.log('Waiting for swarm / tracker response and metadata resolution (up to 30s)...');
  
  let resolved = false;
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      const updated = engine.getTorrentSummary(summary.infoHash);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      
      console.log(`[${elapsed}s] Status: ${updated.status} | Peers: ${updated.numPeers} | Down: ${(updated.downloadSpeed / 1024).toFixed(1)} KB/s`);
      
      if (updated.status !== 'metadata' && updated.name !== 'Fetching metadata...') {
        console.log('=== METADATA RESOLVED! ===');
        console.log('Torrent Name:', updated.name);
        console.log('Total Size:', updated.length, `(${(updated.length / (1024*1024)).toFixed(2)} MB)`);
        console.log('Files (' + updated.files.length + '):', updated.files.map(f => f.name));
        console.log('Trackers:', updated.trackers);
        resolved = true;
        clearInterval(checkInterval);
        cleanup(engine, tmpDir).then(resolve);
      }
      
      if (Date.now() - startTime > 25000) {
        console.log('Timeout reached (25s). Swarm search completed.');
        console.log('Final summary state:');
        console.log(updated);
        clearInterval(checkInterval);
        cleanup(engine, tmpDir).then(resolve);
      }
    }, 2000);
  });
}

async function cleanup(engine, tmpDir) {
  console.log('Cleaning up engine...');
  await engine.destroy();
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (e) {}
  console.log('Test completed.');
}

testMagnet().catch(err => {
  console.error('Error during magnet test:', err);
  process.exit(1);
});
