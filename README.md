# Tideline

A self-hosted media hub for Jellyfin. Astro (SSR) + Svelte 5 + Tailwind v4 on the frontend, SQLite for storage.

- **Discover** — Picks of the Month (one stable pick per library per calendar month) and a Leaving Soon shelf for items tagged `leaving-soon` in Jellyfin
- **Library browse** — paginated, sortable grid per library
- **Admin panel** — manage which Jellyfin libraries are tracked (Movies, Series, Collections), trigger syncs, tune settings
- **Auth** — login is your Jellyfin account; sessions are a cookie tied to a synced user row

---

## Setup

### Requirements

Node >= 26 (see `package.json` `engines`).

### Environment variables

All variables are optional if you complete the first-run setup wizard instead. Copy `.env.example` to `.env` if you want to pre-configure via environment:

| Variable                     | Required | Default             | Description                                                                                                       |
| ---------------------------- | -------- | ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `JELLYFIN_URL`               | No*      | —                   | External Jellyfin URL — the address users open in their browser                                                   |
| `JELLYFIN_INTERNAL_URL`      | No       | —                   | Internal Jellyfin URL for server-to-server API calls (e.g. a cluster-local address); falls back to `JELLYFIN_URL` |
| `JELLYFIN_API_KEY`           | No*      | —                   | API key from Jellyfin → Admin Dashboard → API Keys                                                                |
| `DB_FILE`                    | No       | `/data/tideline.db` | Path to the SQLite database file                                                                                  |
| `IMAGE_CACHE_MAX_MB`         | No       | `100`               | In-process image cache budget in MB — see [`docs/image-cache.md`](docs/image-cache.md)                            |
| `RATE_LIMIT_MAX_ATTEMPTS`    | No       | `5`                 | Failed login attempts before lockout (env takes priority over Admin panel setting)                                |
| `RATE_LIMIT_WINDOW_MINUTES`  | No       | `15`                | Rolling window in minutes for counting failed attempts                                                            |
| `RATE_LIMIT_LOCKOUT_MINUTES` | No       | `15`                | How long a locked-out IP is blocked                                                                               |

\* Required only if skipping the setup wizard. If neither env var nor DB setting is present, the app redirects all requests to `/setup`.

> **Local or loopback Jellyfin addresses** (e.g. `http://localhost:8096`, `http://127.0.0.1:8096`): the setup wizard blocks these to prevent SSRF. Use `JELLYFIN_URL` / `JELLYFIN_INTERNAL_URL` env vars instead — env-configured instances skip the wizard entirely.

There's no env var for which Jellyfin libraries to track — the `libraries` table starts empty on a fresh database, and which libraries are tracked is entirely controlled via the **Admin** panel (see First run, below).

### Running with Docker Compose

```bash
docker compose up --build
```

`/data` must be a persistent volume — it holds the SQLite database (and the image cache budget is in-memory, not on disk). See `docker-compose.yml`.

### Local development

```bash
docker compose -f docker-compose.dev.yml up
```

This runs `npm install` + `astro dev` inside a `node:26-alpine` container with the source bind-mounted and a separate dev volume for `node_modules` and `/data`. New npm dependencies require rebuilding the container, not just a restart.

Alternatively, run directly on the host with Node >= 26:

```bash
npm install
npm run dev
```

### First run

1. Start the app. If Jellyfin is not configured (no env vars set), all requests redirect to `/setup`. A one-time **setup token** is printed to the server log — you will need it in the next step.
2. Enter your Jellyfin URL, optional internal URL, API key, and the setup token from the log. Use **Test Connection** to verify before saving. On save the app redirects to `/login`.
   > If your Jellyfin is at a local or loopback address (`localhost`, `127.x.x.x`), the wizard will not accept it. Set `JELLYFIN_URL` (and optionally `JELLYFIN_INTERNAL_URL`) as env vars instead — the wizard is skipped automatically when those are present.
