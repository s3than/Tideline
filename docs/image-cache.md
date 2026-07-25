# Image Cache

## Current implementation — in-process LRU

All images are proxied through the app rather than served directly from Jellyfin. This keeps Jellyfin credentials server-side and allows caching.

Two proxy routes:

- `/api/image/[type]/[id]` — media images (Primary, Backdrop, Thumb, Logo)
- `/api/image/user/[id]` — user avatars (fixed 128px)

On a **miss**: the route fetches from Jellyfin (via the internal URL when configured, otherwise the external URL) at `<jellyfin>/Items/<id>/Images/<type>`, stores the raw bytes in an in-process `LRUImageCache`, and returns the image with `Cache-Control: public, max-age=86400, immutable`.

On a **hit**: bytes are served directly from the in-memory `Map` — no Jellyfin round-trip.

Cache key structure:

- Media: `<type>:<id>:<width>:<tag>` e.g. `Primary:abc123:300:deadbeef`
- User avatars: `UserPrimary:<id>:<tag>`

The `tag` parameter is Jellyfin's image hash — it changes when artwork changes, which naturally busts cached entries.

Budget is controlled by the `IMAGE_CACHE_MAX_MB` env var (default: 100MB). When full, the oldest entry is evicted until under budget. Images larger than the entire budget are not cached.

## Kubernetes / memory limit considerations

The cache holds `Buffer` objects which allocate **off-heap** memory. Node's `--max-old-space-size` does not constrain it — only the internal `IMAGE_CACHE_MAX_MB` limit does. The kernel (and Kubernetes cgroup) counts heap + off-heap together, so the pod's `limits.memory` is the hard ceiling.

If the pod exceeds its memory limit the kernel OOM-kills the process. Kubernetes restarts the pod automatically but the cache is lost, causing a burst of Jellyfin fetches on cold start.

**Rule of thumb:** set `IMAGE_CACHE_MAX_MB` well below the pod limit to leave headroom for the Node/V8 baseline (~150MB at steady state) plus per-request overhead.

Example for a 512Mi pod:

```yaml
resources:
  limits:
    memory: 512Mi
env:
  - name: IMAGE_CACHE_MAX_MB
    value: '150'
```

## Disk cache — if needed in future

The in-process cache does not survive restarts. If that becomes a problem, images could be written to `/data` (the volume already mounted for SQLite).

The main design challenge with a disk cache is garbage collection — the in-process LRU evicts automatically, but files on disk accumulate unless explicitly cleaned up.

### The orphaned-file problem

Image validity is tied to Jellyfin's `tag` parameter. When artwork changes in Jellyfin the tag changes, so a new request gets a miss and writes a new file — but the old file with the old tag remains on disk until something removes it.

### GC approaches

**Sync-time GC (recommended)**

During `syncLibrary()` the app already fetches every current `posterTag` for every item. After the upsert, delete any cached image files whose tag doesn't match a current value. This requires cache filenames to encode the tag (e.g. `<id>-<tag>.jpg`) so they're queryable without reading file contents.

This approach is accurate and fits the existing sync flow — no separate job needed.

**TTL-based expiry**

Write a last-accessed timestamp alongside each file (or rely on filesystem `atime`). A periodic sweep deletes files not accessed in N days. Simpler to implement but slightly wasteful — stale files linger until the TTL expires even if their tag changed.

### Recommendation

For a personal-scale deployment the in-process cache with an appropriate `IMAGE_CACHE_MAX_MB` is sufficient. Move to a disk cache only if the pod memory limit becomes a genuine constraint.
