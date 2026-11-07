import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TorrentTable } from '../src/renderer/components/TorrentTable.jsx';

describe('TorrentTable', () => {
  const mockTorrents = [
    {
      infoHash: 'hash1',
      name: 'linux-mint.iso',
      length: 2500000000,
      progress: 0.75,
      status: 'downloading',
      downloadSpeed: 5242880,
      uploadSpeed: 512000,
      timeRemaining: 180,
      numPeers: 32,
      ratio: 0.25,
      magnetURI: 'magnet:?xt=urn:btih:hash1&dn=linux-mint.iso',
    },
    {
      infoHash: 'hash2',
      name: 'ubuntu-desktop.iso',
      length: 4000000000,
      progress: 1.0,
      status: 'seeding',
      downloadSpeed: 0,
      uploadSpeed: 1048576,
      timeRemaining: 0,
      numPeers: 15,
      ratio: 1.85,
      magnetURI: 'magnet:?xt=urn:btih:hash2&dn=ubuntu-desktop.iso',
    },
    {
      infoHash: 'hash3',
      name: 'arch-linux.iso',
      length: 800000000,
      progress: 0.2,
      status: 'paused',
      downloadSpeed: 0,
      uploadSpeed: 0,
      timeRemaining: Infinity,
      numPeers: 0,
      ratio: 0.05,
      paused: true,
      magnetURI: 'magnet:?xt=urn:btih:hash3&dn=arch-linux.iso',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders torrent row items with progress and speed', () => {
    render(<TorrentTable torrents={mockTorrents} selectedHash="hash1" onSelect={() => {}} />);
    expect(screen.getByText('linux-mint.iso')).toBeDefined();
    expect(screen.getByText('75%')).toBeDefined();
  });

  it('renders all required column headers', () => {
    render(<TorrentTable torrents={mockTorrents} selectedHash={null} onSelect={() => {}} />);
    expect(screen.getByText('Name')).toBeDefined();
    expect(screen.getByText('Size')).toBeDefined();
    expect(screen.getByText('Progress')).toBeDefined();
    expect(screen.getByText('Status')).toBeDefined();
    expect(screen.getByText('Down Speed')).toBeDefined();
    expect(screen.getByText('Up Speed')).toBeDefined();
    expect(screen.getByText('ETA')).toBeDefined();
    expect(screen.getByText('Seeds/Peers')).toBeDefined();
    expect(screen.getByText('Ratio')).toBeDefined();
  });

  it('renders clean empty state prompt when no torrents exist', () => {
    render(<TorrentTable torrents={[]} selectedHash={null} onSelect={() => {}} />);
    expect(screen.getByText(/no torrents/i)).toBeDefined();
  });

  it('highlights the selected torrent row', () => {
    render(
      <TorrentTable torrents={mockTorrents} selectedHash="hash1" onSelect={() => {}} />
    );
    const row1 = screen.getByText('linux-mint.iso').closest('tr');
    const row2 = screen.getByText('ubuntu-desktop.iso').closest('tr');
    
    expect(row1.className).toMatch(/bg-|selected/);
    expect(row1.getAttribute('aria-selected')).toBe('true');
    expect(row2.getAttribute('aria-selected')).toBe('false');
  });

  it('calls onSelect when a row is clicked', () => {
    const onSelect = vi.fn();
    render(<TorrentTable torrents={mockTorrents} selectedHash={null} onSelect={onSelect} />);

    fireEvent.click(screen.getByText('ubuntu-desktop.iso'));
    expect(onSelect).toHaveBeenCalledWith('hash2', expect.objectContaining({ infoHash: 'hash2' }));
  });

  it('sorts rows when clicking column headers and toggles order', () => {
    render(<TorrentTable torrents={mockTorrents} selectedHash={null} onSelect={() => {}} />);

    const nameHeader = screen.getByText('Name');

    // Default is asc by name: arch-linux, linux-mint, ubuntu-desktop
    let rows = screen.getAllByRole('row').slice(1);
    expect(rows[0].textContent).toContain('arch-linux.iso');
    expect(rows[1].textContent).toContain('linux-mint.iso');
    expect(rows[2].textContent).toContain('ubuntu-desktop.iso');

    // Click 'Name' to reverse sort (descending)
    fireEvent.click(nameHeader);
    rows = screen.getAllByRole('row').slice(1);
    expect(rows[0].textContent).toContain('ubuntu-desktop.iso');
    expect(rows[1].textContent).toContain('linux-mint.iso');
    expect(rows[2].textContent).toContain('arch-linux.iso');

    // Click 'Size' header to sort by length ascending
    const sizeHeader = screen.getByText('Size');
    fireEvent.click(sizeHeader);
    rows = screen.getAllByRole('row').slice(1);
    expect(rows[0].textContent).toContain('arch-linux.iso'); // 800 MB
    expect(rows[2].textContent).toContain('ubuntu-desktop.iso'); // 4 GB
  });

  it('opens context menu on right click and handles actions', async () => {
    const onSelect = vi.fn();
    const onPause = vi.fn();
    const onResume = vi.fn();
    const onOpenFolder = vi.fn();
    const onRemove = vi.fn();

    render(
      <TorrentTable
        torrents={mockTorrents}
        selectedHash={null}
        onSelect={onSelect}
        onPause={onPause}
        onResume={onResume}
        onOpenFolder={onOpenFolder}
        onRemove={onRemove}
      />
    );

    const row = screen.getByText('linux-mint.iso');
    fireEvent.contextMenu(row, { clientX: 200, clientY: 150 });

    // Right-click should select the row
    expect(onSelect).toHaveBeenCalledWith('hash1', expect.objectContaining({ infoHash: 'hash1' }));

    // Context menu should appear
    expect(screen.getByText('Pause')).toBeDefined();
    expect(screen.getByText('Resume')).toBeDefined();
    expect(screen.getByText('Open Containing Folder')).toBeDefined();
    expect(screen.getByText('Copy Magnet Link')).toBeDefined();
    expect(screen.getByText('Delete Torrent')).toBeDefined();
    expect(screen.getByText('Delete Torrent + Data')).toBeDefined();

    // Clicking Pause calls onPause
    fireEvent.click(screen.getByText('Pause'));
    expect(onPause).toHaveBeenCalledWith('hash1', expect.objectContaining({ infoHash: 'hash1' }));
  });

  it('handles Delete Torrent and Delete Torrent + Data from context menu', () => {
    const onRemove = vi.fn();
    render(
      <TorrentTable
        torrents={mockTorrents}
        selectedHash="hash1"
        onSelect={() => {}}
        onRemove={onRemove}
      />
    );

    // Open context menu for hash1
    fireEvent.contextMenu(screen.getByText('linux-mint.iso'), { clientX: 100, clientY: 100 });
    fireEvent.click(screen.getByText('Delete Torrent'));
    expect(onRemove).toHaveBeenCalledWith('hash1', { deleteFiles: false });

    // Open context menu again and delete with data
    fireEvent.contextMenu(screen.getByText('linux-mint.iso'), { clientX: 100, clientY: 100 });
    fireEvent.click(screen.getByText('Delete Torrent + Data'));
    expect(onRemove).toHaveBeenCalledWith('hash1', { deleteFiles: true });
  });

  it('handles Copy Magnet Link from context menu', () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <TorrentTable
        torrents={mockTorrents}
        selectedHash="hash1"
        onSelect={() => {}}
      />
    );

    fireEvent.contextMenu(screen.getByText('linux-mint.iso'), { clientX: 100, clientY: 100 });
    fireEvent.click(screen.getByText('Copy Magnet Link'));
    expect(writeTextMock).toHaveBeenCalledWith('magnet:?xt=urn:btih:hash1&dn=linux-mint.iso');
  });

  it('handles keyboard shortcuts: Delete key removes torrent', () => {
    const onRemove = vi.fn();
    render(
      <TorrentTable
        torrents={mockTorrents}
        selectedHash="hash1"
        onSelect={() => {}}
        onRemove={onRemove}
      />
    );

    const table = screen.getByRole('table');
    fireEvent.keyDown(table, { key: 'Delete', code: 'Delete' });
    expect(onRemove).toHaveBeenCalledWith('hash1', { deleteFiles: false });
  });

  it('handles keyboard shortcuts: Space key toggles pause and resume', () => {
    const onPause = vi.fn();
    const onResume = vi.fn();

    const { rerender } = render(
      <TorrentTable
        torrents={mockTorrents}
        selectedHash="hash1" // downloading
        onSelect={() => {}}
        onPause={onPause}
        onResume={onResume}
      />
    );

    const table = screen.getByRole('table');
    fireEvent.keyDown(table, { key: ' ', code: 'Space' });
    expect(onPause).toHaveBeenCalledWith('hash1', expect.objectContaining({ infoHash: 'hash1' }));

    // Selected paused torrent
    rerender(
      <TorrentTable
        torrents={mockTorrents}
        selectedHash="hash3" // paused
        onSelect={() => {}}
        onPause={onPause}
        onResume={onResume}
      />
    );

    fireEvent.keyDown(table, { key: ' ', code: 'Space' });
    expect(onResume).toHaveBeenCalledWith('hash3', expect.objectContaining({ infoHash: 'hash3' }));
  });

  it('navigates rows with ArrowUp and ArrowDown keys', () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <TorrentTable
        torrents={mockTorrents}
        selectedHash="hash1" // index 1 in alphabetical list (arch-linux, linux-mint, ubuntu-desktop)
        onSelect={onSelect}
      />
    );

    const table = screen.getByRole('table');
    fireEvent.keyDown(table, { key: 'ArrowDown', code: 'ArrowDown' });
    expect(onSelect).toHaveBeenCalledWith('hash2', expect.objectContaining({ infoHash: 'hash2' }));

    rerender(
      <TorrentTable
        torrents={mockTorrents}
        selectedHash="hash2"
        onSelect={onSelect}
      />
    );

    fireEvent.keyDown(table, { key: 'ArrowUp', code: 'ArrowUp' });
    expect(onSelect).toHaveBeenLastCalledWith('hash1', expect.objectContaining({ infoHash: 'hash1' }));
  });
});
