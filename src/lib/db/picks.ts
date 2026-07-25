import { openDb } from './connection';

export function getPickHistory(slug: string, limit = 6): Array<{ month: string; item_id: string }> {
  return openDb()
    .prepare(
      'SELECT month, item_id FROM picks WHERE library_slug = ? ORDER BY recorded_at DESC, month DESC LIMIT ?',
    )
    .all(slug, limit) as Array<{ month: string; item_id: string }>;
}

export function upsertPick(slug: string, month: string, itemId: string): void {
  const db = openDb();
  db.prepare(
    "INSERT OR REPLACE INTO picks (library_slug, month, item_id, recorded_at) VALUES (?, ?, ?, date('now'))",
  ).run(slug, month, itemId);

  // Trim to 6 most recent per library
  db.prepare(
    `
    DELETE FROM picks WHERE library_slug = ? AND month NOT IN (
      SELECT month FROM picks WHERE library_slug = ?
      ORDER BY recorded_at DESC, month DESC LIMIT 6
    )
  `,
  ).run(slug, slug);
}

export function getRecentPickIds(slug: string, months = 6): string[] {
  return (
    openDb()
      .prepare(
        'SELECT item_id FROM picks WHERE library_slug = ? ORDER BY recorded_at DESC, month DESC LIMIT ?',
      )
      .all(slug, months) as Array<{ item_id: string }>
  ).map((r) => r.item_id);
}
