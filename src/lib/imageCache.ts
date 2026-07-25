interface Entry {
  data: Buffer;
  contentType: string;
  size: number;
}

const MAX_BYTES = Math.max(1, parseInt(process.env.IMAGE_CACHE_MAX_MB ?? '100', 10)) * 1024 * 1024;

class LRUImageCache {
  private readonly map = new Map<string, Entry>();
  private totalBytes = 0;

  get(key: string): Entry | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    // Touch: re-insert at the tail so it's freshest in iteration order.
    this.map.delete(key);
    this.map.set(key, entry);
    return entry;
  }

  set(key: string, entry: Entry): void {
    const existing = this.map.get(key);
    if (existing) {
      this.totalBytes -= existing.size;
      this.map.delete(key);
    }

    // Single entries larger than the budget would force-evict everything else
    // on every insert. Skip caching them.
    if (entry.size > MAX_BYTES) return;

    this.map.set(key, entry);
    this.totalBytes += entry.size;

    while (this.totalBytes > MAX_BYTES) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      const evicted = this.map.get(oldest)!;
      this.totalBytes -= evicted.size;
      this.map.delete(oldest);
    }
  }

  get bytes(): number {
    return this.totalBytes;
  }

  get count(): number {
    return this.map.size;
  }
}

export const imageCache = new LRUImageCache();

export async function serveProxiedImage(
  cacheKey: string,
  upstreamUrl: string,
  authToken: string,
  logLabel?: string,
): Promise<Response> {
  const hit = imageCache.get(cacheKey);
  if (hit) {
    if (logLabel) {
      console.log(
        `[image] HIT  ${logLabel} (${imageCache.count} entries, ${(imageCache.bytes / 1024 / 1024).toFixed(1)}/${(MAX_BYTES / 1024 / 1024).toFixed(0)}MB)`,
      );
    }
    return new Response(hit.data as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': hit.contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
        'X-Cache': 'HIT',
      },
    });
  }

  const start = Date.now();
  const resp = await fetch(upstreamUrl, {
    headers: { Authorization: `MediaBrowser Token="${authToken}"` },
  });
  const ms = Date.now() - start;

  if (!resp.ok) {
    if (logLabel) {
      console.log(`[image] FAIL ${resp.status} ${logLabel} (${ms}ms)`);
    }
    return new Response(JSON.stringify({ error: 'Upstream error' }), {
      status: resp.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const contentType = resp.headers.get('content-type') ?? 'image/jpeg';
  const data = Buffer.from(await resp.arrayBuffer());
  imageCache.set(cacheKey, { data, contentType, size: data.byteLength });

  if (logLabel) {
    console.log(
      `[image] MISS ${logLabel} (${ms}ms, ${(data.byteLength / 1024).toFixed(0)}kB, cache ${imageCache.count} entries / ${(imageCache.bytes / 1024 / 1024).toFixed(1)}MB)`,
    );
  }

  return new Response(data, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400, immutable',
      'X-Cache': 'MISS',
    },
  });
}
