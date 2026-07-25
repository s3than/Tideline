# Features

A reference for what Tideline currently does.

---

## Authentication & Users

- **Jellyfin-based login** — credentials are validated directly against the Jellyfin API; no passwords are stored locally
- **Session cookies** — sessions are scoped to a synced user row in SQLite and expire on logout
- **Login rate limiting** — configurable max attempts, window, and lockout duration; IP source is selectable (connecting socket, X-Forwarded-For header, or disabled) to handle reverse proxy setups correctly
- **User manager** (Admin panel) — list all synced Jellyfin users, view active session counts, revoke individual sessions

---

## First-Run Setup Wizard

- Wizard at `/setup` for entering Jellyfin URL, optional internal URL, and API key
- **Test Connection** button validates the config before saving
- Automatic redirect flow: unconfigured app → `/setup`; configured but no libraries + admin user → `/admin/setup`
- Once both `JELLYFIN_URL` and `JELLYFIN_API_KEY` are set as environment variables the wizard is skipped entirely

---

## Discover Page

- **Picks of the Month** — one stable pick per tracked library per calendar month, presented as spotlight cards
  - Selected via a linear congruential generator (LCG) seeded by year + month + library slug; deterministic within the month across all page loads
  - Repeat avoidance: the last 5 prior picks per library are excluded from the candidate pool (up to 20 attempts)
  - Picks are stored in SQLite and read from there on subsequent loads; the LCG only runs when no pick exists for the current month
  - Falls back to live Jellyfin data (sorted by title) for libraries that haven't been synced yet
- **Leaving Soon shelves** — per-library horizontal scroll shelf for items tagged `leaving-soon` in Jellyfin
  - Sort controls: A–Z, Z–A, expiry (days remaining) — sort preference is persisted per-user per-library on the server
  - Double-row layout when a library has more than 6 leaving-soon items
  - Season grouping for TV libraries: individual tagged seasons are grouped under their parent show with a per-season countdown
  - Served from the local database for synced libraries; falls back to live Jellyfin calls otherwise

---

## Library Browse

- Paginated poster grid per library at `/library/<slug>`
- Infinite-scroll pagination via the Svelte `LibraryGrid` component (client-side page loading)
- Served from SQLite for synced libraries; live Jellyfin fallback for unsynced
- Item count shown in the heading

---

## Media Detail Pages

Each item at `/media/<jellyfinId>` shows:

- **Backdrop hero** with gradient overlays; falls back to a thumb image or parent series backdrop
- **Logo overlay** when a Jellyfin logo image is available (replaces visible title text)
- Poster, title (or logo), year, runtime, content rating badge, community rating (star + score)
- Genres as pill tags
- Leaving-soon countdown badge with colour-coded urgency (red ≤ 7 days, orange ≤ 14, yellow ≤ 21)
- Tagline and overview
- Director(s) and studio(s)
- Cast grid — up to 14 actors with headshot and role
- **Watch in Jellyfin** primary action button (opens the Jellyfin web client at the item)
- **IMDb** link when the item has an IMDB provider ID
- **Keep request** button (leaving-soon items only) — logged to the database and visible to admins
- **Suggest leaving soon** (nomination) button — lets users flag an item for admin review; shows a count of how many users have suggested it
- Keep request and nomination are mutually exclusive; toggling one removes the other

**Type-specific sections:**

- Series: season list with poster, episode count, year, and per-season leaving-soon badge
- Season: full episode list with stills, episode number, runtime, and overview
- Collection: grid of member items with posters

---

## Search

- Live search across all tracked libraries, routed through the Jellyfin API
- Results grouped by library
- Each result shows title, year, community rating, overview snippet, and poster/backdrop thumbnail
- Minimum 2-character query before results are fetched

---

## Admin Panel

### Libraries

Add, edit, and remove which Jellyfin libraries Tideline tracks. Per-library configuration:

