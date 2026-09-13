import { randomBytes } from 'node:crypto';
import { openDb } from './connection';
import type { SessionRow, UserRow } from './types';
import { getUserById } from './users';

// Opaque random tokens, never the user's own id — a leaked/guessed token can't
// be derived from anything public, and sessions are individually revocable.

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function pruneExpiredSessions(): void {
  openDb().prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString());
}

export function createSession(
  jellyfinId: string,
  jellyfinToken: string,
  ipAddress: string | null,
  userAgent: string | null,
): { token: string; expiresAt: string } {
  pruneExpiredSessions();
  const db = openDb();
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.prepare(
    "INSERT INTO sessions (token, jellyfin_id, jellyfin_token, ip_address, user_agent, created_at, last_active_at, expires_at) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)",
  ).run(token, jellyfinId, jellyfinToken, ipAddress, userAgent, expiresAt);

  return { token, expiresAt };
}

export function getSessionUser(token: string): { user: UserRow; jellyfinToken: string } | null {
  const db = openDb();
  const row = db
    .prepare('SELECT jellyfin_id, jellyfin_token, expires_at FROM sessions WHERE token = ?')
    .get(token) as { jellyfin_id: string; jellyfin_token: string; expires_at: string } | undefined;

  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  const user = getUserById(row.jellyfin_id);
  if (!user) return null;
  return { user, jellyfinToken: row.jellyfin_token };
}

// Only writes if last_active_at is stale by more than 5 minutes to avoid a
// write on every single request.
export function touchSession(token: string): void {
  openDb()
    .prepare(
      `UPDATE sessions SET last_active_at = datetime('now')
       WHERE token = ? AND (last_active_at IS NULL OR last_active_at < datetime('now', '-5 minutes'))`,
    )
    .run(token);
}

export function enforceSessionLimit(jellyfinId: string, max: number): void {
  const db = openDb();
  const rows = db
    .prepare('SELECT token FROM sessions WHERE jellyfin_id = ? ORDER BY last_active_at DESC')
    .all(jellyfinId) as { token: string }[];

  if (rows.length > max) {
    const toDelete = rows.slice(max);
    const del = db.prepare('DELETE FROM sessions WHERE token = ?');
    for (const row of toDelete) del.run(row.token);
  }
}

export function getAllSessions(): SessionRow[] {
  const rows = openDb()
    .prepare(
      `SELECT s.token, s.jellyfin_id, u.name, s.ip_address, s.user_agent,
              s.created_at, s.last_active_at, s.expires_at
       FROM sessions s
       JOIN users u ON u.jellyfin_id = s.jellyfin_id
       WHERE s.expires_at > datetime('now')
       ORDER BY s.last_active_at DESC NULLS LAST`,
    )
    .all() as {
    token: string;
    jellyfin_id: string;
    name: string;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
    last_active_at: string;
    expires_at: string;
  }[];

  return rows.map((r) => ({
    token: r.token,
    jellyfinId: r.jellyfin_id,
    userName: r.name,
    ipAddress: r.ip_address,
    userAgent: r.user_agent,
    createdAt: r.created_at,
    lastActiveAt: r.last_active_at,
    expiresAt: r.expires_at,
  }));
}

export function deleteSession(token: string): void {
  openDb().prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function deleteSessionsForUser(jellyfinId: string): void {
  openDb().prepare('DELETE FROM sessions WHERE jellyfin_id = ?').run(jellyfinId);
}
