import React, { useState, useEffect } from 'react';
import { X, Link2, AlertCircle, CheckCircle } from 'lucide-react';
import { parseTorrentInput } from '../../shared/formatters.js';

/**
 * Modal dialog for inputting and validating magnet links, info-hashes, or URLs.
 *
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {(source: string) => void} props.onAdd
 * @param {string} [props.defaultDownloadPath]
 */
export function AddMagnetModal({ isOpen, onClose, onAdd, defaultDownloadPath }) {
  const [inputValue, setInputValue] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setInputValue('');
      setTouched(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const trimmed = inputValue.trim();
  const parsed = parseTorrentInput(trimmed);
  const isValid = parsed.type === 'magnet' || parsed.type === 'infohash';
  const showError = (touched || trimmed.length > 0) && trimmed.length > 0 && !isValid;

  const handleClose = () => {
    setInputValue('');
    setTouched(false);
    onClose?.();
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!isValid) {
      setTouched(true);
      return;
    }
    const submittedVal = trimmed;
    onAdd?.(submittedVal);
    setInputValue('');
    setTouched(false);
    onClose?.();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    >
      <div className="bg-[#252526] border border-[#333333] rounded-md shadow-2xl w-full max-w-lg text-zinc-100 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#1e1e1e] border-b border-[#333333]">
          <div className="flex items-center space-x-2">
            <Link2 className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white">Add Magnet Link</h2>
          </div>
          <button
            type="button"
            title="Close"
            aria-label="Close"
            onClick={handleClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label
              htmlFor="magnet-input"
              className="block text-xs font-medium text-zinc-300 mb-1.5"
            >
              Magnet link, info-hash, or URL:
            </label>
            <textarea
              id="magnet-input"
              rows={3}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setTouched(true);
              }}
              placeholder="magnet:?xt=urn:btih:... or 40-character hex hash"
              className={`w-full px-3 py-2 text-xs bg-[#1e1e1e] border rounded font-mono text-zinc-100 placeholder-zinc-500 focus:outline-none transition-colors resize-none ${
                showError
                  ? 'border-rose-500 focus:border-rose-500'
                  : isValid
                  ? 'border-emerald-500/80 focus:border-emerald-500'
                  : 'border-[#333333] focus:border-[#007acc]'
              }`}
            />

            {showError && (
              <div className="flex items-center space-x-1.5 mt-1.5 text-xs text-rose-400">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Invalid torrent link or hash. Expected a magnet:? URI or 40/32-character hash.</span>
              </div>
            )}

            {isValid && (
              <div className="flex items-center space-x-1.5 mt-1.5 text-xs text-emerald-400">
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {parsed.type === 'magnet' ? 'Valid magnet URI recognized.' : 'Valid info-hash recognized.'}
                </span>
              </div>
            )}
          </div>

          {defaultDownloadPath && (
            <div className="text-[11px] text-zinc-400 bg-[#1e1e1e] p-2.5 rounded border border-[#333333]/50">
              <span className="font-medium text-zinc-300">Save location: </span>
              <span className="font-mono">{defaultDownloadPath}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#333333]">
            <button
              type="button"
              onClick={handleClose}
              className="px-3 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-zinc-700/60 rounded border border-[#333333] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid}
              className="px-4 py-1.5 text-xs font-medium text-white bg-[#094771] hover:bg-[#007acc] disabled:opacity-40 disabled:cursor-not-allowed rounded transition-colors"
            >
              Add Torrent
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddMagnetModal;
