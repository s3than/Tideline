import { getSetting, setSetting, addSyncLogEntry, pruneSyncLog } from './db';
import { syncAllLibraries, diffSyncAllLibraries } from './sync';

let pollTimer: ReturnType<typeof setInterval> | null = null;

async function tick(): Promise<void> {
  if (getSetting('sync_enabled', '1') !== '1') return;

  if (getSetting('sync_schedule_enabled', '0') === '1') {
    const nextStr = getSetting('next_scheduled_sync', '');
    if (!nextStr || Date.now() >= new Date(nextStr).getTime()) {
      const intervalHours = parseInt(getSetting('sync_interval_hours', '6'), 10);
      setSetting('last_scheduled_sync', new Date().toISOString());
      setSetting(
        'next_scheduled_sync',
        new Date(Date.now() + intervalHours * 60 * 60 * 1000).toISOString(),
      );
      const fullStart = Date.now();
      const fullResults = await syncAllLibraries();
      addSyncLogEntry('full', fullResults, Date.now() - fullStart);
      pruneSyncLog(parseInt(getSetting('sync_log_max_entries', '20'), 10));
    }
  }

  if (getSetting('partial_sync_enabled', '0') === '1') {
    const nextStr = getSetting('next_partial_sync', '');
    if (!nextStr || Date.now() >= new Date(nextStr).getTime()) {
      const intervalHours = parseInt(getSetting('partial_sync_interval_hours', '6'), 10);
      setSetting('last_partial_sync', new Date().toISOString());
      setSetting(
        'next_partial_sync',
        new Date(Date.now() + intervalHours * 60 * 60 * 1000).toISOString(),
      );
      const partialStart = Date.now();
      const partialResults = await diffSyncAllLibraries();
      addSyncLogEntry('partial', partialResults, Date.now() - partialStart);
      pruneSyncLog(parseInt(getSetting('sync_log_max_entries', '20'), 10));
    }
  }
}

export function initScheduler(): void {
  if (pollTimer !== null) return;
  pollTimer = setInterval(() => {
    tick().catch(() => {});
  }, 60_000);
  tick().catch(() => {});
}

export function rescheduleNext(type: 'full' | 'partial' | 'both' = 'both'): void {
  if (type === 'full' || type === 'both') {
    const intervalHours = parseInt(getSetting('sync_interval_hours', '6'), 10);
    setSetting(
      'next_scheduled_sync',
      new Date(Date.now() + intervalHours * 60 * 60 * 1000).toISOString(),
    );
  }
  if (type === 'partial' || type === 'both') {
    const intervalHours = parseInt(getSetting('partial_sync_interval_hours', '6'), 10);
    setSetting(
      'next_partial_sync',
      new Date(Date.now() + intervalHours * 60 * 60 * 1000).toISOString(),
    );
  }
}
