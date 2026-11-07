import React from 'react';
import { Layers, ArrowDown, ArrowUp, CheckCircle2, Activity, Clock } from 'lucide-react';

const CATEGORIES = [
  { id: 'all', label: 'All', icon: Layers, iconColor: 'text-zinc-400 group-hover:text-zinc-200' },
  { id: 'downloading', label: 'Downloading', icon: ArrowDown, iconColor: 'text-sky-400' },
  { id: 'seeding', label: 'Seeding', icon: ArrowUp, iconColor: 'text-emerald-400' },
  { id: 'completed', label: 'Completed', icon: CheckCircle2, iconColor: 'text-emerald-500' },
  { id: 'active', label: 'Active', icon: Activity, iconColor: 'text-amber-400' },
  { id: 'inactive', label: 'Inactive', icon: Clock, iconColor: 'text-zinc-400 group-hover:text-zinc-200' },
];

/**
 * Sidebar navigation filter list with reactive counter badges.
 *
 * @param {object} props
 * @param {string} [props.activeFilter='all']
 * @param {(filterId: string) => void} props.onSelectFilter
 * @param {Record<string, number>} [props.counts={}]
 */
export function Sidebar({ activeFilter = 'all', onSelectFilter, counts = {} }) {
  return (
    <aside className="w-52 h-full bg-[#252526] border-r border-[#333333] flex flex-col select-none shrink-0">
      <div className="px-3 pt-3 pb-1.5 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
        Torrents
      </div>
      <nav className="flex-1 px-1.5 space-y-0.5">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeFilter === cat.id;
          const count = counts?.[cat.id] ?? 0;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectFilter?.(cat.id)}
              className={`w-full group flex items-center justify-between px-2.5 py-1.5 text-xs rounded transition-colors text-left ${
                isActive
                  ? 'bg-[#094771] text-white font-medium shadow-sm'
                  : 'text-zinc-300 hover:bg-[#2a2d2e] hover:text-white'
              }`}
            >
              <div className="flex items-center min-w-0">
                <Icon
                  className={`w-3.5 h-3.5 mr-2 shrink-0 ${
                    isActive ? 'text-white' : cat.iconColor
                  }`}
                />
                <span className="truncate">{cat.label}</span>
              </div>
              <span
                className={`ml-2 px-1.5 py-0.5 text-[10px] rounded-full min-w-[20px] text-center font-mono ${
                  isActive
                    ? 'bg-white/20 text-white font-semibold'
                    : 'bg-zinc-800 text-zinc-400 group-hover:text-zinc-200 group-hover:bg-zinc-700'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

export default Sidebar;
