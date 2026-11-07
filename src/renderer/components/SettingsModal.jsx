import React, { useState, useEffect } from 'react';
import { X, Settings, Folder, HardDrive, Gauge, Shield } from 'lucide-react';

/**
 * Settings and preferences dialog for download directories, concurrency, and bandwidth.
 *
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {object} [props.settings]
 * @param {(updatedSettings: object) => void} props.onSave
 * @param {() => Promise<string|null>|string|null} [props.onBrowseDirectory]
 */
export function SettingsModal({
  isOpen,
  onClose,
  settings = {},
  onSave,
  onBrowseDirectory,
}) {
  const [downloadPath, setDownloadPath] = useState('');
  const [maxActiveDownloads, setMaxActiveDownloads] = useState(5);
  const [downloadSpeedLimit, setDownloadSpeedLimit] = useState(0);
  const [uploadSpeedLimit, setUploadSpeedLimit] = useState(0);
  const [port, setPort] = useState(6881);

  useEffect(() => {
    if (isOpen && settings) {
      setDownloadPath(settings.downloadPath || '');
      setMaxActiveDownloads(settings.maxActiveDownloads ?? 5);
      setDownloadSpeedLimit(settings.downloadSpeedLimit ?? 0);
      setUploadSpeedLimit(settings.uploadSpeedLimit ?? 0);
      setPort(settings.port ?? 6881);
    }
  }, [settings, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleBrowse = async () => {
    if (!onBrowseDirectory) return;
    try {
      const selected = await onBrowseDirectory();
      if (selected) {
        setDownloadPath(selected);
      }
    } catch {
      // ignore dialog cancellation
    }
  };

  const handleSave = (e) => {
    e?.preventDefault();
    const updated = {
      downloadPath: downloadPath.trim(),
      maxActiveDownloads: Math.max(1, parseInt(maxActiveDownloads, 10) || 5),
      downloadSpeedLimit: Math.max(0, parseInt(downloadSpeedLimit, 10) || 0),
      uploadSpeedLimit: Math.max(0, parseInt(uploadSpeedLimit, 10) || 0),
      port: Math.max(1, Math.min(65535, parseInt(port, 10) || 6881)),
    };
    onSave?.(updated);
    onClose?.();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    >
      <div className="bg-[#252526] border border-[#333333] rounded-md shadow-2xl w-full max-w-xl text-zinc-100 overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#1e1e1e] border-b border-[#333333] shrink-0">
          <div className="flex items-center space-x-2">
            <Settings className="w-4 h-4 text-zinc-300" />
            <h2 className="text-sm font-semibold text-white">Preferences</h2>
          </div>
          <button
            type="button"
            title="Close"
            aria-label="Close"
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSave} className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Storage Section */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-sky-400">
              <Folder className="w-3.5 h-3.5" />
              <span>Directories</span>
            </div>
            <div>
              <label
                htmlFor="download-path-input"
                className="block text-xs font-medium text-zinc-300 mb-1"
              >
                Default download directory:
              </label>
              <div className="flex items-center space-x-2">
                <input
                  id="download-path-input"
                  type="text"
                  value={downloadPath}
                  onChange={(e) => setDownloadPath(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs bg-[#1e1e1e] border border-[#333333] rounded text-zinc-100 font-mono focus:border-[#007acc] focus:outline-none"
                  placeholder="C:\Downloads"
                />
                <button
                  type="button"
                  onClick={handleBrowse}
                  className="px-3 py-1.5 text-xs text-zinc-200 bg-[#333333] hover:bg-[#444444] rounded border border-transparent transition-colors font-medium shrink-0"
                >
                  Browse...
                </button>
              </div>
            </div>
          </div>

          <div className="h-px bg-[#333333]" />

          {/* Queue & Concurrency */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
              <HardDrive className="w-3.5 h-3.5" />
              <span>Queueing & Active Torrents</span>
            </div>
            <div>
              <label
                htmlFor="max-active-downloads-input"
                className="block text-xs font-medium text-zinc-300 mb-1"
              >
                Maximum active downloads:
              </label>
              <input
                id="max-active-downloads-input"
                type="number"
                min="1"
                max="50"
                value={maxActiveDownloads}
                onChange={(e) => setMaxActiveDownloads(e.target.value)}
                className="w-32 px-3 py-1.5 text-xs bg-[#1e1e1e] border border-[#333333] rounded text-zinc-100 font-mono focus:border-[#007acc] focus:outline-none"
              />
              <p className="text-[11px] text-zinc-400 mt-1">
                Specifies how many torrents can actively download simultaneously.
              </p>
            </div>
          </div>

          <div className="h-px bg-[#333333]" />

          {/* Bandwidth Limits */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              <Gauge className="w-3.5 h-3.5" />
              <span>Bandwidth Limits</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="download-speed-limit-input"
                  className="block text-xs font-medium text-zinc-300 mb-1"
                >
                  Maximum download speed (KB/s, 0 = unlimited):
                </label>
                <input
                  id="download-speed-limit-input"
                  type="number"
                  min="0"
                  step="50"
                  value={downloadSpeedLimit}
                  onChange={(e) => setDownloadSpeedLimit(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-[#1e1e1e] border border-[#333333] rounded text-zinc-100 font-mono focus:border-[#007acc] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="upload-speed-limit-input"
                  className="block text-xs font-medium text-zinc-300 mb-1"
                >
                  Maximum upload speed (KB/s, 0 = unlimited):
                </label>
                <input
                  id="upload-speed-limit-input"
                  type="number"
                  min="0"
                  step="50"
                  value={uploadSpeedLimit}
                  onChange={(e) => setUploadSpeedLimit(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-[#1e1e1e] border border-[#333333] rounded text-zinc-100 font-mono focus:border-[#007acc] focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-[#333333]" />

          {/* Connection */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-purple-400">
              <Shield className="w-3.5 h-3.5" />
              <span>Network Connection</span>
            </div>
            <div>
              <label
                htmlFor="port-input"
                className="block text-xs font-medium text-zinc-300 mb-1"
              >
                Incoming TCP/UDP port:
              </label>
              <input
                id="port-input"
                type="number"
                min="1024"
                max="65535"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="w-32 px-3 py-1.5 text-xs bg-[#1e1e1e] border border-[#333333] rounded text-zinc-100 font-mono focus:border-[#007acc] focus:outline-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-2 pt-4 border-t border-[#333333]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-zinc-700/60 rounded border border-[#333333] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSave}
              className="px-4 py-1.5 text-xs font-medium text-white bg-[#094771] hover:bg-[#007acc] rounded transition-colors"
            >
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SettingsModal;
