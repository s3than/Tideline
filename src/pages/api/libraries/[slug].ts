import type { APIRoute } from 'astro';
import { getLibraries, getMediaPage, getSetting, toLibraryDisplayItem } from '../../../lib/db';
import { getLibraryId, getLibraryItems, jellyfinItemToDisplayItem } from '../../../lib/jellyfin';
import { json } from '../../../lib/response';
import { PAGE_SIZE } from '../../../lib/constants';

export const GET: APIRoute = async ({ params, url, locals }) => {
  if (!locals.user) return json({ error: 'Unauthorized' }, 401);
  const userToken = locals.jellyfinToken;

  const library = getLibraries().find((l) => l.slug === params.slug && l.viewInMenu);
  if (!library) return json({ error: 'Not found' }, 404);

  const page = Math.max(0, parseInt(url.searchParams.get('page') ?? '0', 10));
  const startIndex = page * PAGE_SIZE;

  if (!library.isProxy && getSetting('sync_enabled', '1') !== '0') {
    const local = getMediaPage(library.slug, startIndex, PAGE_SIZE);
    if (local.total > 0) {
      return json({
        items: local.items.map(toLibraryDisplayItem),
        total: local.total,
        page,
        pageSize: PAGE_SIZE,
      });
    }
  }

  const jellyfinId = await getLibraryId(library.jellyfinName);
  if (!jellyfinId) return json({ error: 'Library not found in Jellyfin' }, 502);

  const { items, total } = await getLibraryItems(
    jellyfinId,
    library.itemType,
    startIndex,
    PAGE_SIZE,
    userToken,
  );

  return json({
    items: items.map(jellyfinItemToDisplayItem),
    total,
    page,
    pageSize: PAGE_SIZE,
  });
};
