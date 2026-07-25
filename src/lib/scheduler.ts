import { getSetting, setSetting } from './db';
import { syncAllLibraries } from './sync';

let pollTimer: ReturnType<typeof setInterval> | null = null;

async function tick(): Promise<void> {
  if (getSetting('sync_schedule_enabled', '0') !== '1') return;
  if (getSetting('sync_enabled', '1') !== '1') return;

  const nextStr = getSetting('next_scheduled_sync', '');
  if (nextStr && Date.now() < new Date(nextStr).getTime()) return;

  const intervalHours = parseInt(getSetting('sync_interval_hours', '6'), 10);
  setSetting('last_scheduled_sync', new Date().toISOString());
  setSetting(
    'next_scheduled_sync',
    new Date(Date.now() + intervalHours * 60 * 60 * 1000).toISOString(),
  );
  await syncAllLibraries();
}

export function initScheduler(): void {
  if (pollTimer !== null) return;
  pollTimer = setInterval(() => {
    tick().catch(() => {});
  }, 60_000);
  tick().catch(() => {});
}

// Called after saving sync_schedule_enabled or sync_interval_hours so the
// next sync is rescheduled from now rather than keeping the old countdown.
export function rescheduleNext(): void {
  const intervalHours = parseInt(getSetting('sync_interval_hours', '6'), 10);
  setSetting(
    'next_scheduled_sync',
    new Date(Date.now() + intervalHours * 60 * 60 * 1000).toISOString(),
  );
}
