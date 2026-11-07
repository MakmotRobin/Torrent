import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import App from '../src/renderer/App.jsx';

describe('App Integration', () => {
  let mockTorrentAPI;

  beforeEach(() => {
    mockTorrentAPI = {
      addTorrent: vi.fn().mockResolvedValue({ success: true }),
      pauseTorrent: vi.fn().mockResolvedValue({ success: true }),
      resumeTorrent: vi.fn().mockResolvedValue({ success: true }),
      removeTorrent: vi.fn().mockResolvedValue({ success: true }),
      setFilePriority: vi.fn().mockResolvedValue({ success: true }),
      getSettings: vi.fn().mockResolvedValue({
        downloadPath: 'C:\\Downloads',
        maxActiveDownloads: 5,
        downloadSpeedLimit: 0,
        uploadSpeedLimit: 0,
        port: 6881,
      }),
      saveSettings: vi.fn().mockResolvedValue({ success: true }),
      openDownloadFolder: vi.fn().mockResolvedValue({ success: true }),
      selectTorrentFile: vi.fn().mockResolvedValue('C:\\test.torrent'),
      selectDownloadDirectory: vi.fn().mockResolvedValue('C:\\CustomDownloads'),
      onTorrentUpdate: vi.fn().mockReturnValue(vi.fn()),
      onStatsUpdate: vi.fn().mockReturnValue(vi.fn()),
    };

    window.torrentAPI = mockTorrentAPI;
  });

  it('mounts cleanly and displays empty state prompt', async () => {
    await act(async () => {
      render(<App />);
    });

    expect(screen.getByText(/No torrents added/i)).toBeDefined();
    expect(mockTorrentAPI.onTorrentUpdate).toHaveBeenCalledTimes(1);
    expect(mockTorrentAPI.onStatsUpdate).toHaveBeenCalledTimes(1);
    expect(mockTorrentAPI.getSettings).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes from IPC listeners on unmount', async () => {
    const unsubTorrents = vi.fn();
    const unsubStats = vi.fn();
    mockTorrentAPI.onTorrentUpdate.mockReturnValue(unsubTorrents);
    mockTorrentAPI.onStatsUpdate.mockReturnValue(unsubStats);

    let unmountFn;
    await act(async () => {
      const { unmount } = render(<App />);
      unmountFn = unmount;
    });

    expect(unsubTorrents).not.toHaveBeenCalled();
    expect(unsubStats).not.toHaveBeenCalled();

    act(() => {
      unmountFn();
    });

    expect(unsubTorrents).toHaveBeenCalledTimes(1);
    expect(unsubStats).toHaveBeenCalledTimes(1);
  });

  it('updates torrent list and sidebar counters when onTorrentUpdate fires', async () => {
    let torrentCallback;
    mockTorrentAPI.onTorrentUpdate.mockImplementation((cb) => {
      torrentCallback = cb;
      return vi.fn();
    });

    await act(async () => {
      render(<App />);
    });

    const sampleTorrents = [
      {
        infoHash: 'hash1',
        name: 'Ubuntu 24.04 ISO',
        length: 2500000000,
        progress: 0.45,
        status: 'downloading',
        downloadSpeed: 1048576,
        uploadSpeed: 65536,
        timeRemaining: 1800,
        numPeers: 32,
        ratio: 0.12,
        paused: false,
      },
      {
        infoHash: 'hash2',
        name: 'Debian 12 ISO',
        length: 650000000,
        progress: 1.0,
        status: 'seeding',
        downloadSpeed: 0,
        uploadSpeed: 262144,
        timeRemaining: 0,
        numPeers: 12,
        ratio: 1.5,
        paused: false,
      },
      {
        infoHash: 'hash3',
        name: 'Arch Linux ISO',
        length: 900000000,
        progress: 0.8,
        status: 'paused',
        downloadSpeed: 0,
        uploadSpeed: 0,
        timeRemaining: null,
        numPeers: 0,
        ratio: 0.05,
        paused: true,
      },
    ];

    act(() => {
      torrentCallback(sampleTorrents);
    });

    await waitFor(() => {
      expect(screen.getByText('Ubuntu 24.04 ISO')).toBeDefined();
      expect(screen.getByText('Debian 12 ISO')).toBeDefined();
      expect(screen.getByText('Arch Linux ISO')).toBeDefined();
    });
  });

  it('filters torrents when clicking sidebar categories', async () => {
    let torrentCallback;
    mockTorrentAPI.onTorrentUpdate.mockImplementation((cb) => {
      torrentCallback = cb;
      return vi.fn();
    });

    await act(async () => {
      render(<App />);
    });

    const sampleTorrents = [
      {
        infoHash: 'hash1',
        name: 'Ubuntu 24.04 ISO',
        length: 2500000000,
        progress: 0.45,
        status: 'downloading',
        downloadSpeed: 1048576,
        uploadSpeed: 65536,
        timeRemaining: 1800,
        numPeers: 32,
        ratio: 0.12,
        paused: false,
      },
      {
        infoHash: 'hash2',
        name: 'Debian 12 ISO',
        length: 650000000,
        progress: 1.0,
        status: 'seeding',
        downloadSpeed: 0,
        uploadSpeed: 262144,
        timeRemaining: 0,
        numPeers: 12,
        ratio: 1.5,
        paused: false,
      },
    ];

    act(() => {
      torrentCallback(sampleTorrents);
    });

    await waitFor(() => {
      expect(screen.getByText('Ubuntu 24.04 ISO')).toBeDefined();
    });

    // Click 'Downloading' filter
    fireEvent.click(screen.getByRole('button', { name: /Downloading/i }));
    expect(screen.getByText('Ubuntu 24.04 ISO')).toBeDefined();
    expect(screen.queryByText('Debian 12 ISO')).toBeNull();

    // Click 'Seeding' filter
    fireEvent.click(screen.getByRole('button', { name: /Seeding/i }));
    expect(screen.queryByText('Ubuntu 24.04 ISO')).toBeNull();
    expect(screen.getByText('Debian 12 ISO')).toBeDefined();

    // Click 'All' filter
    fireEvent.click(screen.getByRole('button', { name: /^All/i }));
    expect(screen.getByText('Ubuntu 24.04 ISO')).toBeDefined();
    expect(screen.getByText('Debian 12 ISO')).toBeDefined();
  });

  it('renders bottom StatusBar with global speeds, DHT nodes, and active count', async () => {
    let statsCallback;
    let torrentCallback;
    mockTorrentAPI.onStatsUpdate.mockImplementation((cb) => {
      statsCallback = cb;
      return vi.fn();
    });
    mockTorrentAPI.onTorrentUpdate.mockImplementation((cb) => {
      torrentCallback = cb;
      return vi.fn();
    });

    await act(async () => {
      render(<App />);
    });

    act(() => {
      torrentCallback([
        {
          infoHash: 'hash1',
          name: 'Ubuntu 24.04 ISO',
          status: 'downloading',
          downloadSpeed: 500000,
          uploadSpeed: 20000,
        },
      ]);

      statsCallback({
        downloadSpeed: 1048576, // 1 MB/s
        uploadSpeed: 524288, // 512 KB/s
        dhtNodes: 142,
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/142 nodes/i)).toBeDefined();
      expect(screen.getByText(/1 \/ 1/i)).toBeDefined();
    });
  });

  it('handles toolbar actions: Add File, Add Magnet, Pause, Resume, Delete, Open Folder, Settings', async () => {
    let torrentCallback;
    mockTorrentAPI.onTorrentUpdate.mockImplementation((cb) => {
      torrentCallback = cb;
      return vi.fn();
    });

    await act(async () => {
      render(<App />);
    });

    const sampleTorrent = {
      infoHash: 'hash123',
      name: 'Fedora 40 ISO',
      length: 2000000000,
      progress: 0.5,
      status: 'paused',
      downloadSpeed: 0,
      uploadSpeed: 0,
      paused: true,
      files: [{ index: 0, name: 'fedora.iso', length: 2000000000, progress: 0.5 }],
    };

    act(() => {
      torrentCallback([sampleTorrent]);
    });

    // 1. Add File via dialog
    await act(async () => {
      fireEvent.click(screen.getByTitle(/Add Torrent File/i));
    });
    await waitFor(() => {
      expect(mockTorrentAPI.selectTorrentFile).toHaveBeenCalledTimes(1);
      expect(mockTorrentAPI.addTorrent).toHaveBeenCalledWith('C:\\test.torrent');
    });

    // 2. Add Magnet via modal
    fireEvent.click(screen.getByTitle(/Add Magnet Link/i));
    expect(screen.getByRole('heading', { name: /Add Magnet Link/i })).toBeDefined();

    const magnetInput = screen.getByPlaceholderText(/magnet:\?xt=urn:btih/i);
    const validMagnet = 'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Ubuntu';
    fireEvent.change(magnetInput, { target: { value: validMagnet } });
    fireEvent.click(screen.getByRole('button', { name: /^Add Torrent$/i }));

    await waitFor(() => {
      expect(mockTorrentAPI.addTorrent).toHaveBeenCalledWith(validMagnet);
      expect(screen.queryByRole('heading', { name: /Add Magnet Link/i })).toBeNull();
    });

    // Select the row in table to activate selection actions
    fireEvent.click(screen.getByText('Fedora 40 ISO'));

    // 3. Resume torrent (since it is paused)
    const resumeBtn = screen.getByTitle(/Resume Torrent/i);
    expect(resumeBtn.disabled).toBe(false);
    fireEvent.click(resumeBtn);
    expect(mockTorrentAPI.resumeTorrent).toHaveBeenCalledWith('hash123');

    // 4. Open Containing Folder
    const openFolderBtn = screen.getByTitle(/Open Containing Folder/i);
    fireEvent.click(openFolderBtn);
    expect(mockTorrentAPI.openDownloadFolder).toHaveBeenCalledWith('hash123');

    // 5. Delete Torrent
    const deleteBtn = screen.getByTitle(/Delete Torrent/i);
    fireEvent.click(deleteBtn);
    expect(screen.getByRole('heading', { name: /Remove Torrent/i })).toBeDefined();

    // Confirm deletion with files
    fireEvent.click(screen.getByRole('button', { name: /Delete Torrent \+ Data/i }));
    expect(mockTorrentAPI.removeTorrent).toHaveBeenCalledWith('hash123', true);

    // 6. Settings Modal
    fireEvent.click(screen.getByTitle(/Settings/i));
    expect(screen.getByRole('heading', { name: /Preferences/i })).toBeDefined();

    const maxDownloads = screen.getByLabelText(/Maximum active downloads/i);
    fireEvent.change(maxDownloads, { target: { value: '8' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Save Settings/i }));
    });

    await waitFor(() => {
      expect(mockTorrentAPI.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ maxActiveDownloads: 8 })
      );
    });
  });

  it('supports drag-and-drop torrent file and magnet link onto window', async () => {
    await act(async () => {
      render(<App />);
    });

    // 1. Drop a .torrent file
    const fakeFile = new File(['torrent-binary-data'], 'sample.torrent', {
      type: 'application/x-bittorrent',
    });
    // In Electron, File objects dropped often have a .path property
    Object.defineProperty(fakeFile, 'path', { value: 'D:\\Downloads\\sample.torrent' });

    const dropEventFile = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      dataTransfer: {
        files: [fakeFile],
        getData: vi.fn().mockReturnValue(''),
      },
    };

    act(() => {
      fireEvent.drop(window, dropEventFile);
    });

    await waitFor(() => {
      expect(mockTorrentAPI.addTorrent).toHaveBeenCalledWith('D:\\Downloads\\sample.torrent');
    });

    // 2. Drop a magnet link text
    const magnetText = 'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Arch';
    const dropEventMagnet = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      dataTransfer: {
        files: [],
        getData: vi.fn((format) => (format === 'text/plain' ? magnetText : '')),
      },
    };

    act(() => {
      fireEvent.drop(window, dropEventMagnet);
    });

    await waitFor(() => {
      expect(mockTorrentAPI.addTorrent).toHaveBeenCalledWith(magnetText);
    });
  });

  it('wires file priority changes through DetailInspector', async () => {
    let torrentCallback;
    mockTorrentAPI.onTorrentUpdate.mockImplementation((cb) => {
      torrentCallback = cb;
      return vi.fn();
    });

    await act(async () => {
      render(<App />);
    });

    const sampleTorrent = {
      infoHash: 'hash789',
      name: 'Multi-file Release',
      length: 1000,
      progress: 0.2,
      status: 'downloading',
      downloadSpeed: 100,
      uploadSpeed: 0,
      paused: false,
      files: [
        { index: 0, name: 'readme.txt', length: 100, progress: 1.0, selected: true },
        { index: 1, name: 'video.mp4', length: 900, progress: 0.1, selected: true },
      ],
    };

    act(() => {
      torrentCallback([sampleTorrent]);
    });

    await waitFor(() => {
      expect(screen.getByText('Multi-file Release')).toBeDefined();
    });

    // Select row
    fireEvent.click(screen.getByText('Multi-file Release'));

    // Switch to Files tab
    fireEvent.click(screen.getByRole('tab', { name: /Files/i }));
    expect(screen.getByText('video.mp4')).toBeDefined();

    // Uncheck file 1 (video.mp4)
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(2);
    fireEvent.click(checkboxes[1]);

    expect(mockTorrentAPI.setFilePriority).toHaveBeenCalledWith('hash789', 1, 'dont_download');
  });

  it('main.jsx boots and mounts App into #root', async () => {
    const root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);

    await act(async () => {
      await import('../src/renderer/main.jsx');
    });

    expect(root.children.length).toBeGreaterThan(0);
    document.body.removeChild(root);
  });
});
