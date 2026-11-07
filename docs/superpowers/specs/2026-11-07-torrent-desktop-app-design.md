# Design Document: uTorrent-Style Desktop Torrent Client

**Date:** 2026-11-07  
**Status:** In Review  
**Project:** Torrent Desktop App  

---

## 1. Intent & The Why
The goal is to build a reliable, user-friendly, and modern desktop application modeled after the classic **uTorrent** experience for downloading large files from the internet. The user wants the familiar control, transparency, and multi-panel layout of uTorrent (torrents table, status filters, tabbed inspection pane for peers, files, trackers, and speed) without ads, bloatware, or complex setup.

---

## 2. Goals, Non-Goals, & Anti-Goals

### Goals
- **Full BitTorrent protocol support**: Download torrents via `.torrent` files (drag-and-drop or file picker) and `magnet:` links.
- **Classic uTorrent Interface**:
  - Top action toolbar (Add File, Add Magnet, Resume, Pause, Delete, Open Folder, Settings).
  - Left filter sidebar with live count badges (All, Downloading, Seeding, Completed, Active, Inactive).
  - Main transfer list table showing Name, Size, Progress Bar (%), Status, Download Speed, Upload Speed, ETA, Seeds/Peers, and Upload Ratio.
  - Tabbed bottom detail inspector (General, Files, Trackers, Peers, Speed Graph).
  - Bottom status bar showing global download/upload speeds and swarm statistics.
- **Robust Transfer Management**:
  - Ability to pause, resume, and remove individual or all torrents.
  - Delete options: remove torrent from list vs. remove torrent and delete downloaded data files from disk.
  - Selective file downloading (for multi-file torrents, deselect unwanted files or prioritize specific files).
  - Sequential downloading toggle (allows media files to be played while downloading).
- **Persistence & Auto-Resume**:
  - Preserve download progress, torrent metadata, and app settings across application restarts.
  - Default download directory selection and configurable transfer bandwidth limits.

### Non-Goals
- Proprietary closed-source cloud relay or remote web seed subscription services.
- Bundled third-party adware, toolbars, or cryptocurrency miners.
- Complex private tracker ratio cheating scripts or unsupported custom protocol mutations.

### Anti-Goals
- Cluttered, sluggish, or fragile web wrapper interfaces that freeze during heavy disk I/O.
- Loss of download state on abrupt app termination.

---

## 3. Constraints
- **Platform**: Windows desktop environment (with cross-platform architecture).
- **Runtimes Available**: Node.js (v24.18.0) and npm (11.6.0). Cargo/Rust is not pre-installed.
- **Network**: Standard TCP/UDP BitTorrent swarms and trackers, DHT, and WebTorrent P2P.

---

## 4. Approaches Considered

### Approach 1: Electron + Node.js (WebTorrent Engine + React / Tailwind CSS UI) — *Chosen*
- **Architecture**: Electron main process runs the Node.js BitTorrent engine (`webtorrent` / `torrent-stream`), managing disk I/O, network sockets, DHT, peer connections, and state persistence. Electron renderer process renders a fast, responsive React-based uTorrent dark/light theme interface communicating via secure typed IPC channels.
- **Trade-offs**: Slightly larger binary bundle size (~80MB) compared to native C++, but instant setup, robust native cross-platform window management, high UI customizability, and full BitTorrent TCP/UDP tracker support.
- **Decision**: Selected because it provides the quickest path to a fully working, stable, and visually authentic uTorrent-style application leveraging the existing Node.js environment.

### Approach 2: Python 3.12 (PyQt6 / PySide6) + libtorrent-rasterbar
- **Trade-offs**: While Python 3.12 is installed, `libtorrent-rasterbar` binary wheels frequently have native C++ ABI mismatches on recent Windows/Python versions. Developing animated canvas-based speed graphs, responsive tables, and multi-file trees in Qt/Tkinter requires substantial manual widget engineering.
- **Decision**: Rejected due to high risk of native compilation failures and maintenance friction.

### Approach 3: C++ (Qt 6 + libtorrent-rasterbar)
- **Trade-offs**: Maximum memory efficiency and identical engine to qBittorrent, but requires MSVC toolchain, vcpkg, and compiling Boost from scratch on the target Windows system.
- **Decision**: Rejected as disproportionate overhead for rapid development.

---

## 5. System Architecture & Component Design