| Field                | Description                                                                     |
| -------------------- | ------------------------------------------------------------------------------- |
| Label                | Display name shown to users                                                     |
| Jellyfin library     | Which Jellyfin library to pull from (picker fetches live Jellyfin library list) |
| Item type            | Movie, Series, or Collection                                                    |
| Display order        | Position in menus and Discover page                                             |
| Default sort         | A–Z, Z–A, or expiry (Leaving Soon sort default)                                 |
| Show in menu         | Whether the library appears in the navigation                                   |
| Show in Leaving Soon | Whether this library's leaving-soon items appear on Discover                    |
| Proxy mode           | Collection libraries only — always fetch live from Jellyfin, never sync to DB   |

### Sync

Trigger a full sync of all libraries or sync individual libraries. Sync pulls Movies, Series, and tagged Seasons from Jellyfin into the `media` table (name, year, overview, tagline, poster/backdrop image tags, genres, ratings, runtime, provider IDs, series status, episode count, leaving-soon state).

### Nominations

Admin view of all user-submitted keep requests and leaving-soon nominations:

- **Keep requests** — items users want to retain; admin can **Untag in Jellyfin** (remove the `leaving-soon` tag) or **Ignore** the request
- **Nominations** — items users suggest should be tagged leaving-soon; admin can **Tag in Jellyfin** (adds `leaving-soon` + `lv-N` tags) with a configurable day count, or **Ignore**
- **Leaving soon by library** — full table of currently tagged items grouped by library; admin can **Retag** with a new day count directly from the panel

### Settings

- **Leaving soon days fallback** — used when a `leaving-soon` item has no `lv-N` tag
- **Login rate-limit IP source** — socket address, X-Forwarded-For, or disabled; includes per-mode warnings about proxy pitfalls
- **Rate limit parameters** — max attempts, window, and lockout duration (env vars take priority if set)
- **Webhook notifications** — POST to a configurable URL on leaving-soon tag/untag and keep requests (see below)

### Users

View all synced Jellyfin users, their active session counts, and revoke individual sessions.

---

---

## Webhook Notifications

A configurable outbound webhook fires a POST request when key events occur. Configured in **Admin → Settings**.

**Supported services** — Discord, Slack, Ntfy, Gotify, or Generic JSON. The service type controls the request body shape; all use `Content-Type: application/json`. Credentials are embedded in the URL (Discord and Slack include the token in the webhook URL; Gotify uses `?token=`).

**Events:**

| Event            | Trigger                                                       |
| ---------------- | ------------------------------------------------------------- |
| `tagged`         | Admin tags an item as leaving-soon from the nominations panel |
| `untagged`       | Admin removes the leaving-soon tag from an item               |
| `keep_requested` | A user submits a keep request on a leaving-soon item          |
| `nominated`      | A user suggests an item should be tagged leaving-soon         |

**Test send** — the Settings panel has a "Send test" button that fires a sample `tagged` event using the current UI values without requiring a save first.

Webhook failures are fire-and-forget — they are logged internally but never block the admin action that triggered them.

---

## Data & Storage

- SQLite database in WAL mode at a configurable path (default `/data/tideline.db`)
- Mount `/data` as a persistent volume; database is the only persistent state
- **Image proxy** — images are fetched from Jellyfin on-demand and served through `/api/image/...`; an in-process LRU cache limits memory use to a configurable MB budget (default 100 MB)
- **Dual Jellyfin URL** — separate internal URL for server-to-server API calls (e.g. cluster-local address) and external URL for user-facing links

---

## Deployment

- **Docker / Docker Compose** — production and development compose files; dev bind-mounts source and runs `astro dev` inside a `node:26-alpine` container
- **Kubernetes Helm chart** — single-replica deployment, PVC for `/data`, optional Ingress, Jellyfin config via values or `existingSecret`
- **Forgejo Actions CI** — Kaniko-based image build on push to `main` (tagged `latest`) and on version tags (`v*`), pushed to `codeberg.org/s3than/tideline`
- **Environment variable config** — all setup-wizard values can be pre-supplied via env vars; rate-limit env vars override the admin panel settings
