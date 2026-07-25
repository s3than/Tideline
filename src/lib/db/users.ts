import { openDb } from './connection';
import type { UserRow, UserWithSessions } from './types';
import { pruneExpiredSessions } from './sessions';

export function upsertUser(user: Omit<UserRow, 'lastSeen'>): void {
  openDb()
    .prepare(
      `
      INSERT INTO users (jellyfin_id, name, primary_image_tag, is_administrator, enable_media_playback, last_seen)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(jellyfin_id) DO UPDATE SET
        name = excluded.name,
        primary_image_tag = excluded.primary_image_tag,
        is_administrator = excluded.is_administrator,
        enable_media_playback = excluded.enable_media_playback,
        last_seen = datetime('now')
    `,
    )
    .run(
      user.jellyfinId,
      user.name,
      user.primaryImageTag ?? null,
      user.isAdministrator ? 1 : 0,
      user.enableMediaPlayback ? 1 : 0,
    );
}

export function getUserById(jellyfinId: string): UserRow | null {
  const row = openDb().prepare('SELECT * FROM users WHERE jellyfin_id = ?').get(jellyfinId) as
    | {
        jellyfin_id: string;
        name: string;
        primary_image_tag: string | null;
        is_administrator: number;
        enable_media_playback: number;
        last_seen: string;
      }
    | undefined;

  if (!row) return null;
  return {
    jellyfinId: row.jellyfin_id,
    name: row.name,
    primaryImageTag: row.primary_image_tag,
    isAdministrator: row.is_administrator === 1,
    enableMediaPlayback: row.enable_media_playback === 1,
    lastSeen: row.last_seen,
  };
}

export function getUsersWithSessionCounts(): UserWithSessions[] {
  pruneExpiredSessions();
  const db = openDb();

  const rows = db
    .prepare(
      `
    SELECT u.*, COUNT(s.token) as active_sessions
    FROM users u
    LEFT JOIN sessions s ON s.jellyfin_id = u.jellyfin_id
    GROUP BY u.jellyfin_id
    ORDER BY u.last_seen DESC
  `,
    )
    .all() as Array<{
    jellyfin_id: string;
    name: string;
    primary_image_tag: string | null;
    is_administrator: number;
    enable_media_playback: number;
    last_seen: string;
    active_sessions: number;
  }>;

  return rows.map((row) => ({
    jellyfinId: row.jellyfin_id,
    name: row.name,
    primaryImageTag: row.primary_image_tag,
    isAdministrator: row.is_administrator === 1,
    enableMediaPlayback: row.enable_media_playback === 1,
    lastSeen: row.last_seen,
    activeSessions: row.active_sessions,
  }));
}
