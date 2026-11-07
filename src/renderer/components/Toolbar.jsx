import React, { useState } from 'react';
import {
  FolderPlus,
  Link,
  Play,
  Pause,
  Trash2,
  FolderOpen,
  Settings,
  AlertTriangle,
  X,
} from 'lucide-react';

/**
 * Top toolbar with uTorrent-style quick action buttons.
 *
 * @param {object} props
 * @param {() => void} [props.onAddTorrent]
 * @param {() => void} [props.onAddFile]
 * @param {() => void} [props.onAddMagnet]
 * @param {() => void} [props.onResume]
 * @param {() => void} [props.onPause]
 * @param {(options: { deleteFiles: boolean }) => void} [props.onDelete]
 * @param {() => void} [props.onOpenFolder]
 * @param {() => void} [props.onOpenSettings]
 * @param {object|null} [props.selectedTorrent]
 * @param {boolean} [props.hasSelection]
 */
export function Toolbar({
  onAddTorrent,
  onAddFile,
  onAddMagnet,
  onResume,
  onPause,
  onDelete,
  onOpenFolder,
  onOpenSettings,
  selectedTorrent = null,
  hasSelection = !!selectedTorrent,
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleAddTorrent = () => {
    if (onAddTorrent) onAddTorrent();
    else if (onAddFile) onAddFile();
  };

  const isPaused = Boolean(selectedTorrent?.paused || selectedTorrent?.status === 'paused');
  const canResume = hasSelection && isPaused;
  const canPause = hasSelection && !isPaused;

  const handleDeleteClick = () => {
    if (!hasSelection) return;
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = (deleteFiles) => {
    setShowDeleteConfirm(false);
    onDelete?.({ deleteFiles });
  };

  return (
    <>
      <header className="h-11 bg-[#1e1e1e] border-b border-[#333333] flex items-center px-2 space-x-1 select-none shrink-0">
        <button
          type="button"
          title="Add Torrent File"
          aria-label="Add Torrent File"
          onClick={handleAddTorrent}
          className="p-1.5 rounded text-zinc-300 hover:text-white hover:bg-[#2a2d2e] active:bg-[#094771] transition-colors flex items-center justify-center"
        >
          <FolderPlus className="w-4 h-4 text-sky-400" />
        </button>

        <button
          type="button"
          title="Add Magnet Link"
          aria-label="Add Magnet Link"
          onClick={onAddMagnet}
          className="p-1.5 rounded text-zinc-300 hover:text-white hover:bg-[#2a2d2e] active:bg-[#094771] transition-colors flex items-center justify-center"
        >
          <Link className="w-4 h-4 text-emerald-400" />
        </button>

        <div className="h-4 w-px bg-[#333333] mx-1" />

        <button
          type="button"
          title="Resume Torrent"
          aria-label="Resume Torrent"
          disabled={!canResume}
          onClick={onResume}
          className="p-1.5 rounded text-zinc-300 hover:text-white hover:bg-[#2a2d2e] active:bg-[#094771] transition-colors flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-zinc-300"
        >
          <Play className="w-4 h-4 text-emerald-400" />
        </button>

        <button
          type="button"
          title="Pause Torrent"
          aria-label="Pause Torrent"
          disabled={!canPause}
          onClick={onPause}
          className="p-1.5 rounded text-zinc-300 hover:text-white hover:bg-[#2a2d2e] active:bg-[#094771] transition-colors flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-zinc-300"
        >
          <Pause className="w-4 h-4 text-amber-400" />
        </button>

        <button
          type="button"
          title="Delete Torrent"
          aria-label="Delete Torrent"
          disabled={!hasSelection}
          onClick={handleDeleteClick}
          className="p-1.5 rounded text-zinc-300 hover:text-white hover:bg-[#2a2d2e] active:bg-[#094771] transition-colors flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-zinc-300"
        >
          <Trash2 className="w-4 h-4 text-rose-400" />
        </button>

        <div className="h-4 w-px bg-[#333333] mx-1" />

        <button
          type="button"
          title="Open Containing Folder"
          aria-label="Open Containing Folder"
          disabled={!hasSelection}
          onClick={onOpenFolder}
          className="p-1.5 rounded text-zinc-300 hover:text-white hover:bg-[#2a2d2e] active:bg-[#094771] transition-colors flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-zinc-300"
        >
          <FolderOpen className="w-4 h-4 text-amber-300" />
        </button>

        <div className="flex-1" />

        <button
          type="button"
          title="Settings"
          aria-label="Settings"
          onClick={onOpenSettings}
          className="p-1.5 rounded text-zinc-300 hover:text-white hover:bg-[#2a2d2e] active:bg-[#094771] transition-colors flex items-center justify-center"
        >
          <Settings className="w-4 h-4 text-zinc-300" />
        </button>
      </header>

      {showDeleteConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
        >
          <div className="bg-[#252526] border border-[#333333] rounded-md shadow-2xl w-full max-w-md p-5 text-zinc-100 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded bg-rose-500/10 text-rose-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Remove Torrent</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {selectedTorrent?.name ? `"${selectedTorrent.name}"` : 'Selected torrent'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="text-zinc-400 hover:text-white transition-colors"
                title="Close"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-300 mt-3 leading-relaxed">
              Are you sure you want to remove this torrent? You can choose to remove only the torrent
              from your list or also permanently delete all downloaded files from disk.
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-zinc-700/60 rounded border border-[#333333] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDelete(false)}
                className="px-3 py-1.5 text-xs text-white bg-[#333333] hover:bg-[#444444] rounded font-medium transition-colors"
              >
                Remove Torrent
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDelete(true)}
                className="px-3 py-1.5 text-xs text-white bg-rose-600 hover:bg-rose-700 rounded font-medium transition-colors"
              >
                Delete Torrent + Data
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Toolbar;
