import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const DB_PATH = process.env.DB_FILE ?? '/data/tideline.db';

let _db: Database.Database | null = null;

export function openDb(): Database.Database {
  if (_db) return _db;

  mkdirSync(dirname(DB_PATH), { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS libraries (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      slug              TEXT NOT NULL UNIQUE,
      label             TEXT NOT NULL,
      jellyfin_name     TEXT NOT NULL,
      item_type         TEXT NOT NULL CHECK(item_type IN ('Movie','Series','Collection')),
      display_order     INTEGER NOT NULL DEFAULT 0,
      sort              TEXT NOT NULL DEFAULT 'expiry' CHECK(sort IN ('alpha_asc','alpha_desc','expiry')),
      view_in_menu      INTEGER NOT NULL DEFAULT 1,
      view_leaving_soon INTEGER NOT NULL DEFAULT 1,
      is_proxy          INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS picks (
      library_slug TEXT NOT NULL REFERENCES libraries(slug) ON DELETE CASCADE,
      month        TEXT NOT NULL,
      item_id      TEXT NOT NULL,
      recorded_at  TEXT NOT NULL DEFAULT (date('now')),
      PRIMARY KEY (library_slug, month)
    );

    CREATE TABLE IF NOT EXISTS leaving_soon (
      item_id    TEXT PRIMARY KEY,
      first_seen TEXT NOT NULL,
      expires_on TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      jellyfin_id           TEXT PRIMARY KEY,
      name                  TEXT NOT NULL,
      primary_image_tag     TEXT,
      is_administrator      INTEGER NOT NULL DEFAULT 0,
      enable_media_playback INTEGER NOT NULL DEFAULT 1,
      last_seen             TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token           TEXT PRIMARY KEY,
      jellyfin_id     TEXT NOT NULL REFERENCES users(jellyfin_id) ON DELETE CASCADE,
      jellyfin_token  TEXT NOT NULL DEFAULT '',
      ip_address      TEXT,
      user_agent      TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      last_active_at  TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_jellyfin_id ON sessions(jellyfin_id);

    CREATE TABLE IF NOT EXISTS user_library_sort (
      jellyfin_id  TEXT NOT NULL REFERENCES users(jellyfin_id) ON DELETE CASCADE,
      library_slug TEXT NOT NULL REFERENCES libraries(slug) ON DELETE CASCADE,
      view         TEXT NOT NULL DEFAULT 'leaving_soon' CHECK(view IN ('leaving_soon','library_view')),
      sort         TEXT NOT NULL CHECK(sort IN ('alpha_asc','alpha_desc','expiry')),
      PRIMARY KEY (jellyfin_id, library_slug, view)
    );

    CREATE TABLE IF NOT EXISTS keep_requests (
      item_id      TEXT NOT NULL,
      jellyfin_id  TEXT NOT NULL REFERENCES users(jellyfin_id) ON DELETE CASCADE,
      item_name    TEXT NOT NULL,
      library_slug TEXT NOT NULL,
      requested_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (item_id, jellyfin_id)
    );

    CREATE TABLE IF NOT EXISTS leaving_soon_nominations (
      item_id      TEXT NOT NULL,
      jellyfin_id  TEXT NOT NULL REFERENCES users(jellyfin_id) ON DELETE CASCADE,
      item_name    TEXT NOT NULL,
      library_slug TEXT,
      nominated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (item_id, jellyfin_id)
    );

    CREATE TABLE IF NOT EXISTS login_attempts (
      ip               TEXT PRIMARY KEY,
      count            INTEGER NOT NULL DEFAULT 0,
      first_attempt_at TEXT NOT NULL,
      locked_until     TEXT
    );

    CREATE TABLE IF NOT EXISTS media (
      jellyfin_id      TEXT PRIMARY KEY,
      library_slug     TEXT NOT NULL REFERENCES libraries(slug) ON DELETE CASCADE,
      name             TEXT NOT NULL,
      sort_name        TEXT,
      year             INTEGER,
      premiere_date    TEXT,
      date_added       TEXT,
      overview         TEXT,
      tagline          TEXT,
      poster_tag       TEXT,
      backdrop_tag     TEXT,
      community_rating REAL,
      critic_rating    REAL,
      official_rating  TEXT,
      genres           TEXT,
      provider_ids     TEXT,
      runtime_ticks    INTEGER,
      series_status    TEXT,
      episode_count    INTEGER,
      item_type        TEXT NOT NULL,
      leaving_soon     INTEGER NOT NULL DEFAULT 0,
      leaving_days     INTEGER,
      series_id        TEXT,
      index_number     INTEGER,
      series_name      TEXT,
      synced_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_media_library ON media(library_slug);
    CREATE INDEX IF NOT EXISTS idx_media_leaving  ON media(library_slug, leaving_soon);
  `);

  // Migration: add columns to sessions for existing databases
  const sessionCols = (_db.pragma('table_info(sessions)') as { name: string }[]).map((c) => c.name);
  if (!sessionCols.includes('jellyfin_token')) {
    _db.exec(`ALTER TABLE sessions ADD COLUMN jellyfin_token TEXT NOT NULL DEFAULT ''`);
  }
  if (!sessionCols.includes('ip_address')) {
    _db.exec(`ALTER TABLE sessions ADD COLUMN ip_address TEXT`);
  }
  if (!sessionCols.includes('user_agent')) {
    _db.exec(`ALTER TABLE sessions ADD COLUMN user_agent TEXT`);
  }
  if (!sessionCols.includes('last_active_at')) {
    _db.exec(`ALTER TABLE sessions ADD COLUMN last_active_at TEXT`);
    _db.exec(`UPDATE sessions SET last_active_at = datetime('now')`);
  }

  // Migration: add FK cascade to picks table for existing databases
  const picksFKs = _db.pragma('foreign_key_list(picks)') as { table: string }[];
  if (!picksFKs.some((fk) => fk.table === 'libraries')) {
    _db.transaction(() => {
      _db!.exec(`
        CREATE TABLE picks_new (
          library_slug TEXT NOT NULL REFERENCES libraries(slug) ON DELETE CASCADE,
          month        TEXT NOT NULL,
          item_id      TEXT NOT NULL,
          recorded_at  TEXT NOT NULL DEFAULT (date('now')),
          PRIMARY KEY (library_slug, month)
        );
        INSERT OR IGNORE INTO picks_new SELECT * FROM picks;
        DROP TABLE picks;
        ALTER TABLE picks_new RENAME TO picks;
      `);
    })();
  }

  return _db;
}
