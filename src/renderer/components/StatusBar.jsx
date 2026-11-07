import React from 'react';
import { ArrowDown, ArrowUp, Globe } from 'lucide-react';
import { formatSpeed } from '../../shared/formatters.js';

/**
 * Global application status bar at the bottom of the window.
 *
 * @param {object} props
 * @param {object} [props.stats={}] - Engine stats { downloadSpeed, uploadSpeed, dhtNodes }
 * @param {Array<object>} [props.torrents=[]] - List of all torrents
 * @param {boolean} [props.isOnline=true] - Online network status
 */
export function StatusBar({
  stats = {},
  torrents = [],
  isOnline = true,
}) {
  const downloadSpeed = stats?.downloadSpeed || 0;
  const uploadSpeed = stats?.uploadSpeed || 0;
  const dhtNodes = stats?.dhtNodes || 0;

  const totalCount = torrents?.length || 0;
  const activeCount = (torrents || []).filter((t) => {
    if (t.paused || t.status === 'paused') return false;
    return (
      t.status === 'downloading' ||
      t.status === 'seeding' ||
      (t.downloadSpeed && t.downloadSpeed > 0) ||
      (t.uploadSpeed && t.uploadSpeed > 0)
    );
  }).length;

  return (
    <footer className="h-6 bg-[#181818] border-t border-[#333333] flex items-center justify-between px-3 text-[11px] text-zinc-400 select-none shrink-0 font-mono">
      {/* Left side: Network status & Swarm info */}
      <div className="flex items-center space-x-4">
        {/* Network indicator */}
        <div className="flex items-center space-x-1.5 font-sans" title={isOnline ? 'Online - DHT active' : 'Offline'}>
          <span
            className={`w-2 h-2 rounded-full inline-block ${
              isOnline ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]' : 'bg-rose-500'
            }`}
          />
          <span className="text-zinc-300 font-medium">{isOnline ? 'Online' : 'Offline'}</span>
        </div>

        <div className="h-3 w-px bg-[#333333]" />

        {/* Connected DHT Nodes */}
        <div className="flex items-center space-x-1" title="Connected DHT Swarm Nodes">
          <Globe className="w-3 h-3 text-sky-400 shrink-0" />
          <span>DHT:</span>
          <span className="text-zinc-200">{dhtNodes} nodes</span>
        </div>

        <div className="h-3 w-px bg-[#333333]" />

        {/* Torrents Active / Total */}
        <div className="flex items-center space-x-1" title="Active / Total Torrents">
          <span>Torrents:</span>
          <span className="text-zinc-200 font-semibold">{activeCount} / {totalCount}</span>
        </div>
      </div>

      {/* Right side: Global Speeds */}
      <div className="flex items-center space-x-4">
        {/* Global Download Speed */}
        <div className="flex items-center space-x-1" title="Global Download Speed">
          <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded bg-sky-950/80 text-sky-400 border border-sky-800/40">
            <ArrowDown className="w-2.5 h-2.5" />
          </span>
          <span className="text-sky-300 font-semibold">{formatSpeed(downloadSpeed)}</span>
        </div>

        {/* Global Upload Speed */}
        <div className="flex items-center space-x-1" title="Global Upload Speed">
          <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/40">
            <ArrowUp className="w-2.5 h-2.5" />
          </span>
          <span className="text-emerald-300 font-semibold">{formatSpeed(uploadSpeed)}</span>
        </div>
      </div>
    </footer>
  );
}

export default StatusBar;
