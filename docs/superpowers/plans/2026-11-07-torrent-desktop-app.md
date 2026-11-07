# Torrent Desktop App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a modern, uTorrent-style desktop BitTorrent client application for downloading large files using Electron, Node.js (WebTorrent), and React/Tailwind CSS.

**Architecture:** Electron main process handles the WebTorrent engine, disk persistence, peer discovery, and native dialogs. The renderer process delivers an authentic uTorrent interface (top action bar, left category filter sidebar, main data table, tabbed bottom detail inspector for files/peers/trackers/speed graph) communicating via secure IPC contextBridge.

**Tech Stack:** Node.js (v24), Electron, WebTorrent, React 19, Tailwind CSS, Lucide Icons, Vite, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-07-torrent-desktop-app-design.md`

## Global Constraints
- Platform: Windows (with cross-platform Electron packaging).
- Zero external native C++ build dependencies required (pure JavaScript/Node.js WebTorrent engine).
- Torrent downloads support both `.torrent` files and `magnet:` links.
- Download state and user configuration must persist across application restarts in local JSON store.
- Polling/tick interval for UI transfer rate and progress updates must be within 500ms–1000ms.

## Review Focus
1. **Invalid or malformed magnet link:** Renderer modal displays a clear validation error without crashing the main process.
2. **Abrupt app exit while downloading:** Incomplete pieces and metadata must resume cleanly upon next launch without file corruption or duplicate torrent entries.
3. **Multi-file torrent with deselected files:** Files toggled to "Don't Download" must not consume disk space or fetch unneeded pieces beyond boundary chunk overlaps.
4. **Deleting a torrent:** "Delete Torrent" removes from list, while "Delete Torrent + Data" securely unlinks downloaded payload files from disk.
5. **Zero peers / offline tracker swarm:** UI gracefully displays "Connecting / 0 peers" without hanging or freezing the renderer.

---

### Task 1: Project Scaffolding & Build Configuration

**Files:**
- Create: `package.json`
- Create: `vite.config.mjs`
- Create: `vitest.config.mjs`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Create: `index.html`
- Test: `tests/config.test.js`

**Interfaces:**
- Consumes: Node.js runtime, npm dependencies (`electron`, `webtorrent`, `react`, `react-dom`, `lucide-react`, `tailwindcss`, `vite`, `vitest`).
- Produces: Runnable npm scripts (`npm run dev`, `npm test`, `npm run build`).

- [ ] **Step 1: Write configuration test**
```javascript
// tests/config.test.js
import { describe, it, expect } from 'vitest';
import packageJson from '../package.json';

