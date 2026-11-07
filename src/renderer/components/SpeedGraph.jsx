import React, { useMemo } from 'react';
import { formatSpeed } from '../../shared/formatters.js';

/**
 * Real-time dual-line SVG graph plotting download (cyan/sky) and upload (green/emerald) speeds over time.
 *
 * @param {object} props
 * @param {Array<{ downloadSpeed?: number, uploadSpeed?: number, download?: number, upload?: number, timestamp?: number }>} [props.speedHistory]
 * @param {number} [props.currentDownload]
 * @param {number} [props.currentUpload]
 * @param {string} [props.className]
 */
export function SpeedGraph({
  speedHistory = [],
  currentDownload,
  currentUpload,
  className = '',
}) {
  const points = useMemo(() => {
    return Array.isArray(speedHistory) ? speedHistory : [];
  }, [speedHistory]);

  const latestPoint = points[points.length - 1];
  const curDownload = currentDownload !== undefined
    ? currentDownload
    : (latestPoint?.downloadSpeed ?? latestPoint?.download ?? 0);
  const curUpload = currentUpload !== undefined
    ? currentUpload
    : (latestPoint?.uploadSpeed ?? latestPoint?.upload ?? 0);

  const { maxSpeed, downloadPoints, uploadPoints, downloadPathD, uploadPathD, downloadAreaD, uploadAreaD } = useMemo(() => {
    const rawPoints = points.slice(-60); // keep up to 60 historical ticks
    let max = 1024; // minimum 1 KB/s scale

    for (const p of rawPoints) {
      const d = p.downloadSpeed ?? p.download ?? 0;
      const u = p.uploadSpeed ?? p.upload ?? 0;
      if (d > max) max = d;
      if (u > max) max = u;
    }
    if (curDownload > max) max = curDownload;
    if (curUpload > max) max = curUpload;

    const width = 600;
    const height = 150;
    const paddingLeft = 10;
    const paddingRight = 10;
    const paddingTop = 12;
    const paddingBottom = 20;

    const chartW = width - paddingLeft - paddingRight;
    const chartH = height - paddingTop - paddingBottom;

    if (rawPoints.length === 0) {
      const baselineY = paddingTop + chartH;
      return {
        maxSpeed: max,
        downloadPoints: [],
        uploadPoints: [],
        downloadPathD: `M ${paddingLeft} ${baselineY} L ${paddingLeft + chartW} ${baselineY}`,
        uploadPathD: `M ${paddingLeft} ${baselineY} L ${paddingLeft + chartW} ${baselineY}`,
        downloadAreaD: `M ${paddingLeft} ${baselineY} L ${paddingLeft + chartW} ${baselineY} Z`,
        uploadAreaD: `M ${paddingLeft} ${baselineY} L ${paddingLeft + chartW} ${baselineY} Z`,
      };
    }

    const stepX = rawPoints.length > 1 ? chartW / (rawPoints.length - 1) : chartW;

    const dCoords = rawPoints.map((p, i) => {
      const val = p.downloadSpeed ?? p.download ?? 0;
      const x = paddingLeft + (rawPoints.length > 1 ? i * stepX : chartW);
      const y = paddingTop + chartH - (val / max) * chartH;
      return { x, y, val };
    });

    const uCoords = rawPoints.map((p, i) => {
      const val = p.uploadSpeed ?? p.upload ?? 0;
      const x = paddingLeft + (rawPoints.length > 1 ? i * stepX : chartW);
      const y = paddingTop + chartH - (val / max) * chartH;
      return { x, y, val };
    });

    const buildPath = (coords) => {
      if (coords.length === 0) return '';
      if (coords.length === 1) {
        return `M ${paddingLeft} ${coords[0].y} L ${paddingLeft + chartW} ${coords[0].y}`;
      }
      return coords.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`, '');
    };

    const dPath = buildPath(dCoords);
    const uPath = buildPath(uCoords);
    const baselineY = paddingTop + chartH;

    const buildArea = (coords) => {
      if (coords.length === 0) return '';
      const firstX = coords[0].x.toFixed(1);
      const lastX = coords[coords.length - 1].x.toFixed(1);
      if (coords.length === 1) {
        return `M ${paddingLeft} ${coords[0].y} L ${paddingLeft + chartW} ${coords[0].y} L ${paddingLeft + chartW} ${baselineY} L ${paddingLeft} ${baselineY} Z`;
      }
      const linePart = coords.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`, '');
      return `${linePart} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;
    };

    return {
      maxSpeed: max,
      downloadPoints: dCoords,
      uploadPoints: uCoords,
      downloadPathD: dPath,
      uploadPathD: uPath,
      downloadAreaD: buildArea(dCoords),
      uploadAreaD: buildArea(uCoords),
    };
  }, [points, curDownload, curUpload]);

  const maxDownloadInHistory = useMemo(() => {
    return Math.max(0, ...points.map((p) => p.downloadSpeed ?? p.download ?? 0), curDownload);
  }, [points, curDownload]);

  const maxUploadInHistory = useMemo(() => {
    return Math.max(0, ...points.map((p) => p.uploadSpeed ?? p.upload ?? 0), curUpload);
  }, [points, curUpload]);

  return (
    <div
      data-testid="speed-graph"
      className={`flex flex-col h-full w-full bg-slate-900/95 text-slate-200 select-none ${className}`}
    >
      {/* Top Legend Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800 text-xs bg-slate-950/60">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block shadow-[0_0_8px_rgba(56,189,248,0.5)]" />
            <span className="font-medium text-slate-300">Download:</span>
            <span className="font-semibold text-sky-400">{formatSpeed(curDownload)}</span>
            <span className="text-slate-500 text-[11px]">(Peak: {formatSpeed(maxDownloadInHistory)})</span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
            <span className="font-medium text-slate-300">Upload:</span>
            <span className="font-semibold text-emerald-400">{formatSpeed(curUpload)}</span>
            <span className="text-slate-500 text-[11px]">(Peak: {formatSpeed(maxUploadInHistory)})</span>
          </div>
        </div>

        <div className="text-[11px] text-slate-500">
          Scale: {formatSpeed(maxSpeed)}
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div className="relative flex-1 w-full min-h-[140px] p-2 overflow-hidden flex items-center justify-center">
        <svg
          viewBox="0 0 600 150"
          preserveAspectRatio="none"
          className="w-full h-full block overflow-visible"
        >
          <defs>
            <linearGradient id="downloadGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="uploadGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <g className="stroke-slate-800/80" strokeDasharray="3 3" strokeWidth="1">
            <line x1="10" y1="12" x2="590" y2="12" />
            <line x1="10" y1="47" x2="590" y2="47" />
            <line x1="10" y1="83" x2="590" y2="83" />
            <line x1="10" y1="118" x2="590" y2="118" />
            <line x1="10" y1="142" x2="590" y2="142" strokeDasharray="0" className="stroke-slate-800" />
          </g>

          {/* Speed reference labels */}
          <text x="14" y="24" className="text-[9px] fill-slate-500 font-mono">
            {formatSpeed(maxSpeed)}
          </text>
          <text x="14" y="80" className="text-[9px] fill-slate-600 font-mono">
            {formatSpeed(maxSpeed / 2)}
          </text>
          <text x="14" y="138" className="text-[9px] fill-slate-600 font-mono">
            0 B/s
          </text>

          {/* Download fill and line */}
          {downloadAreaD && (
            <path d={downloadAreaD} fill="url(#downloadGradient)" />
          )}
          {downloadPathD && (
            <path
              d={downloadPathD}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Upload fill and line */}
          {uploadAreaD && (
            <path d={uploadAreaD} fill="url(#uploadGradient)" />
          )}
          {uploadPathD && (
            <path
              d={uploadPathD}
              fill="none"
              stroke="#34d399"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
      </div>
    </div>
  );
}
export default SpeedGraph;
