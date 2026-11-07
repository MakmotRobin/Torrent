import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DetailInspector } from '../src/renderer/components/DetailInspector.jsx';
import { SpeedGraph } from '../src/renderer/components/SpeedGraph.jsx';

describe('DetailInspector', () => {
  const mockTorrent = {
    infoHash: '0123456789abcdef0123456789abcdef01234567',
    name: 'Ubuntu-24.04-desktop-amd64.iso',
    length: 4294967296, // 4 GB
    downloaded: 2147483648, // 2 GB
    uploaded: 1073741824, // 1 GB
    downloadSpeed: 10485760, // 10 MB/s
    uploadSpeed: 2097152, // 2 MB/s
    progress: 0.5,
    ratio: 0.5,
    status: 'downloading',
    timeRemaining: 205,
    numPeers: 42,
    path: 'D:\\Downloads\\Torrents',
    pieceLength: 1048576, // 1 MB
    numPieces: 4096,
    pieces: [true, true, false, true],
    addedAt: '2026-11-08T00:00:00.000Z',
    files: [
      {
        index: 0,
        name: 'ubuntu-24.04-desktop-amd64.iso',
        path: 'ubuntu-24.04-desktop-amd64.iso',
        length: 4294967000,
        downloaded: 2147483500,
        progress: 0.5,
        selected: true,
        priority: 'normal',
      },
      {
        index: 1,
        name: 'checksums.txt',
        path: 'checksums.txt',
        length: 296,
        downloaded: 296,
        progress: 1.0,
        selected: false,
        priority: 'dont_download',
      },
    ],
    trackers: [
      {
        announce: 'udp://tracker.opentrackr.org:1337/announce',
        status: 'working',
        tier: 1,
      },
      {
        announce: 'https://torrent.ubuntu.com/announce',
        status: 'working',
        tier: 2,
      },
    ],
    peers: [
      {
        addr: '192.168.1.50:6881',
        client: 'Transmission 4.0.3',
        flags: 'uE',
        downloadSpeed: 5242880,
        uploadSpeed: 1048576,
      },
      {
        addr: '10.0.0.12:51413',
        client: 'qBittorrent 4.6.2',
        flags: 'u',
        downloadSpeed: 2621440,
        uploadSpeed: 524288,
      },
    ],
  };

  const mockSpeedHistory = [
    { downloadSpeed: 1000000, uploadSpeed: 200000, timestamp: 1 },
    { downloadSpeed: 5000000, uploadSpeed: 1000000, timestamp: 2 },
    { downloadSpeed: 10485760, uploadSpeed: 2097152, timestamp: 3 },
  ];

  it('renders all tab headers', () => {
    render(<DetailInspector torrent={null} speedHistory={[]} onToggleFile={() => {}} />);
    expect(screen.getByText('General')).toBeDefined();
    expect(screen.getByText('Files')).toBeDefined();
    expect(screen.getByText('Trackers')).toBeDefined();
    expect(screen.getByText('Peers')).toBeDefined();
    expect(screen.getByText('Speed Graph')).toBeDefined();
  });

  it('renders empty selection state when torrent is null', () => {
    render(<DetailInspector torrent={null} speedHistory={[]} onToggleFile={() => {}} />);
    expect(screen.getByText(/no torrent selected/i)).toBeDefined();
  });

  it('switches between tabs when tab buttons are clicked', () => {
    render(<DetailInspector torrent={mockTorrent} speedHistory={mockSpeedHistory} onToggleFile={() => {}} />);

    // Defaults to General tab
    expect(screen.getByText(/0123456789abcdef0123456789abcdef01234567/i)).toBeDefined();

    // Click Files tab
    fireEvent.click(screen.getByRole('tab', { name: /files/i }));
    expect(screen.getByText('ubuntu-24.04-desktop-amd64.iso')).toBeDefined();
    expect(screen.getByText('checksums.txt')).toBeDefined();

    // Click Trackers tab
    fireEvent.click(screen.getByRole('tab', { name: /trackers/i }));
    expect(screen.getByText('udp://tracker.opentrackr.org:1337/announce')).toBeDefined();
    expect(screen.getByText('https://torrent.ubuntu.com/announce')).toBeDefined();

    // Click Peers tab
    fireEvent.click(screen.getByRole('tab', { name: /peers/i }));
    expect(screen.getByText('192.168.1.50:6881')).toBeDefined();
    expect(screen.getByText('Transmission 4.0.3')).toBeDefined();

    // Click Speed Graph tab
    fireEvent.click(screen.getByRole('tab', { name: /speed graph/i }));
    expect(screen.getByTestId('speed-graph')).toBeDefined();
  });

  it('renders General tab metadata accurately', () => {
    render(<DetailInspector torrent={mockTorrent} speedHistory={[]} onToggleFile={() => {}} />);

    // Info hash
    expect(screen.getByText('0123456789abcdef0123456789abcdef01234567')).toBeDefined();
    // Save path
    expect(screen.getByText('D:\\Downloads\\Torrents')).toBeDefined();
    // Piece count
    expect(screen.getAllByText(/4096/).length).toBeGreaterThan(0);
    // Seeds / peers
    expect(screen.getByText('42')).toBeDefined();
    // Ratio
    expect(screen.getByText('0.50')).toBeDefined();
  });

  it('renders Files tab and triggers onToggleFile on checkbox change', () => {
    const onToggleFile = vi.fn();
    render(<DetailInspector torrent={mockTorrent} speedHistory={[]} onToggleFile={onToggleFile} />);

    // Switch to Files tab
    fireEvent.click(screen.getByRole('tab', { name: /files/i }));

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(2);

    // First file is selected (checked)
    expect(checkboxes[0].checked).toBe(true);
    // Second file is not selected (unchecked)
    expect(checkboxes[1].checked).toBe(false);

    // Toggle first checkbox (uncheck)
    fireEvent.click(checkboxes[0]);
    expect(onToggleFile).toHaveBeenCalledWith(0, 'dont_download');

    // Toggle second checkbox (check)
    fireEvent.click(checkboxes[1]);
    expect(onToggleFile).toHaveBeenCalledWith(1, 'normal');
  });

  it('renders Trackers tab with announce URLs and status', () => {
    render(<DetailInspector torrent={mockTorrent} speedHistory={[]} onToggleFile={() => {}} />);

    fireEvent.click(screen.getByRole('tab', { name: /trackers/i }));

    expect(screen.getByText('udp://tracker.opentrackr.org:1337/announce')).toBeDefined();
    expect(screen.getByText('https://torrent.ubuntu.com/announce')).toBeDefined();
    const workingStatuses = screen.getAllByText(/working/i);
    expect(workingStatuses.length).toBeGreaterThan(0);
  });

  it('renders Peers tab with IP, client, flags, and transfer rates', () => {
    render(<DetailInspector torrent={mockTorrent} speedHistory={[]} onToggleFile={() => {}} />);

    fireEvent.click(screen.getByRole('tab', { name: /peers/i }));

    expect(screen.getByText('192.168.1.50:6881')).toBeDefined();
    expect(screen.getByText('Transmission 4.0.3')).toBeDefined();
    expect(screen.getByText('uE')).toBeDefined();
    expect(screen.getByText('10.0.0.12:51413')).toBeDefined();
    expect(screen.getByText('qBittorrent 4.6.2')).toBeDefined();
  });

  it('handles empty files, trackers, and peers arrays gracefully', () => {
    const emptyTorrent = {
      infoHash: 'abcdef1234567890abcdef1234567890abcdef12',
      name: 'empty.iso',
      length: 1000,
      files: [],
      trackers: [],
      peers: [],
    };

    render(<DetailInspector torrent={emptyTorrent} speedHistory={[]} onToggleFile={() => {}} />);

    // Files tab
    fireEvent.click(screen.getByRole('tab', { name: /files/i }));
    expect(screen.getByText(/no files available/i)).toBeDefined();

    // Trackers tab
    fireEvent.click(screen.getByRole('tab', { name: /trackers/i }));
    expect(screen.getByText(/no trackers available/i)).toBeDefined();

    // Peers tab
    fireEvent.click(screen.getByRole('tab', { name: /peers/i }));
    expect(screen.getByText(/no connected peers/i)).toBeDefined();
  });

  it('supports collapsing and expanding panel via collapse toggle button', () => {
    const onToggleCollapse = vi.fn();
    const { rerender } = render(
      <DetailInspector
        torrent={mockTorrent}
        speedHistory={[]}
        onToggleFile={() => {}}
        isCollapsed={false}
        onToggleCollapse={onToggleCollapse}
      />
    );

    const collapseBtn = screen.getByRole('button', { name: /collapse|expand|toggle inspector/i });
    fireEvent.click(collapseBtn);
    expect(onToggleCollapse).toHaveBeenCalled();

    // When collapsed, content body is hidden or collapsed
    rerender(
      <DetailInspector
        torrent={mockTorrent}
        speedHistory={[]}
        onToggleFile={() => {}}
        isCollapsed={true}
        onToggleCollapse={onToggleCollapse}
      />
    );
    expect(screen.queryByText('D:\\Downloads\\Torrents')).toBeNull();
  });
});

describe('SpeedGraph', () => {
  it('renders SVG chart with download and upload lines', () => {
    const history = [
      { downloadSpeed: 1024, uploadSpeed: 512, timestamp: 1 },
      { downloadSpeed: 2048, uploadSpeed: 1024, timestamp: 2 },
      { downloadSpeed: 4096, uploadSpeed: 2048, timestamp: 3 },
    ];

    render(<SpeedGraph speedHistory={history} />);
    const graph = screen.getByTestId('speed-graph');
    expect(graph).toBeDefined();

    const svg = graph.querySelector('svg');
    expect(svg).toBeDefined();
    expect(screen.getByText(/download/i)).toBeDefined();
    expect(screen.getByText(/upload/i)).toBeDefined();
  });

  it('handles empty speedHistory without throwing', () => {
    render(<SpeedGraph speedHistory={[]} />);
    const graph = screen.getByTestId('speed-graph');
    expect(graph).toBeDefined();
    expect(screen.getAllByText('0 B/s').length).toBeGreaterThan(0);
  });
});
