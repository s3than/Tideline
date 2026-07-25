# External Dependencies

Runtime dependencies on external services outside the application container.

## Jellyfin Server

- **What:** The upstream Jellyfin media server
- **Where:** All API calls via `src/lib/jellyfin/client.ts`; configured via `JELLYFIN_URL` / `JELLYFIN_INTERNAL_URL` / `JELLYFIN_API_KEY` environment variables, or via the first-run setup wizard (stored in the `settings` DB table). Local/loopback addresses must be set via env vars — the setup wizard rejects them.
- **Impact if unavailable:** Library sync and search fail; the home page and library browse pages fall back to locally cached data where available (post-sync), otherwise show empty or error states
