import { openDb } from './connection';
import { lcgIndex, monthSeed } from '../pickSeed';
import { getRecentPickIds } from './picks';
import type { MediaRow, MediaInsert, LeavingSoonMediaRow, LibraryDisplayItem } from './types';
import { todayStr } from '../format';

function rowToMedia(row: {
  jellyfin_id: string;
  library_slug: string;
  name: string;
  sort_name: string | null;
  year: number | null;
  premiere_date: string | null;
  date_added: string | null;
  overview: string | null;
  tagline: string | null;
  poster_tag: string | null;
  backdrop_tag: string | null;
  community_rating: number | null;
  critic_rating: number | null;
  official_rating: string | null;
  genres: string | null;
  provider_ids: string | null;
  runtime_ticks: number | null;
  series_status: string | null;
  episode_count: number | null;
  item_type: string;
  leaving_soon: number;
  leaving_days: number | null;
  synced_at: string;
  series_id: string | null;
  index_number: number | null;
  series_name: string | null;
  jellyfin_last_saved: string | null;
}): MediaRow {
  return {
    jellyfinId: row.jellyfin_id,
    librarySlug: row.library_slug,
    name: row.name,
    sortName: row.sort_name,
    year: row.year,
    premiereDate: row.premiere_date,
    dateAdded: row.date_added,
    overview: row.overview,
    tagline: row.tagline,
    posterTag: row.poster_tag,
    backdropTag: row.backdrop_tag,
    communityRating: row.community_rating,
    criticRating: row.critic_rating,
    officialRating: row.official_rating,
    genres: row.genres ? JSON.parse(row.genres) : null,
    providerIds: row.provider_ids ? JSON.parse(row.provider_ids) : null,
    runtimeTicks: row.runtime_ticks,
    seriesStatus: row.series_status,
    episodeCount: row.episode_count,
    itemType: row.item_type as 'Movie' | 'Series' | 'Season',
    leavingSoon: row.leaving_soon === 1,
    leavingDays: row.leaving_days,
    syncedAt: row.synced_at,
    seriesId: row.series_id,
    indexNumber: row.index_number,
    seriesName: row.series_name,
    jellyfinLastSaved: row.jellyfin_last_saved,
  };
}

export function toLibraryDisplayItem(row: MediaRow): LibraryDisplayItem {
  return {
    id: row.jellyfinId,
    name: row.name,
    year: row.year ?? undefined,
    overview: row.overview,
    posterTag: row.posterTag,
  };
}

export function upsertMediaBatch(rows: MediaInsert[]): void {
  if (rows.length === 0) return;
  const db = openDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO media
      (jellyfin_id, library_slug, name, sort_name, year, premiere_date, date_added,
       overview, tagline, poster_tag, backdrop_tag, community_rating, critic_rating,
       official_rating, genres, provider_ids, runtime_ticks, series_status, episode_count,
       item_type, leaving_soon, leaving_days, series_id, index_number, series_name,
       jellyfin_last_saved, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  db.transaction(() => {
    for (const r of rows) {
      stmt.run(
        r.jellyfinId,
        r.librarySlug,
        r.name,
        r.sortName,
        r.year ?? null,
        r.premiereDate ?? null,
        r.dateAdded ?? null,
        r.overview ?? null,
        r.tagline ?? null,
        r.posterTag ?? null,
        r.backdropTag ?? null,
        r.communityRating ?? null,
        r.criticRating ?? null,
        r.officialRating ?? null,
        r.genres ? JSON.stringify(r.genres) : null,
        r.providerIds ? JSON.stringify(r.providerIds) : null,
        r.runtimeTicks ?? null,
        r.seriesStatus ?? null,
        r.episodeCount ?? null,
        r.itemType,
        r.leavingSoon ? 1 : 0,
        r.leavingDays ?? null,
        r.seriesId ?? null,
        r.indexNumber ?? null,
        r.seriesName ?? null,
        r.jellyfinLastSaved ?? null,
      );
    }
  })();
}

export function getMediaStubsForLibrary(slug: string): Map<string, string | null> {
  const rows = openDb()
    .prepare(
      `SELECT jellyfin_id, jellyfin_last_saved FROM media
       WHERE library_slug = ? AND item_type != 'Season'`,
    )
    .all(slug) as { jellyfin_id: string; jellyfin_last_saved: string | null }[];
  return new Map(rows.map((r) => [r.jellyfin_id, r.jellyfin_last_saved]));
}

export function deleteMediaByIds(ids: string[]): void {
  if (ids.length === 0) return;
  const db = openDb();
  const CHUNK = 900;
  db.transaction(() => {
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      db.prepare(`DELETE FROM media WHERE jellyfin_id IN (${chunk.map(() => '?').join(',')})`).run(
        ...chunk,
      );
    }
  })();
}

export function deleteSeasonsByLibrary(slug: string): void {
  openDb().prepare(`DELETE FROM media WHERE library_slug = ? AND item_type = 'Season'`).run(slug);
}

