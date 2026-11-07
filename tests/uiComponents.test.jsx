import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Sidebar } from '../src/renderer/components/Sidebar.jsx';
import { Toolbar } from '../src/renderer/components/Toolbar.jsx';
import { AddMagnetModal } from '../src/renderer/components/AddMagnetModal.jsx';
import { SettingsModal } from '../src/renderer/components/SettingsModal.jsx';

describe('Sidebar', () => {
  it('renders status filter categories with correct counts', () => {
    const counts = { all: 5, downloading: 2, seeding: 1, completed: 2, active: 3, inactive: 2 };
    render(<Sidebar activeFilter="all" onSelectFilter={() => {}} counts={counts} />);
    
    expect(screen.getByText('All')).toBeDefined();
    expect(screen.getByText('Downloading')).toBeDefined();
    expect(screen.getByText('Seeding')).toBeDefined();
    expect(screen.getByText('Completed')).toBeDefined();
    expect(screen.getByText('Active')).toBeDefined();
    expect(screen.getByText('Inactive')).toBeDefined();
    expect(screen.getByText('5')).toBeDefined();
  });

  it('handles clicking category filters and passes filter key to callback', () => {
    const onSelectFilter = vi.fn();
    const counts = { all: 5, downloading: 2, seeding: 1, completed: 2, active: 3, inactive: 2 };
    render(<Sidebar activeFilter="all" onSelectFilter={onSelectFilter} counts={counts} />);

    fireEvent.click(screen.getByText('Downloading'));
    expect(onSelectFilter).toHaveBeenCalledWith('downloading');

    fireEvent.click(screen.getByText('Completed'));
    expect(onSelectFilter).toHaveBeenCalledWith('completed');
  });

  it('highlights the active category filter', () => {
    const counts = { all: 5, downloading: 2, seeding: 1, completed: 2, active: 3, inactive: 2 };
    const { rerender } = render(<Sidebar activeFilter="seeding" onSelectFilter={() => {}} counts={counts} />);
    
    const seedingButton = screen.getByRole('button', { name: /seeding/i });
    expect(seedingButton.className).toMatch(/bg-|active/);

    rerender(<Sidebar activeFilter="downloading" onSelectFilter={() => {}} counts={counts} />);
    const downloadingButton = screen.getByRole('button', { name: /downloading/i });
    expect(downloadingButton.className).toMatch(/bg-|active/);
  });

  it('defaults missing counts to zero', () => {
    render(<Sidebar activeFilter="all" onSelectFilter={() => {}} counts={{}} />);
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(5);
  });
});

