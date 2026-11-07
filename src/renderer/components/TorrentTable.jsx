import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  FolderOpen,
  Copy,
  Trash2,
  ChevronUp,
  ChevronDown,
  DownloadCloud,
} from 'lucide-react';
import { formatBytes, formatSpeed, formatETA } from '../../shared/formatters.js';

/**
 * Format progress ratio (0..1) to percentage string.
 * @param {number} progress
 * @returns {string}
 */
function formatPercentage(progress) {
  if (!Number.isFinite(progress) || progress <= 0) return '0%';
  const pct = progress * 100;
  if (pct >= 100) return '100%';
  return pct % 1 === 0 ? `${pct}%` : `${pct.toFixed(1)}%`;
}

/**
 * Format status string to capitalized display text.
 * @param {string} status
 * @returns {string}
 */
function formatStatus(status) {
  if (!status) return 'Unknown';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * Format ratio to 2 decimals.
 * @param {number} ratio
 * @returns {string}
 */
function formatRatio(ratio) {
  if (!Number.isFinite(ratio) || ratio <= 0) return '0.00';
  return Number(ratio).toFixed(2);
}

/**
 * Returns progress bar fill color according to status.
 * @param {string} status
 * @param {number} progress
 * @returns {string}
 */
function getProgressBarColor(status, progress) {
  if (status === 'error') return 'bg-rose-500';
  if (status === 'paused') return 'bg-amber-500';
  if (status === 'seeding' || status === 'completed' || progress >= 1) return 'bg-emerald-500';
  if (status === 'metadata') return 'bg-indigo-500';
  return 'bg-sky-500';
}

/**
 * Table column definitions.
 */
const COLUMNS = [
  { key: 'name', label: 'Name', align: 'left', minWidth: 'min-w-[200px]' },
  { key: 'length', label: 'Size', align: 'right', minWidth: 'min-w-[90px]' },
  { key: 'progress', label: 'Progress', align: 'left', minWidth: 'min-w-[140px]' },
  { key: 'status', label: 'Status', align: 'left', minWidth: 'min-w-[100px]' },
  { key: 'downloadSpeed', label: 'Down Speed', align: 'right', minWidth: 'min-w-[100px]' },
  { key: 'uploadSpeed', label: 'Up Speed', align: 'right', minWidth: 'min-w-[100px]' },
  { key: 'timeRemaining', label: 'ETA', align: 'right', minWidth: 'min-w-[80px]' },
  { key: 'numPeers', label: 'Seeds/Peers', align: 'right', minWidth: 'min-w-[90px]' },
  { key: 'ratio', label: 'Ratio', align: 'right', minWidth: 'min-w-[70px]' },
];

/**
 * uTorrent-style data table for torrent list with sorting, selection,
 * context menu, and keyboard navigation.
 *
 * @param {object} props
 * @param {Array<object>} props.torrents
 * @param {string|null} props.selectedHash
 * @param {(hash: string, torrent: object) => void} [props.onSelect]
 * @param {(hash: string, torrent: object) => void} [props.onPause]
 * @param {(hash: string, torrent: object) => void} [props.onResume]
 * @param {(hash: string, options: { deleteFiles: boolean }) => void} [props.onRemove]
 * @param {(hash: string, options: { deleteFiles: boolean }) => void} [props.onDelete]
 * @param {(hash: string, torrent: object) => void} [props.onOpenFolder]
 * @param {(magnetURI: string, torrent: object) => void} [props.onCopyMagnet]
 */
export function TorrentTable({
  torrents = [],
  selectedHash = null,
  onSelect,
  onPause,
  onResume,
  onRemove,
  onDelete,
  onOpenFolder,
  onCopyMagnet,
}) {
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc'); // 'asc' | 'desc'
  const [contextMenu, setContextMenu] = useState(null); // { x, y, torrent }
  const tableRef = useRef(null);

  // Close context menu on external click or escape
  useEffect(() => {
    if (!contextMenu) return;

    const handleClickOutside = (e) => {
      setContextMenu(null);
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
      }
    };

    window.addEventListener('click', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  // Handle column header click for sorting
  const handleHeaderClick = (key) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // Sort torrents based on sortKey and sortDir
  const sortedTorrents = useMemo(() => {
    if (!Array.isArray(torrents)) return [];

    return [...torrents].sort((a, b) => {
      let valA;
      let valB;

      switch (sortKey) {
        case 'name':
          valA = (a.name || '').toLowerCase();
          valB = (b.name || '').toLowerCase();
          break;
        case 'length':
          valA = a.length || a.size || 0;
          valB = b.length || b.size || 0;
          break;
        case 'progress':
          valA = a.progress || 0;
          valB = b.progress || 0;
          break;
        case 'status':
          valA = (a.status || '').toLowerCase();
          valB = (b.status || '').toLowerCase();
          break;
        case 'downloadSpeed':
          valA = a.downloadSpeed || 0;
          valB = b.downloadSpeed || 0;
          break;
        case 'uploadSpeed':
          valA = a.uploadSpeed || 0;
          valB = b.uploadSpeed || 0;
          break;
        case 'timeRemaining':
          valA = Number.isFinite(a.timeRemaining) ? a.timeRemaining : Number.MAX_SAFE_INTEGER;
          valB = Number.isFinite(b.timeRemaining) ? b.timeRemaining : Number.MAX_SAFE_INTEGER;
          break;
        case 'numPeers':
          valA = a.numPeers || 0;
          valB = b.numPeers || 0;
          break;
        case 'ratio':
          valA = a.ratio || 0;
          valB = b.ratio || 0;
          break;
        default:
          valA = a[sortKey] || 0;
          valB = b[sortKey] || 0;
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      return sortDir === 'asc' ? valA - valB : valB - valA;
    });
  }, [torrents, sortKey, sortDir]);

  // Find currently selected torrent object
  const selectedTorrent = useMemo(() => {
    if (!selectedHash) return null;
    return sortedTorrents.find((t) => t.infoHash === selectedHash) || null;
  }, [sortedTorrents, selectedHash]);

  // Handle right-click context menu
  const handleContextMenu = (e, torrent) => {
    e.preventDefault();
    e.stopPropagation();

    // Select row on right click
    if (onSelect) {
      onSelect(torrent.infoHash, torrent);
    }

    // Clamp coordinates within window
    const menuWidth = 200;
    const menuHeight = 220;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 8);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 8);

    setContextMenu({ x, y, torrent });
  };

  // Action helpers
  const handleRemoveTorrent = (torrent, deleteFiles = false) => {
    setContextMenu(null);
    if (onRemove) {
      onRemove(torrent.infoHash, { deleteFiles });
    }
    if (onDelete) {
      onDelete(torrent.infoHash, { deleteFiles });
    }
  };

  const handleCopyMagnet = (torrent) => {
    setContextMenu(null);
    const magnet = torrent.magnetURI || `magnet:?xt=urn:btih:${torrent.infoHash}`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(magnet).catch(() => {});
    }
    if (onCopyMagnet) {
      onCopyMagnet(magnet, torrent);
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!sortedTorrents.length) return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedTorrent) {
        e.preventDefault();
        handleRemoveTorrent(selectedTorrent, false);
      }
    } else if (e.key === ' ' || e.code === 'Space') {
      if (selectedTorrent) {
        e.preventDefault();
        const isPaused = Boolean(selectedTorrent.paused || selectedTorrent.status === 'paused');
        if (isPaused) {
          onResume?.(selectedTorrent.infoHash, selectedTorrent);
        } else {
          onPause?.(selectedTorrent.infoHash, selectedTorrent);
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const currentIndex = sortedTorrents.findIndex((t) => t.infoHash === selectedHash);
      if (currentIndex < sortedTorrents.length - 1) {
        const next = sortedTorrents[currentIndex + 1];
        onSelect?.(next.infoHash, next);
      } else if (currentIndex === -1 && sortedTorrents.length > 0) {
        const first = sortedTorrents[0];
        onSelect?.(first.infoHash, first);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const currentIndex = sortedTorrents.findIndex((t) => t.infoHash === selectedHash);
      if (currentIndex > 0) {
        const prev = sortedTorrents[currentIndex - 1];
        onSelect?.(prev.infoHash, prev);
      }
    }
  };

  return (
    <div
      className="flex-1 flex flex-col min-h-0 bg-[#1e1e1e] select-none outline-none overflow-hidden"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      ref={tableRef}
    >
      <div className="flex-1 overflow-auto">
        <table
          className="w-full text-xs text-left text-zinc-300 border-collapse table-fixed"
          role="table"
        >
          <thead className="bg-[#252526] sticky top-0 z-10 border-b border-[#333333] text-zinc-400 font-medium">
            <tr>
              {COLUMNS.map((col) => {
                const isSorted = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    onClick={() => handleHeaderClick(col.key)}
                    className={`py-2 px-3 cursor-pointer hover:bg-[#2d2d2d] transition-colors border-r border-[#333333] last:border-r-0 ${
                      col.minWidth
                    } ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                  >
                    <div
                      className={`inline-flex items-center space-x-1 ${
                        col.align === 'right' ? 'justify-end w-full' : ''
                      }`}
                    >
                      <span>{col.label}</span>
                      <span className="w-3.5 h-3.5 inline-flex items-center justify-center">
                        {isSorted &&
                          (sortDir === 'asc' ? (
                            <ChevronUp className="w-3.5 h-3.5 text-sky-400" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-sky-400" />
                          ))}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-[#2a2a2a]">
            {sortedTorrents.map((torrent) => {
              const isSelected = torrent.infoHash === selectedHash;
              const progressPct = torrent.progress ? Math.min(100, Math.max(0, torrent.progress * 100)) : 0;
              const barColor = getProgressBarColor(torrent.status, torrent.progress);

              return (
                <tr
                  key={torrent.infoHash}
                  role="row"
                  aria-selected={isSelected}
                  onClick={() => onSelect?.(torrent.infoHash, torrent)}
                  onDoubleClick={() => onOpenFolder?.(torrent.infoHash, torrent)}
                  onContextMenu={(e) => handleContextMenu(e, torrent)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#094771] text-white hover:bg-[#0e5687]'
                      : 'hover:bg-[#2a2d2e] text-zinc-300'
                  }`}
                >
                  {/* Name */}
                  <td className="py-2 px-3 truncate font-medium border-r border-[#2d2d2d] last:border-r-0">
                    <span title={torrent.name}>{torrent.name}</span>
                  </td>

                  {/* Size */}
                  <td className="py-2 px-3 text-right whitespace-nowrap border-r border-[#2d2d2d] last:border-r-0">
                    {formatBytes(torrent.length || torrent.size || 0)}
                  </td>

                  {/* Progress */}
                  <td className="py-2 px-3 whitespace-nowrap border-r border-[#2d2d2d] last:border-r-0">
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-zinc-800 rounded h-2.5 overflow-hidden border border-zinc-700/60 min-w-[60px]">
                        <div
                          className={`h-full transition-all duration-300 ${barColor}`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono shrink-0 w-9 text-right">
                        {formatPercentage(torrent.progress)}
                      </span>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="py-2 px-3 whitespace-nowrap border-r border-[#2d2d2d] last:border-r-0">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-medium ${
                        torrent.status === 'downloading'
                          ? 'text-sky-300 bg-sky-950/60'
                          : torrent.status === 'seeding' || torrent.status === 'completed'
                          ? 'text-emerald-300 bg-emerald-950/60'
                          : torrent.status === 'paused'
                          ? 'text-amber-300 bg-amber-950/60'
                          : torrent.status === 'error'
                          ? 'text-rose-300 bg-rose-950/60'
                          : 'text-zinc-300 bg-zinc-800'
                      }`}
                    >
                      {formatStatus(torrent.status)}
                    </span>
                  </td>

                  {/* Down Speed */}
                  <td className="py-2 px-3 text-right whitespace-nowrap font-mono border-r border-[#2d2d2d] last:border-r-0">
                    {formatSpeed(torrent.downloadSpeed)}
                  </td>

                  {/* Up Speed */}
                  <td className="py-2 px-3 text-right whitespace-nowrap font-mono border-r border-[#2d2d2d] last:border-r-0">
                    {formatSpeed(torrent.uploadSpeed)}
                  </td>

                  {/* ETA */}
                  <td className="py-2 px-3 text-right whitespace-nowrap font-mono border-r border-[#2d2d2d] last:border-r-0">
                    {formatETA(torrent.timeRemaining)}
                  </td>

                  {/* Seeds/Peers */}
                  <td className="py-2 px-3 text-right whitespace-nowrap font-mono border-r border-[#2d2d2d] last:border-r-0">
                    {torrent.numSeeds != null
                      ? `${torrent.numSeeds} (${torrent.numPeers || 0})`
                      : String(torrent.numPeers ?? 0)}
                  </td>

                  {/* Ratio */}
                  <td className="py-2 px-3 text-right whitespace-nowrap font-mono border-r border-[#2d2d2d] last:border-r-0">
                    {formatRatio(torrent.ratio)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Clean Empty State */}
        {sortedTorrents.length === 0 && (
          <div
            data-testid="empty-state"
            role="status"
            className="flex flex-col items-center justify-center p-12 text-center text-zinc-400 h-64"
          >
            <div className="p-3 rounded-full bg-zinc-800/80 text-zinc-400 mb-3 border border-zinc-700/50">
              <DownloadCloud className="w-8 h-8 text-sky-400/80" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-200">No torrents added yet</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm">
              Click Add Torrent or Add Magnet link from the toolbar above to start downloading.
            </p>
          </div>
        )}
      </div>

      {/* Right-click Context Menu */}
      {contextMenu && (
        <div
          role="menu"
          className="fixed z-50 min-w-[180px] bg-[#252526] border border-[#3c3c3c] rounded shadow-xl py-1 text-xs text-zinc-200 animate-in fade-in zoom-in-95 duration-75"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            disabled={contextMenu.torrent.paused || contextMenu.torrent.status === 'paused'}
            onClick={() => {
              setContextMenu(null);
              onPause?.(contextMenu.torrent.infoHash, contextMenu.torrent);
            }}
            className="w-full flex items-center px-3 py-1.5 text-left hover:bg-[#094771] hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <Pause className="w-3.5 h-3.5 mr-2 text-amber-400" />
            <span>Pause</span>
          </button>

          <button
            type="button"
            role="menuitem"
            disabled={!contextMenu.torrent.paused && contextMenu.torrent.status !== 'paused'}
            onClick={() => {
              setContextMenu(null);
              onResume?.(contextMenu.torrent.infoHash, contextMenu.torrent);
            }}
            className="w-full flex items-center px-3 py-1.5 text-left hover:bg-[#094771] hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <Play className="w-3.5 h-3.5 mr-2 text-emerald-400" />
            <span>Resume</span>
          </button>

          <div className="h-px bg-[#333333] my-1" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setContextMenu(null);
              onOpenFolder?.(contextMenu.torrent.infoHash, contextMenu.torrent);
            }}
            className="w-full flex items-center px-3 py-1.5 text-left hover:bg-[#094771] hover:text-white transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5 mr-2 text-amber-300" />
            <span>Open Containing Folder</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => handleCopyMagnet(contextMenu.torrent)}
            className="w-full flex items-center px-3 py-1.5 text-left hover:bg-[#094771] hover:text-white transition-colors"
          >
            <Copy className="w-3.5 h-3.5 mr-2 text-sky-400" />
            <span>Copy Magnet Link</span>
          </button>

          <div className="h-px bg-[#333333] my-1" />

          <button
            type="button"
            role="menuitem"
            onClick={() => handleRemoveTorrent(contextMenu.torrent, false)}
            className="w-full flex items-center px-3 py-1.5 text-left text-rose-300 hover:bg-rose-900/50 hover:text-white transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 mr-2 text-rose-400" />
            <span>Delete Torrent</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => handleRemoveTorrent(contextMenu.torrent, true)}
            className="w-full flex items-center px-3 py-1.5 text-left text-rose-400 font-medium hover:bg-rose-900/70 hover:text-white transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 mr-2 text-rose-400" />
            <span>Delete Torrent + Data</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default TorrentTable;
