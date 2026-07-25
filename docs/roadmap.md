# Roadmap

Planned and proposed features, roughly ordered by effort. Nothing here is committed or scheduled.

---

## High value, low effort

### Scheduled auto-sync

A configurable sync interval (e.g. every 6 hours) so the database stays fresh without an admin manually clicking "Sync All". A new `sync_interval_minutes` setting in the admin panel would trigger a server-side background timer (or a lightweight cron endpoint) that runs the existing sync logic on a schedule. New arrivals, leaving-soon changes, and metadata updates would propagate automatically.

### Recently Added shelf

`dateAdded` is already stored in the `media` table. A "New this month" (or "Recently added") section on the Discover page — alongside the existing Picks and Leaving Soon shelves — would close the typical media-hub discovery loop without any schema changes.

### Genre filtering in library browse

Genres are already stored as a JSON array per item in the database. Adding genre chip filters to the `/library/<slug>` grid would let users narrow a large library quickly. No schema changes needed; the filter can run client-side against the already-fetched page data, with the full filter set derived from the library's genre list on page load.

### RSS / Atom feed for Leaving Soon

A feed at `/feeds/leaving-soon` (or per-library variants at `/feeds/leaving-soon/<slug>`) that household members can subscribe to in a feed reader or home dashboard widget. No new persistence is required — the feed is generated from the existing `leaving_soon` data on request.

---

## Medium effort, high impact

### Notification thumbnails — internal (site URL)

Add a `site_url` setting (the externally reachable base URL of Tideline) and a toggle to include poster thumbnails in webhook notifications. When enabled, the poster URL is constructed from `site_url` + the existing image proxy endpoint, after making that endpoint publicly accessible (no auth required). Gives Discord/Slack rich embed thumbnails with zero third-party dependency, at the cost of Tideline needing to be reachable from the internet.

### Notification thumbnails — external provider (TMDB/TVDB)

During library sync, fetch the poster path from TMDB (for movies and series) or TVDB (for series) using provider IDs already stored in `providerIds`. Store the resulting CDN URL in a new `externalPosterUrl` column on the `media` table. When configured, webhook notifications use this URL instead of the internal proxy — works even if Tideline is not publicly accessible. Requires admin-configured TMDB/TVDB API keys and additional network calls at sync time.

---

### Leaving Soon history / archive

Log items that _were_ tagged leaving-soon and have since been removed (expired, untagged, or kept). A new admin panel tab would show the archive — item name, library, days they were on the shelf, and when they disappeared. Useful for the household "I missed that!" conversation and for auditing how well the leaving-soon workflow is working.

### PWA / installable

A `manifest.json` with app name, icons, and theme colour, plus a minimal service worker for offline fallback. Makes Tideline installable to the home screen on mobile and TV browsers, which suits the couch-browsing use case without requiring a native app.

---

## Stretch / larger lift

### Backdrop screensaver / ambient display

A `/ambient` route that cycles through backdrop images from across the libraries — full-screen, auto-advancing, with a subtle title overlay. Useful as a TV wallpaper, a hallway display, or a "what's in the library" ambient screen. Could support filtering by library slug via query parameter.

### Admin action audit log

Record admin actions in a new `audit_log` table: library syncs, item tag/untag operations, settings changes, session revocations. Surfaced as a read-only log in the admin panel with timestamp, actor, and action. Low priority for single-admin setups but useful for shared household accountability when multiple Jellyfin admins use the panel.

### Curated / manual picks

Allow admins to pin a specific item as a library's pick for the month instead of relying on the LCG algorithm. A "Set as this month's pick" button on the media detail page (admin only) would write directly to the `picks` table, overriding the automatic selection. Could also allow showing more than one pick per library for larger collections.
