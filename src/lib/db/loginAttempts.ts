import { openDb } from './connection';
import { getSetting } from './settings';

// Per-IP brute-force guard on /api/auth/login, since it proxies real
// Jellyfin credentials and would otherwise let anyone hammer the upstream
// server at whatever pace they like.
function getRateLimitConfig() {
  const maxAttempts = parseInt(
    process.env.RATE_LIMIT_MAX_ATTEMPTS ?? getSetting('rate_limit_max_attempts', '5'),
    10,
  );
  const windowMs =
    parseInt(
      process.env.RATE_LIMIT_WINDOW_MINUTES ?? getSetting('rate_limit_window_minutes', '15'),
      10,
    ) *
    60 *
    1000;
  const lockoutMs =
    parseInt(
      process.env.RATE_LIMIT_LOCKOUT_MINUTES ?? getSetting('rate_limit_lockout_minutes', '15'),
      10,
    ) *
    60 *
    1000;
  return { maxAttempts, windowMs, lockoutMs };
}

export function isLoginLocked(ip: string): boolean {
  const row = openDb().prepare('SELECT locked_until FROM login_attempts WHERE ip = ?').get(ip) as
    { locked_until: string | null } | undefined;
  if (!row?.locked_until) return false;
  return new Date(row.locked_until).getTime() > Date.now();
}

export function recordFailedLogin(ip: string): void {
  const db = openDb();
  const now = Date.now();
  const { maxAttempts, windowMs, lockoutMs } = getRateLimitConfig();
  const row = db
    .prepare('SELECT count, first_attempt_at FROM login_attempts WHERE ip = ?')
    .get(ip) as { count: number; first_attempt_at: string } | undefined;

  if (!row || now - new Date(row.first_attempt_at).getTime() > windowMs) {
    db.prepare(
      `
      INSERT INTO login_attempts (ip, count, first_attempt_at, locked_until)
      VALUES (?, 1, ?, NULL)
      ON CONFLICT(ip) DO UPDATE SET count = 1, first_attempt_at = excluded.first_attempt_at, locked_until = NULL
    `,
    ).run(ip, new Date(now).toISOString());
    return;
  }

  const count = row.count + 1;
  const lockedUntil = count >= maxAttempts ? new Date(now + lockoutMs).toISOString() : null;
  db.prepare('UPDATE login_attempts SET count = ?, locked_until = ? WHERE ip = ?').run(
    count,
    lockedUntil,
    ip,
  );
}

export function clearLoginAttempts(ip: string): void {
  openDb().prepare('DELETE FROM login_attempts WHERE ip = ?').run(ip);
}
