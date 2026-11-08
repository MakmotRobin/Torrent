import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Toolbar } from './components/Toolbar.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { TorrentTable } from './components/TorrentTable.jsx';
import { DetailInspector } from './components/DetailInspector.jsx';
import { StatusBar } from './components/StatusBar.jsx';
import { AddMagnetModal } from './components/AddMagnetModal.jsx';
import { SettingsModal } from './components/SettingsModal.jsx';

/**
 * Main application component.
 * Integrates IPC listeners, filter state, selection, modals, toolbar,
 * detail inspector, status bar, and drag-and-drop file adding.
 */
export function App() {
  const [torrents, setTorrents] = useState([]);
  const [stats, setStats] = useState({ downloadSpeed: 0, uploadSpeed: 0, dhtNodes: 0 });
  const [speedHistory, setSpeedHistory] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedHash, setSelectedHash] = useState(null);
  const [settings, setSettings] = useState(null);

  // Modals state
  const [isAddMagnetOpen, setIsAddMagnetOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // 1. Subscribe to live IPC events & load initial settings
  useEffect(() => {
    const api = window.torrentAPI;
    if (!api) return;

    // Load initial settings
    if (api.getSettings) {
      api.getSettings().then((s) => {
        if (s) setSettings(s);
      }).catch(() => {});
    }

    // Immediately fetch initial torrent list
    if (api.getAllTorrents) {
      api.getAllTorrents().then((initialTorrents) => {
        if (Array.isArray(initialTorrents) && initialTorrents.length > 0) {
          setTorrents(initialTorrents);
        }
      }).catch(() => {});
    }

    // Subscribe to torrent updates
    let unsubTorrents = () => {};
    if (api.onTorrentUpdate) {
      unsubTorrents = api.onTorrentUpdate((updatedTorrents) => {
        setTorrents(Array.isArray(updatedTorrents) ? updatedTorrents : []);
      }) || (() => {});
    }

    // Subscribe to stats updates and maintain 60s history
    let unsubStats = () => {};
    if (api.onStatsUpdate) {
      unsubStats = api.onStatsUpdate((updatedStats) => {
        if (!updatedStats) return;
        setStats(updatedStats);
        setSpeedHistory((prev) => {
          const next = [
            ...prev,
            {
              downloadSpeed: updatedStats.downloadSpeed || 0,
              uploadSpeed: updatedStats.uploadSpeed || 0,
              timestamp: Date.now(),
            },
          ];
          return next.slice(-60); // Keep last 60 ticks
        });
      }) || (() => {});
    }

    return () => {
      unsubTorrents();
      unsubStats();
    };
  }, []);

  // 2. Drag & Drop handling for .torrent files or magnet strings
  useEffect(() => {
    const handleDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
      setIsDragOver(true);
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      // Only reset if leaving window
      if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
        setIsDragOver(false);
      }
    };

    const handleDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const api = window.torrentAPI;
      if (!api?.addTorrent) return;

      // Handle dropped files
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const path = file.path || file.name;
          if (path) {
            api.addTorrent(path);
          }
        }
        return;
      }

      // Handle dropped text (magnet or hash)
      const text =
        e.dataTransfer?.getData('text/plain') ||
        e.dataTransfer?.getData('text/uri-list') ||
        '';
      const trimmed = text.trim();
      if (trimmed) {
        api.addTorrent(trimmed);
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  // 3. Category counts for Sidebar
  const counts = useMemo(() => {
    const res = {
      all: torrents.length,
      downloading: 0,
      seeding: 0,
      completed: 0,
      active: 0,
      inactive: 0,
    };

    for (const t of torrents) {
      const isPaused = Boolean(t.paused || t.status === 'paused');
      const isDone = t.status === 'completed' || (t.progress != null && t.progress >= 1);
      const isDownloading = t.status === 'downloading';
      const isSeeding = t.status === 'seeding';
      const isActive =
        !isPaused &&
        (isDownloading ||
          isSeeding ||
          (t.downloadSpeed && t.downloadSpeed > 0) ||
          (t.uploadSpeed && t.uploadSpeed > 0));

      if (isDownloading) res.downloading++;
      if (isSeeding) res.seeding++;
      if (isDone) res.completed++;
      if (isActive) res.active++;
      else res.inactive++;
    }

    return res;
  }, [torrents]);

  // 4. Filtered torrents based on activeFilter
  const filteredTorrents = useMemo(() => {
    switch (activeFilter) {
      case 'downloading':
        return torrents.filter((t) => t.status === 'downloading');
      case 'seeding':
        return torrents.filter((t) => t.status === 'seeding');
      case 'completed':
        return torrents.filter((t) => t.status === 'completed' || (t.progress != null && t.progress >= 1));
      case 'active':
        return torrents.filter((t) => {
          if (t.paused || t.status === 'paused') return false;
          return (
            t.status === 'downloading' ||
            t.status === 'seeding' ||
            (t.downloadSpeed && t.downloadSpeed > 0) ||
            (t.uploadSpeed && t.uploadSpeed > 0)
          );
        });
      case 'inactive':
        return torrents.filter((t) => {
          if (t.paused || t.status === 'paused') return true;
          return (
            (!t.downloadSpeed || t.downloadSpeed === 0) &&
            (!t.uploadSpeed || t.uploadSpeed === 0) &&
            t.status !== 'downloading' &&
            t.status !== 'seeding'
          );
        });
      case 'all':
      default:
        return torrents;
    }
  }, [torrents, activeFilter]);

  // 5. Selected torrent object
  const selectedTorrent = useMemo(() => {
    if (!selectedHash) return null;
    return torrents.find((t) => t.infoHash === selectedHash) || null;
  }, [torrents, selectedHash]);

  // 6. Action Handlers
  const handleAddTorrentFile = useCallback(async () => {
    const api = window.torrentAPI;
    if (!api?.selectTorrentFile || !api?.addTorrent) return;
    try {
      const filePath = await api.selectTorrentFile();
      if (filePath) {
        await api.addTorrent(filePath);
      }
    } catch {
      // ignore user cancel
    }
  }, []);

  const handleAddMagnet = useCallback((source) => {
    if (source && window.torrentAPI?.addTorrent) {
      window.torrentAPI.addTorrent(source);
    }
  }, []);

  const handleResume = useCallback((hash) => {
    const targetHash = hash || selectedHash;
    if (targetHash && window.torrentAPI?.resumeTorrent) {
      window.torrentAPI.resumeTorrent(targetHash);
    }
  }, [selectedHash]);

  const handlePause = useCallback((hash) => {
    const targetHash = hash || selectedHash;
    if (targetHash && window.torrentAPI?.pauseTorrent) {
      window.torrentAPI.pauseTorrent(targetHash);
    }
  }, [selectedHash]);

  const handleDelete = useCallback((optionsOrHash, maybeOptions) => {
    let hash = selectedHash;
    let deleteFiles = false;

    if (typeof optionsOrHash === 'string') {
      hash = optionsOrHash;
      deleteFiles = Boolean(maybeOptions?.deleteFiles);
    } else if (optionsOrHash && typeof optionsOrHash === 'object') {
      deleteFiles = Boolean(optionsOrHash.deleteFiles);
    }

    if (hash && window.torrentAPI?.removeTorrent) {
      window.torrentAPI.removeTorrent(hash, deleteFiles);
    }
  }, [selectedHash]);

  const handleOpenFolder = useCallback((hash) => {
    const targetHash = hash || selectedHash;
    if (targetHash && window.torrentAPI?.openDownloadFolder) {
      window.torrentAPI.openDownloadFolder(targetHash);
    }
  }, [selectedHash]);

  const handleSaveSettings = useCallback(async (updatedSettings) => {
    if (!window.torrentAPI?.saveSettings) return;
    try {
      await window.torrentAPI.saveSettings(updatedSettings);
      setSettings(updatedSettings);
    } catch {
      // ignore
    }
  }, []);

  const handleBrowseDirectory = useCallback(async () => {
    if (!window.torrentAPI?.selectDownloadDirectory) return null;
    return window.torrentAPI.selectDownloadDirectory();
  }, []);

  const handleFilePriorityToggle = useCallback((fileIndex, priority) => {
    if (selectedHash && window.torrentAPI?.setFilePriority) {
      window.torrentAPI.setFilePriority(selectedHash, fileIndex, priority);
    }
  }, [selectedHash]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#1e1e1e] text-zinc-100 select-none relative">
      {/* Top Action Toolbar */}
      <Toolbar
        onAddTorrent={handleAddTorrentFile}
        onAddMagnet={() => setIsAddMagnetOpen(true)}
        onResume={() => handleResume()}
        onPause={() => handlePause()}
        onDelete={(opts) => handleDelete(opts)}
        onOpenFolder={() => handleOpenFolder()}
        onOpenSettings={() => setIsSettingsOpen(true)}
        selectedTorrent={selectedTorrent}
        hasSelection={Boolean(selectedTorrent)}
      />

      {/* Main Workspace Area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Sidebar Filters */}
        <Sidebar
          activeFilter={activeFilter}
          onSelectFilter={setActiveFilter}
          counts={counts}
        />

        {/* Center/Right Table and Inspector */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Upper: Torrents List Table */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <TorrentTable
              torrents={filteredTorrents}
              selectedHash={selectedHash}
              onSelect={(hash) => setSelectedHash(hash)}
              onPause={handlePause}
              onResume={handleResume}
              onRemove={(hash, opts) => handleDelete(hash, opts)}
              onDelete={(hash, opts) => handleDelete(hash, opts)}
              onOpenFolder={handleOpenFolder}
            />
          </div>

          {/* Lower: Detail Inspector Panel */}
          <DetailInspector
            torrent={selectedTorrent}
            speedHistory={speedHistory}
            onToggleFile={handleFilePriorityToggle}
          />
        </main>
      </div>

      {/* Bottom Global Status Bar */}
      <StatusBar
        stats={stats}
        torrents={torrents}
        isOnline={true}
      />

      {/* Add Magnet Modal */}
      <AddMagnetModal
        isOpen={isAddMagnetOpen}
        onClose={() => setIsAddMagnetOpen(false)}
        onAdd={handleAddMagnet}
        defaultDownloadPath={settings?.downloadPath}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings || {}}
        onSave={handleSaveSettings}
        onBrowseDirectory={handleBrowseDirectory}
      />

      {/* Drag & Drop Visual Overlay */}
      {isDragOver && (
        <div className="fixed inset-0 z-50 pointer-events-none bg-sky-600/20 backdrop-blur-xs border-2 border-dashed border-sky-400 flex items-center justify-center animate-in fade-in duration-100">
          <div className="bg-[#1e1e1e]/90 border border-sky-400/80 px-6 py-4 rounded-lg shadow-2xl text-center">
            <p className="text-sm font-semibold text-sky-300">Drop .torrent file or magnet link here</p>
            <p className="text-xs text-zinc-400 mt-1">Download will be added automatically</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
