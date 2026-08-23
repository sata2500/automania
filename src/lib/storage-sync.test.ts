import { describe, it, expect, vi } from 'vitest';
import { subscribeSyncStatus, notifySyncStatus, getSyncStatus } from './storage-service';

describe('SyncStatus notification system', () => {
  it('allows subscribing and receiving sync updates', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSyncStatus(listener);

    // Initial status received upon subscribing
    expect(listener).toHaveBeenCalled();

    // Trigger migration progress notification
    notifySyncStatus({
      isSyncing: true,
      isMigrating: true,
      message: 'Görseller buluta aktarılıyor (2/5)...',
      progress: 40,
      current: 2,
      total: 5,
    });

    const status = getSyncStatus();
    expect(status.isSyncing).toBe(true);
    expect(status.isMigrating).toBe(true);
    expect(status.message).toBe('Görseller buluta aktarılıyor (2/5)...');
    expect(status.progress).toBe(40);
    expect(status.current).toBe(2);
    expect(status.total).toBe(5);

    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({
        isSyncing: true,
        isMigrating: true,
        progress: 40,
      })
    );

    // Complete sync
    notifySyncStatus({
      isSyncing: false,
      isMigrating: false,
      message: 'Verileriniz bulut hesabınıza başarıyla senkronize edildi!',
      progress: 100,
    });

    expect(getSyncStatus().isMigrating).toBe(false);
    expect(getSyncStatus().progress).toBe(100);

    unsubscribe();
  });
});