describe('Project configuration', () => {
  it('has required scripts and dependencies', () => {
    expect(packageJson.scripts.dev).toBeDefined();
    expect(packageJson.scripts.test).toBeDefined();
    expect(packageJson.dependencies.webtorrent).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/config.test.js`
Expected: FAIL (package.json not configured or vitest not installed)

- [ ] **Step 3: Create package.json and configuration files**
Initialize package structure, install dependencies (`electron`, `webtorrent`, `react`, `react-dom`, `lucide-react`, `tailwindcss`, `postcss`, `autoprefixer`, `vite`, `vitest`), and setup `vite.config.mjs`.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/config.test.js`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add package.json vite.config.mjs vitest.config.mjs tailwind.config.js postcss.config.js index.html tests/config.test.js
git commit -m "chore: scaffold project structure with electron, react, and vitest"
```

---

### Task 2: Utility Formatters & Data Parsing

**Files:**
- Create: `src/shared/formatters.js`
- Test: `tests/formatters.test.js`

**Interfaces:**
- Consumes: Numeric byte counts, timestamps, speed rates.
- Produces: 
  - `formatBytes(bytes: number, decimals?: number): string`
  - `formatSpeed(bytesPerSec: number): string`
  - `formatETA(seconds: number): string`
  - `parseTorrentInput(input: string): { type: 'magnet' | 'infohash' | 'invalid', value: string }`

- [ ] **Step 1: Write the failing tests**
```javascript
// tests/formatters.test.js
import { describe, it, expect } from 'vitest';
import { formatBytes, formatSpeed, formatETA, parseTorrentInput } from '../src/shared/formatters.js';

describe('Formatters', () => {
  it('formats bytes to human readable sizes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(1048576 * 5.5)).toBe('5.50 MB');
    expect(formatBytes(1073741824 * 3.25)).toBe('3.25 GB');
  });

  it('formats transfer speeds', () => {
    expect(formatSpeed(0)).toBe('0 B/s');
    expect(formatSpeed(1536000)).toBe('1.46 MB/s');
  });

  it('formats ETA', () => {
    expect(formatETA(0)).toBe('Done');
    expect(formatETA(45)).toBe('45s');
    expect(formatETA(125)).toBe('2m 5s');
    expect(formatETA(3700)).toBe('1h 1m');
    expect(formatETA(Infinity)).toBe('∞');
  });

  it('parses magnet links and hashes', () => {
    const magnet = 'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Ubuntu';
    expect(parseTorrentInput(magnet).type).toBe('magnet');
    expect(parseTorrentInput('invalid-string').type).toBe('invalid');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/formatters.test.js`
Expected: FAIL ("Cannot find module '../src/shared/formatters.js'")

- [ ] **Step 3: Implement `src/shared/formatters.js`**
Write formatting helpers and magnet URI / infohash parser logic.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/formatters.test.js`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/shared/formatters.js tests/formatters.test.js
git commit -m "feat: add formatting utilities and magnet parser"
```

---

### Task 3: State Store & Persistence Layer

**Files:**
- Create: `src/main/store.js`
- Test: `tests/store.test.js`

**Interfaces:**
- Consumes: File system (`fs`, `path`), user data directory path.
- Produces: 
  - `Store` class with `getSettings(): AppSettings`, `saveSettings(partial: Partial<AppSettings>): AppSettings`, `getTorrents(): StoredTorrent[]`, `saveTorrents(torrents: StoredTorrent[]): void`.

- [ ] **Step 1: Write the failing tests**
```javascript
// tests/store.test.js
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
  });

  it('updates and persists settings', () => {
    store.saveSettings({ maxActiveDownloads: 10 });
    const freshStore = new Store(tmpDir);
    expect(freshStore.getSettings().maxActiveDownloads).toBe(10);
  });

  it('persists and retrieves torrent list', () => {
    const list = [{ infoHash: 'abc123', name: 'test.iso', paused: false }];
    store.saveTorrents(list);
    const loaded = store.getTorrents();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('test.iso');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/store.test.js`
Expected: FAIL ("Cannot find module '../src/main/store.js'")

- [ ] **Step 3: Implement `Store` in `src/main/store.js`**
Handle JSON file persistence with atomic file writes and default values.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/store.test.js`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/main/store.js tests/store.test.js
git commit -m "feat: add persistent settings and torrent state store"
```

---

### Task 4: WebTorrent Core Engine & IPC Controller

**Files:**
- Create: `src/main/torrentEngine.js`
- Create: `src/preload/preload.js`
- Test: `tests/torrentEngine.test.js`

**Interfaces:**
- Consumes: `Store`, `webtorrent` client.
- Produces:
  - `TorrentEngine` class: `addTorrent(source, options)`, `pauseTorrent(infoHash)`, `resumeTorrent(infoHash)`, `removeTorrent(infoHash, deleteFiles)`, `setFilePriority(infoHash, fileIndex, priority)`, `getAllTorrentsSummary()`, `getGlobalStats()`.
  - Electron Preload script exposing `window.torrentAPI`.

- [ ] **Step 1: Write the failing tests**
```javascript
// tests/torrentEngine.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TorrentEngine } from '../src/main/torrentEngine.js';

describe('TorrentEngine', () => {
  let engine;
  let mockStore;

  beforeEach(() => {
    mockStore = {
      getSettings: vi.fn().mockReturnValue({ downloadPath: '/tmp/downloads', maxActiveDownloads: 5 }),
      saveSettings: vi.fn(),
      getTorrents: vi.fn().mockReturnValue([]),
      saveTorrents: vi.fn(),
    };
    engine = new TorrentEngine(mockStore, { dht: false }); // disable dht for unit test
  });

  it('initializes with empty torrent list', () => {
    const summary = engine.getAllTorrentsSummary();
    expect(summary).toEqual([]);
  });

  it('calculates global stats accurately', () => {
    const stats = engine.getGlobalStats();
    expect(stats.downloadSpeed).toBe(0);
    expect(stats.uploadSpeed).toBe(0);
    expect(stats.activeCount).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/torrentEngine.test.js`
Expected: FAIL ("Cannot find module '../src/main/torrentEngine.js'")

- [ ] **Step 3: Implement `TorrentEngine` and `preload.js`**
Manage WebTorrent instance lifecycle, event mapping (`metadata`, `download`, `upload`, `done`, `wire`), selective file downloading, and secure contextBridge API.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/torrentEngine.test.js`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/main/torrentEngine.js src/preload/preload.js tests/torrentEngine.test.js
git commit -m "feat: implement WebTorrent engine manager and IPC preload bridge"
```

---

### Task 5: Electron Main Process & Native Shell Integration

**Files:**
- Create: `src/main/main.js`
- Test: `tests/mainProcess.test.js`

**Interfaces:**
- Consumes: `electron` (`app`, `BrowserWindow`, `ipcMain`, `dialog`, `shell`), `TorrentEngine`, `Store`.
- Produces: Electron entry point starting the app window, registering IPC event handlers for file dialogs, system shell opening, and window controls.

- [ ] **Step 1: Write unit test verifying IPC handlers registration**
```javascript
// tests/mainProcess.test.js
import { describe, it, expect, vi } from 'vitest';
import { registerIpcHandlers } from '../src/main/ipcHandlers.js';

describe('IPC Handlers', () => {
  it('registers all required torrent and shell IPC channels', () => {
    const ipcMain = { handle: vi.fn(), on: vi.fn() };
    const mockEngine = {};
    const mockStore = {};
    registerIpcHandlers(ipcMain, mockEngine, mockStore);

    const registered = ipcMain.handle.mock.calls.map(call => call[0]);
    expect(registered).toContain('torrent:add');
    expect(registered).toContain('torrent:pause');
    expect(registered).toContain('torrent:resume');
    expect(registered).toContain('torrent:remove');
    expect(registered).toContain('settings:get');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/mainProcess.test.js`
Expected: FAIL ("Cannot find module '../src/main/ipcHandlers.js'")

- [ ] **Step 3: Implement `ipcHandlers.js` and `main.js`**
Wire IPC channels to `TorrentEngine`, wire native file pickers (`dialog.showOpenDialog`) for `.torrent` files and download folders, and launch the BrowserWindow.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/mainProcess.test.js`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/main/ipcHandlers.js src/main/main.js tests/mainProcess.test.js
git commit -m "feat: register IPC channels and configure Electron main window"
```

---

### Task 6: UI Component - Toolbar, Sidebar Filters & Modals

**Files:**
- Create: `src/renderer/components/Toolbar.jsx`
- Create: `src/renderer/components/Sidebar.jsx`
- Create: `src/renderer/components/AddMagnetModal.jsx`
- Create: `src/renderer/components/SettingsModal.jsx`
- Test: `tests/uiComponents.test.jsx`

**Interfaces:**
- Consumes: React, Lucide icons, `parseTorrentInput`.
- Produces: 
  - `Toolbar`: Action buttons (Add File, Add Magnet, Pause, Resume, Delete, Open Folder, Settings).
  - `Sidebar`: Category list with badge counters (All, Downloading, Seeding, Completed, Active, Inactive).
  - `AddMagnetModal`: Magnet/URL input with validation.
  - `SettingsModal`: Download path selector and concurrency limits.

- [ ] **Step 1: Write component tests**
```javascript
// tests/uiComponents.test.jsx
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { Sidebar } from '../src/renderer/components/Sidebar.jsx';

describe('Sidebar', () => {
  it('renders status filter categories with correct counts', () => {
    const counts = { all: 5, downloading: 2, seeding: 1, completed: 2, active: 3, inactive: 2 };
    render(<Sidebar activeFilter="all" onSelectFilter={() => {}} counts={counts} />);
    expect(screen.getByText('All')).toBeDefined();
    expect(screen.getByText('Downloading')).toBeDefined();
    expect(screen.getByText('5')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/uiComponents.test.jsx`
Expected: FAIL (modules not found)

- [ ] **Step 3: Implement Toolbar, Sidebar, AddMagnetModal, and SettingsModal**
Style with Tailwind CSS using an authentic uTorrent dark theme palette.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/uiComponents.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/renderer/components/ tests/uiComponents.test.jsx
git commit -m "feat: build toolbar, sidebar filters, and modal dialogs"
```

---

### Task 7: UI Component - Torrent Data Table & Context Menu

**Files:**
- Create: `src/renderer/components/TorrentTable.jsx`
- Test: `tests/torrentTable.test.jsx`

**Interfaces:**
- Consumes: Torrent summaries array, selection state, actions (`onPause`, `onResume`, `onRemove`, `onOpenFolder`).
- Produces: Data grid table with sorting, progress bar, right-click context menu, and keyboard shortcuts (Delete, Spacebar to pause/resume).

- [ ] **Step 1: Write component test for TorrentTable**
```javascript
// tests/torrentTable.test.jsx
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { TorrentTable } from '../src/renderer/components/TorrentTable.jsx';

describe('TorrentTable', () => {
  it('renders torrent row items with progress and speed', () => {
    const mockTorrents = [{
      infoHash: 'hash1',
      name: 'linux-mint.iso',
      length: 2500000000,
      progress: 0.75,
      status: 'downloading',
      downloadSpeed: 5242880,
      uploadSpeed: 512000,
      timeRemaining: 180,
      numPeers: 32,
    }];
    render(<TorrentTable torrents={mockTorrents} selectedHash="hash1" onSelect={() => {}} />);
    expect(screen.getByText('linux-mint.iso')).toBeDefined();
    expect(screen.getByText('75%')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/torrentTable.test.jsx`
Expected: FAIL

- [ ] **Step 3: Implement `TorrentTable.jsx`**
Build responsive data grid with status indicators, color-coded progress bars, column sorting, and custom context menu.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/torrentTable.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/renderer/components/TorrentTable.jsx tests/torrentTable.test.jsx
git commit -m "feat: implement torrent table with progress indicators and context menu"
```

---

### Task 8: UI Component - Detail Inspector (General, Files, Trackers, Peers, Speed Graph)

**Files:**
- Create: `src/renderer/components/DetailInspector.jsx`
- Create: `src/renderer/components/SpeedGraph.jsx`
- Test: `tests/detailInspector.test.jsx`

**Interfaces:**
- Consumes: Selected torrent object, speed history array.
- Produces: Bottom multi-tab panel with:
  - *General*: Hash, piece count, completion graphic, folder path, total downloaded/uploaded.
  - *Files*: Multi-file tree with checkboxes to enable/disable downloading individual files.
  - *Trackers*: Announce URLs and tier status.
  - *Peers*: Peer IP addresses, client software, flags, and speeds.
  - *Speed Graph*: Canvas/SVG real-time dual-line chart (Download / Upload).

- [ ] **Step 1: Write component test for DetailInspector tabs**
```javascript
// tests/detailInspector.test.jsx
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { DetailInspector } from '../src/renderer/components/DetailInspector.jsx';

describe('DetailInspector', () => {
  it('renders all tab headers', () => {
    render(<DetailInspector torrent={null} speedHistory={[]} onToggleFile={() => {}} />);
    expect(screen.getByText('General')).toBeDefined();
    expect(screen.getByText('Files')).toBeDefined();
    expect(screen.getByText('Trackers')).toBeDefined();
    expect(screen.getByText('Peers')).toBeDefined();
    expect(screen.getByText('Speed Graph')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/detailInspector.test.jsx`
Expected: FAIL

- [ ] **Step 3: Implement `DetailInspector.jsx` and `SpeedGraph.jsx`**
Implement the tabs and interactive file prioritization checkboxes.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/detailInspector.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/renderer/components/DetailInspector.jsx src/renderer/components/SpeedGraph.jsx tests/detailInspector.test.jsx
git commit -m "feat: implement tabbed detail inspector with files tree and speed graph"
```

---

### Task 9: Main App Integration & Status Bar

**Files:**
- Create: `src/renderer/App.jsx`
- Create: `src/renderer/main.jsx`
- Create: `src/renderer/components/StatusBar.jsx`
- Test: `tests/appIntegration.test.jsx`

**Interfaces:**
- Consumes: All UI components, `window.torrentAPI`.
- Produces: Complete working desktop application view with live IPC subscriptions and bottom global status bar (Global Down/Up speeds, DHT nodes, total torrents).

- [ ] **Step 1: Write integration test for App state wiring**
```javascript
// tests/appIntegration.test.jsx
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import App from '../src/renderer/App.jsx';

describe('App Integration', () => {
  it('mounts cleanly and displays empty state prompt', () => {
    window.torrentAPI = {
      onTorrentUpdate: vi.fn(),
      onStatsUpdate: vi.fn(),
      getSettings: vi.fn().mockResolvedValue({ downloadPath: 'C:\\Downloads' }),
    };
    render(<App />);
    expect(screen.getByText(/No torrents added/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/appIntegration.test.jsx`
Expected: FAIL

- [ ] **Step 3: Implement `App.jsx`, `main.jsx`, and `StatusBar.jsx`**
Wire live updates from `window.torrentAPI.onTorrentUpdate` and `onStatsUpdate`, implement filter selection, modals trigger, drag-and-drop file adding on the window, and keyboard shortcuts.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/appIntegration.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/renderer/App.jsx src/renderer/main.jsx src/renderer/components/StatusBar.jsx tests/appIntegration.test.jsx
git commit -m "feat: integrate main application layout, status bar, and IPC listeners"
```

---

### Task 10: End-to-End Verification & Desktop Packaging

**Files:**
- Modify: `package.json`
- Test: Full test suite run (`npm test`) and production build verification (`npm run build`)

- [ ] **Step 1: Execute full test suite**
Run: `npm test`
Expected: All tests pass across configuration, formatters, store, engine, and UI components.

- [ ] **Step 2: Build desktop production bundle**
Run: `npm run build`
Expected: Vite builds renderer assets, and Electron bundle passes without errors.

- [ ] **Step 3: Verification with real torrent magnet test**
Test adding a known legal public torrent (e.g. Ubuntu ISO or canonical torrent test) in the sandbox/dev environment.

- [ ] **Step 4: Commit**
```bash
git add .
git commit -m "chore: verify test suite and package desktop app"
```
