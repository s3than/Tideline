import { openDb } from './connection';

export interface NominationGroup {
  itemId: string;
  itemName: string;
  librarySlug: string | null;
  count: number;
  users: { name: string; nominatedAt: string }[];
  itemType: string | null;
  seriesName: string | null;
  indexNumber: number | null;
  seriesStatus: string | null;
}

export function addNomination(
  itemId: string,
  userId: string,
  itemName: string,
  librarySlug: string | null,
): void {
  const db = openDb();
  db.transaction(() => {
    db.prepare(
      `
      INSERT INTO leaving_soon_nominations (item_id, jellyfin_id, item_name, library_slug)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(item_id, jellyfin_id) DO NOTHING
    `,
    ).run(itemId, userId, itemName, librarySlug ?? null);
    db.prepare('DELETE FROM keep_requests WHERE item_id = ? AND jellyfin_id = ?').run(
      itemId,
      userId,
    );
  })();
}

export function removeNomination(itemId: string, userId: string): void {
  openDb()
    .prepare('DELETE FROM leaving_soon_nominations WHERE item_id = ? AND jellyfin_id = ?')
    .run(itemId, userId);
}

export function getNominationItemIdsForUser(userId: string): Set<string> {
  const rows = openDb()
    .prepare('SELECT item_id FROM leaving_soon_nominations WHERE jellyfin_id = ?')
    .all(userId) as { item_id: string }[];
  return new Set(rows.map((r) => r.item_id));
}

export function getNominationCount(itemId: string): number {
  const row = openDb()
    .prepare('SELECT COUNT(*) AS c FROM leaving_soon_nominations WHERE item_id = ?')
    .get(itemId) as { c: number };
  return row.c;
}

export function clearNominations(itemId: string): void {
  openDb().prepare('DELETE FROM leaving_soon_nominations WHERE item_id = ?').run(itemId);
}

export function getAllNominations(): NominationGroup[] {
  const rows = openDb()
    .prepare(
      `
      SELECT n.item_id, n.item_name, n.library_slug, n.nominated_at, u.name AS user_name,
             m.item_type, m.series_name, m.index_number, m.series_status
      FROM leaving_soon_nominations n
      JOIN users u ON u.jellyfin_id = n.jellyfin_id
      LEFT JOIN media m ON m.jellyfin_id = n.item_id
      ORDER BY n.item_name COLLATE NOCASE, n.nominated_at
    `,
    )
    .all() as {
    item_id: string;
    item_name: string;
    library_slug: string | null;
    nominated_at: string;
    user_name: string;
    item_type: string | null;
    series_name: string | null;
    index_number: number | null;
    series_status: string | null;
  }[];

  const groups = new Map<string, NominationGroup>();
  for (const row of rows) {
    let group = groups.get(row.item_id);
    if (!group) {
      group = {
        itemId: row.item_id,
        itemName: row.item_name,
        librarySlug: row.library_slug,
        count: 0,
        users: [],
        itemType: row.item_type,
        seriesName: row.series_name,
        indexNumber: row.index_number,
        seriesStatus: row.series_status,
      };
      groups.set(row.item_id, group);
    }
    group.count++;
    group.users.push({ name: row.user_name, nominatedAt: row.nominated_at });
  }
  return [...groups.values()];
}