```
+--------------------------------------------------------------------------+
|                            RENDERER PROCESS                              |
|  +--------------------------------------------------------------------+  |
|  | React + Tailwind UI                                                |  |
|  | - Toolbar (Add, Magnet, Pause, Resume, Delete, Open Folder)        |  |
|  | - Sidebar Filter (All, Downloading, Completed, Active, etc.)       |  |
|  | - Torrents Table (Columns, sorting, right-click context menu)      |  |
|  | - Detail Panel (General, Files Tree, Trackers, Peers, Speed Graph) |  |
|  | - Modals (Add Torrent options dialog, Settings dialog)             |  |
|  +--------------------------------------------------------------------+  |
+------------------------------------▲-------------------------------------+
                                     │ IPC (ContextBridge / Preload)
+------------------------------------▼-------------------------------------+
|                              MAIN PROCESS                                |
|  +--------------------------------------------------------------------+  |
|  | Electron Application Lifecycle & Window Management                 |  |
|  +--------------------------------------------------------------------+  |
|  | Torrent Service (WebTorrent Engine)                                |  |
|  | - Magnet / .torrent parser & swarm manager                         |  |
|  | - Piece verification, chunk writing, disk storage                  |  |
|  | - Bandwidth tracking & throttle controller                         |  |
|  | - Peer & tracker discovery (DHT, UDP/HTTP trackers)                |  |
|  +--------------------------------------------------------------------+  |
|  | State Persistence Store                                            |  |
|  | - Torrent metadata, resume JSON, settings storage                  |  |
|  +--------------------------------------------------------------------+  |
|  | Native Shell Integration                                           |  |
|  | - File pickers, show-in-folder (Explorer), system tray             |  |
|  +--------------------------------------------------------------------+  |
+--------------------------------------------------------------------------+
```

### 5.1 Main Process & Torrent Engine
- **Engine**: Node.js `webtorrent` instance configured with maximum peer connections, DHT enabled, and custom download paths.
- **Storage**: Default downloads directory (`Downloads/TorrentDownloads`), configurable via Settings.
- **State Persistence**:
  - Saved in application data directory (`userData/torrents.json`).
  - Stores infoHash, name, magnet URI / torrent file path, download path, paused state, and selective file priorities.
  - On launch, active torrents are automatically reconstituted.

### 5.2 IPC API Interface (`window.torrentAPI`)
- `addTorrent(source: string | Buffer, options?: AddOptions): Promise<TorrentSummary>`
- `pauseTorrent(infoHash: string): Promise<boolean>`
- `resumeTorrent(infoHash: string): Promise<boolean>`
- `removeTorrent(infoHash: string, deleteFiles: boolean): Promise<boolean>`
- `setFilePriority(infoHash: string, fileIndex: number, priority: 'normal' | 'low' | 'dont_download'): Promise<boolean>`
- `getSettings(): Promise<AppSettings>`
- `saveSettings(settings: Partial<AppSettings>): Promise<AppSettings>`
- `openDownloadFolder(infoHash?: string): Promise<void>`
- `onTorrentUpdate(callback: (torrents: TorrentSummary[]) => void)`
- `onStatsUpdate(callback: (stats: GlobalStats) => void)`

### 5.3 UI Components (Renderer)
1. **Header Toolbar**: Clean iconography for Add `.torrent`, Add Magnet, Pause, Resume, Remove, Folder, Settings.
2. **Left Sidebar**: Filter items with reactive badge counters:
   - All
   - Downloading
   - Seeding
   - Completed
   - Paused / Inactive
3. **Torrent Table**:
   - Multi-select, sorting by column.
   - Status indicators with colored progress bars (Downloading = Blue/Cyan, Completed/Seeding = Green, Paused = Amber, Error = Red).
   - Right-click context menu (Pause, Resume, Open Containing Folder, Copy Magnet Link, Delete).
4. **Bottom Tabbed Inspector**:
   - **General**: Info hash, piece size, piece completion bar, created date, save location, total transferred.
   - **Files**: Interactive file list with checkboxes/selectors to include/exclude files and set priorities.
   - **Trackers**: Announce URLs and their connection status.
   - **Peers**: Connected IP addresses, peer client names, flags, download/upload rates.
   - **Speed**: Smooth live real-time SVG/Canvas chart of download and upload rates over the last 60 seconds.
5. **Modal Dialogs**:
   - Add Magnet Link / URL prompt.
   - Add Torrent File file-picker and pre-download file selection modal.
   - Settings dialog (Default download directory, port, max active downloads, global speed limits).

---

## 6. Resolved Builder Technical Decisions
The following implementation specifics were reviewed and settled to ensure high reliability and authentic uTorrent behavior:

1. **Magnet Link Metadata Workflow**:
   - *Decision*: When a magnet link is added, it is immediately inserted into the main torrent table with status `"Downloading Metadata"`. Once the swarm resolves the torrent info dictionary, the UI dynamically populates the file list, total size, and piece count. This avoids blocking modal dialogs while waiting for DHT peers.
2. **File Selection & Prioritization**:
   - *Decision*: File selection supports binary inclusion/exclusion (`Download` vs `Don't Download`) for individual files in multi-file torrents via `file.select()` and `file.deselect()`, along with sequential download toggles for streaming/previewing large media files.
3. **Bandwidth & Transfer Management**:
   - *Decision*: For v1, transfer management provides active download concurrency limits (max simultaneous active downloads/seeds) and peer connection caps. Real-time transfer rates are monitored via 1-second rolling averages for high accuracy in the UI and speed graphs.

---

## 7. What's Left to the Builder
- Choice of icon set (Lucide React).
- UI polling/event frequency for live peer stats (500ms–1000ms interval for smooth rendering with minimal CPU overhead).
- Formatting utilities for bytes (`formatBytes(bytes/s)`), durations (`formatETA(seconds)`), and dates.
- Styling design tokens matching a refined dark theme (classic dark slate / zinc palette).