describe('Toolbar', () => {
  it('renders all toolbar buttons', () => {
    render(
      <Toolbar
        onAddTorrent={() => {}}
        onAddMagnet={() => {}}
        onResume={() => {}}
        onPause={() => {}}
        onDelete={() => {}}
        onOpenFolder={() => {}}
        onOpenSettings={() => {}}
        selectedTorrent={null}
      />
    );

    expect(screen.getByTitle(/Add Torrent File/i)).toBeDefined();
    expect(screen.getByTitle(/Add Magnet Link/i)).toBeDefined();
    expect(screen.getByTitle(/Resume/i)).toBeDefined();
    expect(screen.getByTitle(/Pause/i)).toBeDefined();
    expect(screen.getByTitle(/Delete/i)).toBeDefined();
    expect(screen.getByTitle(/Open/i)).toBeDefined();
    expect(screen.getByTitle(/Settings/i)).toBeDefined();
  });

  it('disables torrent-specific actions when no torrent is selected', () => {
    render(
      <Toolbar
        onAddTorrent={() => {}}
        onAddMagnet={() => {}}
        onResume={() => {}}
        onPause={() => {}}
        onDelete={() => {}}
        onOpenFolder={() => {}}
        onOpenSettings={() => {}}
        selectedTorrent={null}
      />
    );

    expect(screen.getByTitle(/Resume/i).disabled).toBe(true);
    expect(screen.getByTitle(/Pause/i).disabled).toBe(true);
    expect(screen.getByTitle(/Delete/i).disabled).toBe(true);
    expect(screen.getByTitle(/Open/i).disabled).toBe(true);
  });

  it('triggers onAddTorrent, onAddMagnet, and onOpenSettings clicks', () => {
    const onAddTorrent = vi.fn();
    const onAddMagnet = vi.fn();
    const onOpenSettings = vi.fn();

    render(
      <Toolbar
        onAddTorrent={onAddTorrent}
        onAddMagnet={onAddMagnet}
        onResume={() => {}}
        onPause={() => {}}
        onDelete={() => {}}
        onOpenFolder={() => {}}
        onOpenSettings={onOpenSettings}
        selectedTorrent={null}
      />
    );

    fireEvent.click(screen.getByTitle(/Add Torrent File/i));
    expect(onAddTorrent).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle(/Add Magnet Link/i));
    expect(onAddMagnet).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle(/Settings/i));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('enables resume and pause based on torrent state and triggers callbacks', () => {
    const onResume = vi.fn();
    const onPause = vi.fn();

    const pausedTorrent = { infoHash: 'abc', name: 'test.iso', paused: true };
    const { rerender } = render(
      <Toolbar
        onResume={onResume}
        onPause={onPause}
        selectedTorrent={pausedTorrent}
      />
    );

    const resumeBtn = screen.getByTitle(/Resume/i);
    expect(resumeBtn.disabled).toBe(false);
    fireEvent.click(resumeBtn);
    expect(onResume).toHaveBeenCalledTimes(1);

    const activeTorrent = { infoHash: 'abc', name: 'test.iso', paused: false };
    rerender(
      <Toolbar
        onResume={onResume}
        onPause={onPause}
        selectedTorrent={activeTorrent}
      />
    );

    const pauseBtn = screen.getByTitle(/Pause/i);
    expect(pauseBtn.disabled).toBe(false);
    fireEvent.click(pauseBtn);
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it('displays delete confirmation and supports delete options', () => {
    const onDelete = vi.fn();
    const torrent = { infoHash: 'abc', name: 'test.iso', paused: false };

    render(
      <Toolbar
        onDelete={onDelete}
        selectedTorrent={torrent}
      />
    );

    const deleteBtn = screen.getByTitle(/Delete/i);
    expect(deleteBtn.disabled).toBe(false);

    // Click delete to open confirmation dialog
    fireEvent.click(deleteBtn);
    expect(screen.getByRole('heading', { name: /Remove Torrent/i })).toBeDefined();
    expect(screen.getByText(/Delete Torrent \+ Data/i)).toBeDefined();

    // Clicking cancel closes dialog without calling onDelete
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByText(/Delete Torrent \+ Data/i)).toBeNull();

    // Click delete again and choose "Remove Torrent" (without deleting files)
    fireEvent.click(deleteBtn);
    fireEvent.click(screen.getByRole('button', { name: /^Remove Torrent$/i }));
    expect(onDelete).toHaveBeenCalledWith({ deleteFiles: false });

    // Click delete again and choose "Delete Torrent + Data"
    fireEvent.click(deleteBtn);
    fireEvent.click(screen.getByRole('button', { name: /Delete Torrent \+ Data/i }));
    expect(onDelete).toHaveBeenCalledWith({ deleteFiles: true });
  });

  it('triggers onOpenFolder when folder button is clicked', () => {
    const onOpenFolder = vi.fn();
    const torrent = { infoHash: 'abc', name: 'test.iso' };

    render(
      <Toolbar
        onOpenFolder={onOpenFolder}
        selectedTorrent={torrent}
      />
    );

    fireEvent.click(screen.getByTitle(/Open/i));
    expect(onOpenFolder).toHaveBeenCalledTimes(1);
  });
});

describe('AddMagnetModal', () => {
  it('does not render when isOpen is false', () => {
    render(<AddMagnetModal isOpen={false} onClose={() => {}} onAdd={() => {}} />);
    expect(screen.queryByText(/Add Magnet Link/i)).toBeNull();
  });

  it('renders input and validates magnet links and infohashes', () => {
    const onAdd = vi.fn();
    const onClose = vi.fn();

    render(<AddMagnetModal isOpen={true} onClose={onClose} onAdd={onAdd} />);

    expect(screen.getByRole('heading', { name: /Add Magnet Link/i })).toBeDefined();

    const input = screen.getByPlaceholderText(/magnet:\?xt=urn:btih/i);
    const addBtn = screen.getByRole('button', { name: /^Add Torrent$/i });

    // Invalid input
    fireEvent.change(input, { target: { value: 'not-a-valid-magnet' } });
    expect(screen.getByText(/Invalid torrent link or hash/i)).toBeDefined();
    expect(addBtn.disabled).toBe(true);

    // Valid 40-character hex infohash
    fireEvent.change(input, { target: { value: '08ada5a7a6183aae1e09d831df6748d566095a10' } });
    expect(screen.queryByText(/Invalid torrent link or hash/i)).toBeNull();
    expect(addBtn.disabled).toBe(false);

    // Submit valid infohash
    fireEvent.click(addBtn);
    expect(onAdd).toHaveBeenCalledWith('08ada5a7a6183aae1e09d831df6748d566095a10');

    // Valid magnet URI
    const magnetUri = 'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Ubuntu';
    fireEvent.change(input, { target: { value: magnetUri } });
    expect(screen.queryByText(/Invalid torrent link or hash/i)).toBeNull();
    expect(addBtn.disabled).toBe(false);

    // Submit valid magnet
    fireEvent.click(addBtn);
    expect(onAdd).toHaveBeenCalledWith(magnetUri);
  });

  it('calls onClose when clicking Cancel or Close button', () => {
    const onClose = vi.fn();
    render(<AddMagnetModal isOpen={true} onClose={onClose} onAdd={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle(/Close/i));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('SettingsModal', () => {
  const initialSettings = {
    downloadPath: 'C:\\Users\\User\\Downloads',
    maxActiveDownloads: 5,
    downloadSpeedLimit: 0,
    uploadSpeedLimit: 1024,
    port: 6881,
  };

  it('does not render when isOpen is false', () => {
    render(
      <SettingsModal
        isOpen={false}
        settings={initialSettings}
        onClose={() => {}}
        onSave={() => {}}
      />
    );
    expect(screen.queryByText(/Preferences/i)).toBeNull();
  });

  it('renders settings fields initialized with current values', () => {
    render(
      <SettingsModal
        isOpen={true}
        settings={initialSettings}
        onClose={() => {}}
        onSave={() => {}}
      />
    );

    expect(screen.getByDisplayValue('C:\\Users\\User\\Downloads')).toBeDefined();
    expect(screen.getByDisplayValue('5')).toBeDefined();
    expect(screen.getByDisplayValue('1024')).toBeDefined();
  });

  it('supports browsing directory to change download location', async () => {
    const onBrowseDirectory = vi.fn().mockResolvedValue('D:\\Torrents\\Complete');

    render(
      <SettingsModal
        isOpen={true}
        settings={initialSettings}
        onClose={() => {}}
        onSave={() => {}}
        onBrowseDirectory={onBrowseDirectory}
      />
    );

    const browseBtn = screen.getByRole('button', { name: /browse/i });
    fireEvent.click(browseBtn);

    await waitFor(() => {
      expect(onBrowseDirectory).toHaveBeenCalledTimes(1);
      expect(screen.getByDisplayValue('D:\\Torrents\\Complete')).toBeDefined();
    });
  });

  it('saves modified settings on Save button click', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    render(
      <SettingsModal
        isOpen={true}
        settings={initialSettings}
        onClose={onClose}
        onSave={onSave}
      />
    );

    const maxDownloadsInput = screen.getByLabelText(/Maximum active downloads/i);
    fireEvent.change(maxDownloadsInput, { target: { value: '10' } });

    const downloadSpeedInput = screen.getByLabelText(/Maximum download speed/i);
    fireEvent.change(downloadSpeedInput, { target: { value: '5000' } });

    const saveBtn = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveBtn);

    expect(onSave).toHaveBeenCalledWith({
      downloadPath: 'C:\\Users\\User\\Downloads',
      maxActiveDownloads: 10,
      downloadSpeedLimit: 5000,
      uploadSpeedLimit: 1024,
      port: 6881,
    });
  });

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();

    render(
      <SettingsModal
        isOpen={true}
        settings={initialSettings}
        onClose={onClose}
        onSave={() => {}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
