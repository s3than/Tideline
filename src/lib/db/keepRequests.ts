import { openDb } from './connection';

// item_name and library_slug are snapshots taken at request time — media rows
// are cleared and re-upserted on every sync, so a live join could briefly
// dangle mid-sync and the admin list should keep working regardless.

export interface KeepRequestGroup {
  itemId: string;
  itemName: string;
  librarySlug: string;
  users: { name: string; requestedAt: string }[];
}

// A request is valid for an item that is currently leaving soon, or for the
// series a leaving-soon season belongs to (grouped show cards request the
// whole show). Returns false if the item isn't eligible.
export function addKeepRequest(itemId: string, userId: string): boolean {
  const db = openDb();

  let target = db
    .prepare('SELECT name, library_slug FROM media WHERE jellyfin_id = ? AND leaving_soon = 1')
    .get(itemId) as { name: string; library_slug: string } | undefined;

  if (!target) {
    const viaSeason = db
      .prepare(
        'SELECT series_name, library_slug FROM media WHERE series_id = ? AND leaving_soon = 1 LIMIT 1',
      )
      .get(itemId) as { series_name: string | null; library_slug: string } | undefined;
    if (viaSeason) {
      const seriesRow = db.prepare('SELECT name FROM media WHERE jellyfin_id = ?').get(itemId) as
        { name: string } | undefined;
      target = {
        name: viaSeason.series_name ?? seriesRow?.name ?? 'Unknown',
        library_slug: viaSeason.library_slug,
      };
    }
  }

  if (!target) return false;

  db.prepare(
    `
    INSERT INTO keep_requests (item_id, jellyfin_id, item_name, library_slug)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(item_id, jellyfin_id) DO NOTHING
  `,
  ).run(itemId, userId, target.name, target.library_slug);
  // A keep request and a leaving-soon nomination are mutually exclusive per user
  db.prepare('DELETE FROM leaving_soon_nominations WHERE item_id = ? AND jellyfin_id = ?').run(
    itemId,
    userId,
  );
  return true;
}

export function removeKeepRequest(itemId: string, userId: string): void {
  openDb()
    .prepare('DELETE FROM keep_requests WHERE item_id = ? AND jellyfin_id = ?')
    .run(itemId, userId);
}

export function getKeepRequestItemIdsForUser(userId: string): Set<string> {
  const rows = openDb()
    .prepare('SELECT item_id FROM keep_requests WHERE jellyfin_id = ?')
    .all(userId) as { item_id: string }[];
  return new Set(rows.map((r) => r.item_id));
}

export function getAllKeepRequests(): KeepRequestGroup[] {
  const rows = openDb()
    .prepare(
      `
      SELECT k.item_id, k.item_name, k.library_slug, k.requested_at, u.name AS user_name
      FROM keep_requests k
      JOIN users u ON u.jellyfin_id = k.jellyfin_id
      ORDER BY k.item_name COLLATE NOCASE, k.requested_at
    `,
    )
    .all() as {
    item_id: string;
    item_name: string;
    library_slug: string;
    requested_at: string;
    user_name: string;
  }[];

  const groups = new Map<string, KeepRequestGroup>();
  for (const row of rows) {
    let group = groups.get(row.item_id);
    if (!group) {
      group = {
        itemId: row.item_id,
        itemName: row.item_name,
        librarySlug: row.library_slug,
        users: [],
      };
      groups.set(row.item_id, group);
    }
    group.users.push({ name: row.user_name, requestedAt: row.requested_at });
  }
  return [...groups.values()];
}

// A request is resolved once its item is no longer leaving soon — whether the
// admin kept it or it left. Same empty-set guard as pruneStaleLeavingSoon.
export function clearKeepRequests(itemId: string): void {
  openDb().prepare('DELETE FROM keep_requests WHERE item_id = ?').run(itemId);
}

export function pruneStaleKeepRequests(): void {
  openDb()
    .prepare(
      `
    DELETE FROM keep_requests
    WHERE item_id NOT IN (
      SELECT jellyfin_id FROM media WHERE leaving_soon = 1
      UNION
      SELECT series_id FROM media WHERE leaving_soon = 1 AND series_id IS NOT NULL
    )
    AND EXISTS (
      SELECT 1 FROM media WHERE leaving_soon = 1
    )
  `,
    )
    .run();
}
