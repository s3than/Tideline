import type { APIRoute } from 'astro';
import { serveProxiedImage } from '../../../../lib/imageCache';
import { jellyfinBase, jellyfinApiKey } from '../../../../lib/jellyfin';
import { ITEM_ID_RE } from '../../../../lib/response';

export const GET: APIRoute = async ({ params, url, locals }) => {
  if (!locals.user) return new Response('Unauthorized', { status: 401 });

  const id = params.id;
  if (!id || !ITEM_ID_RE.test(id)) {
    return new Response('Bad request', { status: 400 });
  }

  const tag = url.searchParams.get('tag') ?? '';
  const width = '128';
  const cacheKey = `UserPrimary:${id}:${tag}`;
  const upstream =
    `${jellyfinBase()}/Users/${id}/Images/Primary` +
    `?tag=${encodeURIComponent(tag)}&quality=85&maxWidth=${width}`;

  return serveProxiedImage(cacheKey, upstream, locals.jellyfinToken || jellyfinApiKey());
};