3. Log in with your Jellyfin credentials.
4. On a fresh database with no libraries configured, a Jellyfin administrator is redirected straight to `/admin/setup` — pick which Jellyfin libraries to connect there. A non-admin landing on an unconfigured instance just sees an empty Discover page until an admin completes this step.
5. Once at least one library is connected, use the **Admin** panel (Libraries section) to add more, fine-tune labels/order/visibility, or click **Sync All Libraries** to populate the database.
6. Until a library is synced, its Discover/Leaving-Soon data falls back to live Jellyfin calls.

If `JELLYFIN_URL` and `JELLYFIN_API_KEY` are already set as environment variables, steps 1–2 are skipped and the app goes straight to `/login`.

### CI / Deployment

Forgejo Actions builds and pushes the image via Kaniko (`gcr.io/kaniko-project/executor`) to `codeberg.org/s3than/tideline` on every push to `main` (tag `latest`) and on version tags (`v*`). See `.forgejo/workflows/build.yml`.

### Kubernetes (Helm)

A chart lives in [`charts/tideline`](charts/tideline). It deploys a single replica (SQLite lives on the data volume) with a PVC for `/data`, an optional Ingress, and optional Jellyfin configuration — leave the `jellyfin.*` values empty to use the first-run setup wizard instead, which persists to the database.

```bash
helm install tideline ./charts/tideline \
  --set ingress.enabled=true \
  --set ingress.host=tideline.example.com
```

The API key can be supplied inline (`jellyfin.apiKey`, stored in a chart-managed Secret) or via `jellyfin.existingSecret` pointing at a Secret with a `jellyfin-api-key` entry.

---

## Leaving Soon tags

Tag any Jellyfin item with `leaving-soon` to have it appear in the dashboard.

Add an optional `lv-<days>` tag to set how many days remain (e.g. `lv-14`). Items are sorted by this value ascending. If no `lv-` tag is present, a fallback day count is used (configurable in Admin → Settings, `leaving_soon_days_fallback`).

For TV libraries, leaving-soon tags can be applied at the season level — only tagged seasons are synced, grouped per show with a per-season countdown.

---

## Picks of the Month logic

Each library gets one pick per calendar month, stored in SQLite (`picks` table) so every page load in the same month returns the same item without recomputation.

### Selection

For a synced library, the candidate pool is every non-Season item in that library's `media` table. A linear congruential generator (LCG) seeded by the current year, month, and library slug picks a stable index into that pool (ordered by `jellyfin_id`).

If a library hasn't been synced yet, the same LCG approach runs against Jellyfin directly (sorted alphabetically by title) as a fallback.

### Repeat avoidance

To avoid repeating a title across consecutive months, the last 6 picks per library are recorded. When a candidate matches one of the 5 most recent prior picks, the seed is incremented and the next candidate is tried — up to `min(library size, 20)` attempts before giving up.

### Storage

Picks live in the `picks` table (`library_slug`, `month`, `item_id`, `recorded_at`), trimmed to the most recent 6 entries per library. On each page load:

1. If a row exists for the current month, the item is read from `media` and returned — no seed computation needed.
2. Otherwise a candidate is selected (excluding the last 5 prior picks), written to `picks`, and returned.

---

## Data

SQLite database at `DB_FILE` (default `/data/tideline.db`), WAL mode. Mount `/data` as a persistent volume.

Key tables: `libraries`, `media`, `picks`, `leaving_soon`, `settings`, `users`, `sessions`, `login_attempts`, `user_library_sort`. Library sync (`POST /api/admin/sync`, or automatically when a library is added) pulls Movies/Series (and tagged Seasons) from Jellyfin into the `media` table, which then serves Discover, library browse, and picks without further Jellyfin calls. Collection libraries marked as proxy are never synced — they always fetch live from Jellyfin.

---

## Further reading

- [`docs/external-dependencies.md`](docs/external-dependencies.md) — runtime dependencies outside the container (Google Fonts, Jellyfin)
- [`docs/image-cache.md`](docs/image-cache.md) — in-process image cache design and Kubernetes memory considerations
