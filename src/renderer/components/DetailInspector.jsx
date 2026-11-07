import React, { useState } from 'react';
import {
  Info,
  Files,
  Radio,
  Users,
  Activity,
  ChevronDown,
  ChevronUp,
  HardDrive,
  Clock,
  ArrowDownCircle,
  ArrowUpCircle,
  Share2,
} from 'lucide-react';
import { formatBytes, formatSpeed, formatETA } from '../../shared/formatters.js';
import { SpeedGraph } from './SpeedGraph.jsx';

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
 * Format ratio to 2 decimals.
 * @param {number} ratio
 * @returns {string}
 */
function formatRatio(ratio) {
  if (!Number.isFinite(ratio) || ratio <= 0) return '0.00';
  return Number(ratio).toFixed(2);
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

const TABS = [
  { id: 'general', label: 'General', icon: Info },
  { id: 'files', label: 'Files', icon: Files },
  { id: 'trackers', label: 'Trackers', icon: Radio },
  { id: 'peers', label: 'Peers', icon: Users },
  { id: 'speed', label: 'Speed Graph', icon: Activity },
];

/**
 * DetailInspector component for viewing torrent metadata, files tree, trackers, peers, and speed graph.
 *
 * @param {object} props
 * @param {object|null} props.torrent - Selected torrent summary
 * @param {Array<object>} [props.speedHistory] - Speed points array
 * @param {Function} [props.onToggleFile] - (fileIndex: number, priority: string) => void
 * @param {boolean} [props.isCollapsed] - Controlled collapsed state
 * @param {Function} [props.onToggleCollapse] - Callback when collapse/expand button clicked
 */
export function DetailInspector({
  torrent = null,
  speedHistory = [],
  onToggleFile = () => {},
  isCollapsed: controlledCollapsed,
  onToggleCollapse,
}) {
  const [activeTab, setActiveTab] = useState('general');
  const [internalCollapsed, setInternalCollapsed] = useState(false);

  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const handleToggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse(!isCollapsed);
    } else {
      setInternalCollapsed((prev) => !prev);
    }
  };

  return (
    <div className="flex flex-col border-t border-slate-800 bg-slate-900 text-slate-200 shadow-inner select-none transition-all duration-150">
      {/* Inspector Header / Tabs bar */}
      <div className="flex items-center justify-between px-2 bg-slate-950/70 border-b border-slate-800 text-xs">
        <div className="flex items-center space-x-1" role="tablist">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (isCollapsed) {
                    handleToggleCollapse();
                  }
                }}
                className={`flex items-center space-x-1.5 px-3 py-2 font-medium border-b-2 transition-colors duration-150 ${
                  isActive
                    ? 'border-emerald-500 text-emerald-400 bg-slate-900/60'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          aria-label={isCollapsed ? 'Expand inspector' : 'Collapse inspector'}
          onClick={handleToggleCollapse}
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded transition-colors"
          title={isCollapsed ? 'Expand panel' : 'Collapse panel'}
        >
          {isCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Collapsible Panel Content */}
      {!isCollapsed && (
        <div className="h-60 overflow-y-auto overflow-x-hidden bg-slate-900/80">
          {/* General Tab */}
          {activeTab === 'general' && (
            <div role="tabpanel" className="p-4 space-y-4">
              {!torrent ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs">
                  <Info className="w-8 h-8 mb-2 stroke-slate-600" />
                  <p>No torrent selected. Select a torrent from the list to view its details.</p>
                </div>
              ) : (
                <div className="space-y-4 text-xs">
                  {/* Visual Completion Graphic / Piece Visualizer */}
                  <div className="p-3 bg-slate-950/60 rounded border border-slate-800/80 space-y-2">
                    <div className="flex justify-between items-center text-slate-400">
                      <span className="font-semibold text-slate-300">Completion</span>
                      <span className="font-mono text-emerald-400 font-bold">{formatPercentage(torrent.progress)}</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, (torrent.progress || 0) * 100))}%` }}
                      />
                    </div>

                    {/* Pieces Distribution Visualizer */}
                    {Array.isArray(torrent.pieces) && torrent.pieces.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <div className="text-[10px] text-slate-500 flex justify-between">
                          <span>Piece Map ({torrent.pieces.filter(Boolean).length} / {torrent.pieces.length} verified)</span>
                          <span>{torrent.numPieces || torrent.pieces.length} pieces</span>
                        </div>
                        <div className="flex h-3 w-full gap-px rounded overflow-hidden bg-slate-900 border border-slate-800 p-0.5">
                          {torrent.pieces.slice(0, 80).map((completed, idx) => (
                            <div
                              key={idx}
                              className={`flex-1 h-full rounded-xs transition-colors ${
                                completed ? 'bg-emerald-400' : 'bg-slate-800'
                              }`}
                              title={`Piece #${idx}: ${completed ? 'Completed' : 'Pending'}`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {/* Transfer Card */}
                    <div className="p-3 bg-slate-950/50 rounded border border-slate-800/70 space-y-1.5">
                      <div className="flex items-center space-x-1.5 font-semibold text-slate-300 border-b border-slate-800 pb-1 mb-1.5">
                        <ArrowDownCircle className="w-3.5 h-3.5 text-sky-400" />
                        <span>Transfer</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Downloaded:</span>
                        <span className="font-mono text-slate-200">{formatBytes(torrent.downloaded || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Uploaded:</span>
                        <span className="font-mono text-slate-200">{formatBytes(torrent.uploaded || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Download Speed:</span>
                        <span className="font-mono text-sky-400">{formatSpeed(torrent.downloadSpeed || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Upload Speed:</span>
                        <span className="font-mono text-emerald-400">{formatSpeed(torrent.uploadSpeed || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Share Ratio:</span>
                        <span className="font-mono text-slate-200">{formatRatio(torrent.ratio)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">ETA / Remaining:</span>
                        <span className="font-mono text-slate-200">{formatETA(torrent.timeRemaining)}</span>
                      </div>
                    </div>

                    {/* Information Card */}
                    <div className="p-3 bg-slate-950/50 rounded border border-slate-800/70 space-y-1.5">
                      <div className="flex items-center space-x-1.5 font-semibold text-slate-300 border-b border-slate-800 pb-1 mb-1.5">
                        <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                        <span>Information</span>
                      </div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-slate-400 shrink-0">Total Size:</span>
                        <span className="font-mono text-slate-200 truncate">{formatBytes(torrent.length || 0)}</span>
                      </div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-slate-400 shrink-0">Pieces:</span>
                        <span className="font-mono text-slate-200 truncate">
                          {torrent.numPieces || 0}
                          {torrent.pieceLength ? ` x ${formatBytes(torrent.pieceLength)}` : ''}
                        </span>
                      </div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-slate-400 shrink-0">Save Path:</span>
                        <span className="font-mono text-slate-200 text-right truncate" title={torrent.path}>
                          {torrent.path || '—'}
                        </span>
                      </div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-slate-400 shrink-0">Hash:</span>
                        <span
                          className="font-mono text-[11px] text-slate-300 text-right truncate max-w-[200px]"
                          title={torrent.infoHash}
                        >
                          {torrent.infoHash || '—'}
                        </span>
                      </div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-slate-400 shrink-0">Status:</span>
                        <span className="font-medium text-slate-200">{formatStatus(torrent.status)}</span>
                      </div>
                    </div>

                    {/* Swarm & Time Card */}
                    <div className="p-3 bg-slate-950/50 rounded border border-slate-800/70 space-y-1.5">
                      <div className="flex items-center space-x-1.5 font-semibold text-slate-300 border-b border-slate-800 pb-1 mb-1.5">
                        <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Swarm & Time</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Connected Peers:</span>
                        <span className="font-mono text-slate-200">{torrent.numPeers ?? 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Active Files:</span>
                        <span className="font-mono text-slate-200">
                          {torrent.files ? torrent.files.filter((f) => f.selected !== false).length : 0}
                          {torrent.files ? ` / ${torrent.files.length}` : ''}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Trackers:</span>
                        <span className="font-mono text-slate-200">{torrent.trackers?.length ?? 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Added On:</span>
                        <span className="font-mono text-slate-300 text-[11px]">
                          {torrent.addedAt ? new Date(torrent.addedAt).toLocaleString() : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Files Tab */}
          {activeTab === 'files' && (
            <div role="tabpanel" className="p-2">
              {!torrent ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs">
                  <Files className="w-8 h-8 mb-2 stroke-slate-600" />
                  <p>No torrent selected.</p>
                </div>
              ) : !torrent.files || torrent.files.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs">
                  <p>No files available for this torrent.</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/60 sticky top-0">
                      <th className="py-2 px-3 w-10 text-center">#</th>
                      <th className="py-2 px-3 w-8 text-center">Get</th>
                      <th className="py-2 px-3">Name</th>
                      <th className="py-2 px-3 w-24 text-right">Size</th>
                      <th className="py-2 px-3 w-24 text-right">Done</th>
                      <th className="py-2 px-3 w-32">Progress</th>
                      <th className="py-2 px-3 w-28 text-center">Priority</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 font-mono text-[11px]">
                    {torrent.files.map((file, idx) => {
                      const fileIdx = file.index !== undefined ? file.index : idx;
                      const isSelected = file.selected !== false && file.priority !== 'dont_download';
                      const progress = file.progress ?? 0;
                      const downloadedBytes = file.downloaded ?? Math.round(progress * (file.length || 0));

                      return (
                        <tr key={fileIdx} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-1.5 px-3 text-center text-slate-500">{fileIdx + 1}</td>
                          <td className="py-1.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                const nextPriority = e.target.checked ? 'normal' : 'dont_download';
                                onToggleFile(fileIdx, nextPriority);
                              }}
                              className="rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                            />
                          </td>
                          <td className="py-1.5 px-3 text-slate-200 font-sans truncate max-w-xs" title={file.path || file.name}>
                            {file.name || file.path}
                          </td>
                          <td className="py-1.5 px-3 text-right text-slate-300">{formatBytes(file.length || 0)}</td>
                          <td className="py-1.5 px-3 text-right text-slate-400">{formatBytes(downloadedBytes)}</td>
                          <td className="py-1.5 px-3">
                            <div className="flex items-center space-x-2">
                              <div className="flex-1 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-emerald-500 h-full"
                                  style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-slate-400 w-9 text-right font-mono">
                                {formatPercentage(progress)}
                              </span>
                            </div>
                          </td>
                          <td className="py-1.5 px-3 text-center">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-sans ${
                                !isSelected
                                  ? 'bg-rose-950/60 text-rose-300 border border-rose-800/50'
                                  : file.priority === 'high'
                                  ? 'bg-amber-950/60 text-amber-300 border border-amber-800/50'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {!isSelected ? "Don't Download" : file.priority === 'high' ? 'High' : 'Normal'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Trackers Tab */}
          {activeTab === 'trackers' && (
            <div role="tabpanel" className="p-2">
              {!torrent ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs">
                  <Radio className="w-8 h-8 mb-2 stroke-slate-600" />
                  <p>No torrent selected.</p>
                </div>
              ) : !torrent.trackers || torrent.trackers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs">
                  <p>No trackers available for this torrent.</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/60 sticky top-0">
                      <th className="py-2 px-3 w-16 text-center">Tier</th>
                      <th className="py-2 px-3">Announce URL</th>
                      <th className="py-2 px-3 w-32 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 font-mono text-[11px]">
                    {torrent.trackers.map((tracker, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2 px-3 text-center text-slate-500">{tracker.tier ?? idx + 1}</td>
                        <td className="py-2 px-3 text-slate-200 select-text truncate max-w-md">
                          {tracker.announce || tracker.url}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-sans bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
                            {tracker.status || 'Working'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Peers Tab */}
          {activeTab === 'peers' && (
            <div role="tabpanel" className="p-2">
              {!torrent ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs">
                  <Users className="w-8 h-8 mb-2 stroke-slate-600" />
                  <p>No torrent selected.</p>
                </div>
              ) : !torrent.peers || torrent.peers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs">
                  <p>No connected peers for this torrent.</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/60 sticky top-0">
                      <th className="py-2 px-3 w-40">IP / Host</th>
                      <th className="py-2 px-3">Client</th>
                      <th className="py-2 px-3 w-20 text-center">Flags</th>
                      <th className="py-2 px-3 w-28 text-right">Down Speed</th>
                      <th className="py-2 px-3 w-28 text-right">Up Speed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 font-mono text-[11px]">
                    {torrent.peers.map((peer, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2 px-3 text-slate-200 select-text font-mono truncate">
                          {peer.addr || peer.ip || 'Unknown'}
                        </td>
                        <td className="py-2 px-3 text-slate-300 font-sans truncate">
                          {peer.client || 'BitTorrent Client'}
                        </td>
                        <td className="py-2 px-3 text-center text-slate-400">{peer.flags || '—'}</td>
                        <td className="py-2 px-3 text-right text-sky-400">
                          {formatSpeed(peer.downloadSpeed || 0)}
                        </td>
                        <td className="py-2 px-3 text-right text-emerald-400">
                          {formatSpeed(peer.uploadSpeed || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Speed Graph Tab */}
          {activeTab === 'speed' && (
            <div role="tabpanel" className="h-full flex flex-col">
              <SpeedGraph
                speedHistory={speedHistory}
                currentDownload={torrent?.downloadSpeed}
                currentUpload={torrent?.uploadSpeed}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DetailInspector;