export function getMediaPage(
  slug: string,
  offset: number,
  limit: number,
): { items: MediaRow[]; total: number } {
  const db = openDb();
  const { n: total } = db
    .prepare('SELECT COUNT(*) as n FROM media WHERE library_slug = ? AND item_type != ?')
    .get(slug, 'Season') as { n: number };
  if (total === 0) return { items: [], total: 0 };
  const rows = db
    .prepare(
      'SELECT * FROM media WHERE library_slug = ? AND item_type != ? ORDER BY sort_name ASC, name ASC LIMIT ? OFFSET ?',
    )
    .all(slug, 'Season', limit, offset) as Parameters<typeof rowToMedia>[0][];
  return { items: rows.map(rowToMedia), total };
}

export function getLibrarySyncedAt(slug: string): string | null {
  const row = openDb()
    .prepare('SELECT MAX(synced_at) as t FROM media WHERE library_slug = ?')
    .get(slug) as { t: string | null };
  return row.t;
}

export function getMediaCount(slug: string): number {
  const { n } = openDb()
    .prepare('SELECT COUNT(*) as n FROM media WHERE library_slug = ? AND item_type != ?')
    .get(slug, 'Season') as { n: number };
  return n;
}

function queryLeavingSoon(slug?: string): LeavingSoonMediaRow[] {
  const today = todayStr();
  const db = openDb();

  type DbRow = Parameters<typeof rowToMedia>[0] & {
    expires_on: string | null;
    resolved_days: number;
  };

  const where = slug ? 'AND m.library_slug = ?' : '';
  const order = slug
    ? 'resolved_days ASC, m.sort_name ASC'
    : 'm.library_slug ASC, resolved_days ASC, m.sort_name ASC';

  const rows = db
    .prepare(
      `
    SELECT m.*,
      l.expires_on,
      CASE
        WHEN l.expires_on IS NOT NULL
          THEN MAX(0, CAST((julianday(l.expires_on) - julianday(?)) AS INTEGER))
        ELSE COALESCE(m.leaving_days, 30)
      END AS resolved_days
    FROM media m
    LEFT JOIN leaving_soon l ON l.item_id = m.jellyfin_id
    WHERE m.leaving_soon = 1 ${where}
    ORDER BY ${order}
  `,
    )
    .all(...(slug ? [today, slug] : [today])) as DbRow[];

  const untracked = rows.filter((r) => r.expires_on === null);
  if (untracked.length > 0) {
    const initStmt = db.prepare(
      'INSERT OR IGNORE INTO leaving_soon (item_id, first_seen, expires_on) VALUES (?, ?, ?)',
    );
    db.transaction(() => {
      for (const row of untracked) {
        const days = row.leaving_days ?? 30;
        const expires = new Date(today);
        expires.setDate(expires.getDate() + days);
        initStmt.run(row.jellyfin_id, today, expires.toISOString().slice(0, 10));
      }
    })();
  }

  return rows.map((row) => ({ ...rowToMedia(row), resolvedDays: row.resolved_days }));
}

export function getLeavingSoonMedia(slug: string): LeavingSoonMediaRow[] {
  return queryLeavingSoon(slug);
}

export function getAllLeavingSoonMedia(): LeavingSoonMediaRow[] {
  return queryLeavingSoon();
}

export function getMediaById(jellyfinId: string): MediaRow | null {
  const row = openDb().prepare('SELECT * FROM media WHERE jellyfin_id = ?').get(jellyfinId) as
    Parameters<typeof rowToMedia>[0] | undefined;
  return row ? rowToMedia(row) : null;
}

export function getSeasonIdsBySeriesId(seriesId: string): string[] {
  const rows = openDb()
    .prepare("SELECT jellyfin_id FROM media WHERE series_id = ? AND item_type = 'Season'")
    .all(seriesId) as { jellyfin_id: string }[];
  return rows.map((r) => r.jellyfin_id);
}

export function searchMedia(slug: string, query: string, limit: number): MediaRow[] {
  const pattern = `%${query}%`;
  return (
    openDb()
      .prepare(
        'SELECT * FROM media WHERE library_slug = ? AND item_type != ? AND name LIKE ? ORDER BY sort_name ASC, name ASC LIMIT ?',
      )
      .all(slug, 'Season', pattern, limit) as Parameters<typeof rowToMedia>[0][]
  ).map(rowToMedia);
}

export function clearMediaByLibrary(slug: string): void {
  openDb().prepare('DELETE FROM media WHERE library_slug = ?').run(slug);
}

export function getRandomPickFromMedia(slug: string, month: string): MediaRow | null {
  const excludeIds = getRecentPickIds(slug, 6);
  const db = openDb();
  const exclusion =
    excludeIds.length > 0 ? `AND jellyfin_id NOT IN (${excludeIds.map(() => '?').join(',')})` : '';
  const params = [slug, ...excludeIds];

  const { c: count } = db
    .prepare(
      `SELECT COUNT(*) AS c FROM media WHERE library_slug = ? AND item_type != 'Season' ${exclusion}`,
    )
    .get(...params) as { c: number };
  if (count === 0) return null;

  const index = lcgIndex(monthSeed(month, slug), count);
  const row = db
    .prepare(
      `SELECT * FROM media WHERE library_slug = ? AND item_type != 'Season' ${exclusion} ORDER BY jellyfin_id LIMIT 1 OFFSET ?`,
    )
    .get(...params, index) as Parameters<typeof rowToMedia>[0] | undefined;
  return row ? rowToMedia(row) : null;
}
