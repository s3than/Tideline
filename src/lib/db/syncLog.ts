import { openDb } from './connection';
import type { SyncResult } from './types';

export interface SyncLogEntry {
  id: number;
  runAt: string;
  type: 'full' | 'partial';
  durationMs: number;
  results: SyncResult[];
}

export function addSyncLogEntry(
  type: 'full' | 'partial',
  results: SyncResult[],
  durationMs: number,
): void {
  openDb()
    .prepare(`INSERT INTO sync_log (type, duration_ms, results) VALUES (?, ?, ?)`)
    .run(type, durationMs, JSON.stringify(results));
}

export function pruneSyncLog(maxEntries: number): void {
  openDb()
    .prepare(
      `DELETE FROM sync_log WHERE id NOT IN (
         SELECT id FROM sync_log ORDER BY id DESC LIMIT ?
       )`,
    )
    .run(maxEntries);
}

export function getSyncLog(limit = 20): SyncLogEntry[] {
  const rows = openDb().prepare(`SELECT * FROM sync_log ORDER BY id DESC LIMIT ?`).all(limit) as {
    id: number;
    run_at: string;
    type: string;
    duration_ms: number;
    results: string;
  }[];
  return rows.map((r) => ({
    id: r.id,
    runAt: r.run_at,
    type: r.type as 'full' | 'partial',
    durationMs: r.duration_ms,
    results: JSON.parse(r.results) as SyncResult[],
  }));
}
