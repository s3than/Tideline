import type { APIRoute } from 'astro';
import {
  getLibraryId,
  searchItems,
  posterUrl,
  backdropUrl,
  jellyfinWebUrl,
  type JellyfinItem,
} from '../../lib/jellyfin';
import { getLibraries, getSetting, searchMedia, type MediaRow } from '../../lib/db';
import { json } from '../../lib/response';
import type { SearchHit } from '../../lib/search';

type SearchGroup = {
  slug: string;
  label: string;
  items: SearchHit[];
};

function jellyfinHit(item: JellyfinItem): SearchHit {
  return {
    id: item.Id,
    title: item.Name,
    year: item.ProductionYear ?? null,
    rating: item.CommunityRating ?? null,
    overview: item.Overview?.trim() || null,
    poster: item.ImageTags.Primary ? posterUrl(item, 80) : null,
    backdrop: item.BackdropImageTags?.length ? backdropUrl(item, 640) : null,
    url: `/media/${item.Id}`,
    watchUrl: jellyfinWebUrl(item.Id),
  };
}

function localHit(row: MediaRow): SearchHit {
  return {
    id: row.jellyfinId,
    title: row.name,
    year: row.year,
    rating: row.communityRating,
    overview: row.overview,
    poster: row.posterTag
      ? `/api/image/Primary/${row.jellyfinId}?tag=${encodeURIComponent(row.posterTag)}&w=80`
      : null,
    backdrop: row.backdropTag
      ? `/api/image/Backdrop/${row.jellyfinId}?tag=${encodeURIComponent(row.backdropTag)}&w=640`
      : null,
    url: `/media/${row.jellyfinId}`,
    watchUrl: jellyfinWebUrl(row.jellyfinId),
  };
}

export const GET: APIRoute = async ({ url, locals }) => {
  if (!locals.user) return json({ groups: [] }, 401);

  const q = url.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return json({ groups: [] }, 200);

  const libraries = getLibraries();
  const syncDisabled = getSetting('sync_enabled', '1') === '0';
  const userToken = locals.jellyfinToken;

  const groups = await Promise.all(
    libraries.map(async (lib): Promise<SearchGroup> => {
      if (!lib.isProxy && !syncDisabled) {
        const items = searchMedia(lib.slug, q, 6).map((row) => localHit(row));
        return { slug: lib.slug, label: lib.label, items };
      }
      const libraryId = await getLibraryId(lib.jellyfinName);
      const items = libraryId ? await searchItems(libraryId, q, lib.itemType, 6, userToken) : [];
      return { slug: lib.slug, label: lib.label, items: items.map(jellyfinHit) };
    }),
  );

  return json({ groups: groups.filter((g) => g.items.length > 0) }, 200);
};
