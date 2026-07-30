import { openDb } from './connection';
import type { LeavingSoonEntry } from './types';
import { clearNominations } from './nominations';
import { todayStr } from '../format';

export function leavingSoonExpiry(days: number): LeavingSoonEntry {
  const today = todayStr();
  const d = new Date(today);
  d.setDate(d.getDate() + days);
  return { firstSeen: today, expiresOn: d.toISOString().slice(0, 10) };
}

export function getLeavingSoonEntry(itemId: string): LeavingSoonEntry | null {
  const row = openDb()
    .prepare('SELECT first_seen, expires_on FROM leaving_soon WHERE item_id = ?')
    .get(itemId) as { first_seen: string; expires_on: string } | undefined;

  return row ? { firstSeen: row.first_seen, expiresOn: row.expires_on } : null;
}

export function upsertLeavingSoon(itemId: string, entry: LeavingSoonEntry): void {
  openDb()
    .prepare(
      'INSERT OR REPLACE INTO leaving_soon (item_id, first_seen, expires_on) VALUES (?, ?, ?)',
    )
    .run(itemId, entry.firstSeen, entry.expiresOn);
}

export function tagItemLeavingSoon(itemId: string, entry: LeavingSoonEntry): void {
  openDb().transaction(() => {
    clearNominations(itemId);
    upsertLeavingSoon(itemId, entry);
  })();
}

export function removeLeavingSoon(itemId: string): void {
  openDb().prepare('DELETE FROM leaving_soon WHERE item_id = ?').run(itemId);
}

export function pruneStaleLeavingSoon(): void {
  openDb()
    .prepare(
      `
    DELETE FROM leaving_soon
    WHERE item_id NOT IN (
      SELECT jellyfin_id FROM media WHERE leaving_soon = 1
    )
    AND EXISTS (
      SELECT 1 FROM media WHERE leaving_soon = 1
    )
  `,
    )
    .run();
}
