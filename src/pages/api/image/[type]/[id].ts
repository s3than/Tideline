import type { APIRoute } from 'astro';
import { serveProxiedImage } from '../../../../lib/imageCache';
import { jellyfinBase, jellyfinApiKey } from '../../../../lib/jellyfin';
import { ITEM_ID_RE, json } from '../../../../lib/response';

const ALLOWED_TYPES = new Set(['Primary', 'Backdrop', 'Thumb', 'Logo', 'Banner']);

export const GET: APIRoute = async ({ params, url, locals }) => {
  if (!locals.user) return json({ error: 'Unauthorized' }, 401);

  const type = params.type;
  const id = params.id;

  if (!type || !id || !ALLOWED_TYPES.has(type) || !ITEM_ID_RE.test(id)) {
    return json({ error: 'Bad request' }, 400);
  }

  const tag = url.searchParams.get('tag') ?? '';
  const width = url.searchParams.get('w') ?? '400';
  if (!/^\d{2,4}$/.test(width)) {
    return json({ error: 'Bad request' }, 400);
  }

  const cacheKey = `${type}:${id}:${width}:${tag}`;
  const upstream =
    `${jellyfinBase()}/Items/${id}/Images/${type}` +
    `?tag=${encodeURIComponent(tag)}&quality=85&maxWidth=${width}`;

  return serveProxiedImage(
    cacheKey,
    upstream,
    locals.jellyfinToken || jellyfinApiKey(),
    `${type}/${id} w=${width}`,
  );
};
