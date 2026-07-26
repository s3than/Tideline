import {
  getLibraries,
  upsertMediaBatch,
  clearMediaByLibrary,
  pruneStaleLeavingSoon,
  pruneStaleKeepRequests,
  getMediaStubsForLibrary,
  deleteMediaByIds,
  deleteSeasonsByLibrary,
  type LibraryRow,
  type MediaInsert,
  type SyncResult,
} from './db';
import { toErrorMessage } from './response';
import {
  getLibraryId,
  fetchAllLibraryItems,
  fetchLibraryItemStubs,
  fetchItemsByIds,
  getLeavingSoonItems,
  clearLibraryCache,
} from './jellyfin';

export type { SyncResult };

function parseLeavingDays(tags: string[]): number | null {
  const tag = tags.find((t) => /^lv-\d+$/.test(t));
  return tag ? parseInt(tag.slice(3), 10) : null;
}

export async function syncLibrary(lib: LibraryRow): Promise<SyncResult> {
  try {
    const jellyfinId = await getLibraryId(lib.jellyfinName);
    if (!jellyfinId) {
      return {
        slug: lib.slug,
        label: lib.label,
        synced: 0,
        error: 'Library not found in Jellyfin',
      };
    }

    const items = await fetchAllLibraryItems(jellyfinId, lib.itemType);

    const rows: MediaInsert[] = items.map((item) => ({
      jellyfinId: item.Id,
      librarySlug: lib.slug,
      name: item.Name,
      sortName: item.SortName ?? null,
      year: item.ProductionYear ?? null,
      premiereDate: item.PremiereDate ? item.PremiereDate.slice(0, 10) : null,
      dateAdded: item.DateCreated ? item.DateCreated.slice(0, 10) : null,
      overview: item.Overview ?? null,
      tagline: item.Taglines?.[0] ?? null,
      posterTag: item.ImageTags?.Primary ?? null,
      backdropTag: item.BackdropImageTags?.[0] ?? null,
      communityRating: item.CommunityRating ?? null,
      criticRating: item.CriticRating ?? null,
      officialRating: item.OfficialRating ?? null,
      genres: item.Genres?.length ? item.Genres : null,
      providerIds:
        item.ProviderIds && Object.keys(item.ProviderIds).length ? item.ProviderIds : null,
      runtimeTicks: item.RunTimeTicks ?? null,
      seriesStatus: item.Status ?? null,
      episodeCount: item.EpisodeCount ?? null,
      itemType: lib.itemType,
      leavingSoon: item.Tags?.includes('leaving-soon') ?? false,
      leavingDays: parseLeavingDays(item.Tags ?? []),
      jellyfinLastSaved: item.DateLastSaved ?? null,
    }));

    const seasonRows: MediaInsert[] = [];
    if (lib.itemType === 'Series') {
      const leavingItems = await getLeavingSoonItems(jellyfinId, 'Series,Season');
      for (const item of leavingItems) {
        if (item.Type === 'Season' && item.SeriesId) {
          seasonRows.push({
            jellyfinId: item.Id,
            librarySlug: lib.slug,
            name: item.Name,
            sortName: item.SortName ?? null,
            year: item.ProductionYear ?? null,
            dateAdded: item.DateCreated ? item.DateCreated.slice(0, 10) : null,
            overview: item.Overview ?? null,
            posterTag: item.ImageTags?.Primary ?? null,
            itemType: 'Season',
            leavingSoon: true,
            leavingDays: parseLeavingDays(item.Tags ?? []),
            seriesId: item.SeriesId,
            indexNumber: item.IndexNumber ?? null,
            seriesName: item.SeriesName ?? null,
          });
        }
      }
    }

    clearMediaByLibrary(lib.slug);
    upsertMediaBatch([...rows, ...seasonRows]);

    return { slug: lib.slug, label: lib.label, synced: rows.length + seasonRows.length };
  } catch (err: unknown) {
    return { slug: lib.slug, label: lib.label, synced: 0, error: toErrorMessage(err) };
  }
}

export async function syncAllLibraries(): Promise<SyncResult[]> {
  clearLibraryCache();
  const libraries = getLibraries().filter((lib) => !lib.isProxy);
  const results = await Promise.all(libraries.map((lib) => syncLibrary(lib)));
  pruneStaleLeavingSoon();
  pruneStaleKeepRequests();
  return results;
}

function itemToInsert(item: import('./jellyfin').JellyfinItem, lib: LibraryRow): MediaInsert {
  return {
    jellyfinId: item.Id,
    librarySlug: lib.slug,
    name: item.Name,
    sortName: item.SortName ?? null,
    year: item.ProductionYear ?? null,
    premiereDate: item.PremiereDate ? item.PremiereDate.slice(0, 10) : null,
    dateAdded: item.DateCreated ? item.DateCreated.slice(0, 10) : null,
    overview: item.Overview ?? null,
    tagline: item.Taglines?.[0] ?? null,
    posterTag: item.ImageTags?.Primary ?? null,
    backdropTag: item.BackdropImageTags?.[0] ?? null,
    communityRating: item.CommunityRating ?? null,
    criticRating: item.CriticRating ?? null,
    officialRating: item.OfficialRating ?? null,
    genres: item.Genres?.length ? item.Genres : null,
    providerIds: item.ProviderIds && Object.keys(item.ProviderIds).length ? item.ProviderIds : null,
    runtimeTicks: item.RunTimeTicks ?? null,
    seriesStatus: item.Status ?? null,
    episodeCount: item.EpisodeCount ?? null,
    itemType: lib.itemType,
    leavingSoon: item.Tags?.includes('leaving-soon') ?? false,
    leavingDays: parseLeavingDays(item.Tags ?? []),
    jellyfinLastSaved: item.DateLastSaved ?? null,
  };
}

export async function diffSyncLibrary(lib: LibraryRow): Promise<SyncResult> {
  try {
    const jellyfinId = await getLibraryId(lib.jellyfinName);
    if (!jellyfinId) {
      return {
        slug: lib.slug,
        label: lib.label,
        synced: 0,
        error: 'Library not found in Jellyfin',
      };
    }

    // Lightweight pass — just Id + DateLastSaved
    const stubs = await fetchLibraryItemStubs(jellyfinId, lib.itemType);
    const jellyfinMap = new Map(stubs.map((s) => [s.Id, s.DateLastSaved ?? null]));

    // Current DB state for this library (non-Season rows)
    const dbMap = getMediaStubsForLibrary(lib.slug);

    // Removed: in DB but gone from Jellyfin
    const removed = [...dbMap.keys()].filter((id) => !jellyfinMap.has(id));

    // New or changed: needs full metadata fetch
    const toFetch: string[] = [];
    for (const [id, jellyfinLastSaved] of jellyfinMap) {
      if (!dbMap.has(id)) {
        toFetch.push(id);
      } else {
        const dbLastSaved = dbMap.get(id);
        if (!jellyfinLastSaved || !dbLastSaved || jellyfinLastSaved > dbLastSaved) {
          toFetch.push(id);
        }
      }
    }

    deleteMediaByIds(removed);

    let upserted = 0;
    if (toFetch.length > 0) {
      const items = await fetchItemsByIds(toFetch);
      upsertMediaBatch(items.map((item) => itemToInsert(item, lib)));
      upserted = items.length;
    }

    // Seasons: always re-fetch leaving-soon set (small, cheap)
    if (lib.itemType === 'Series') {
      deleteSeasonsByLibrary(lib.slug);
      const leavingItems = await getLeavingSoonItems(jellyfinId, 'Series,Season');
      const seasonRows: MediaInsert[] = [];
      for (const item of leavingItems) {
        if (item.Type === 'Season' && item.SeriesId) {
          seasonRows.push({
            jellyfinId: item.Id,
            librarySlug: lib.slug,
            name: item.Name,
            sortName: item.SortName ?? null,
            year: item.ProductionYear ?? null,
            dateAdded: item.DateCreated ? item.DateCreated.slice(0, 10) : null,
            overview: item.Overview ?? null,
            posterTag: item.ImageTags?.Primary ?? null,
            itemType: 'Season',
            leavingSoon: true,
            leavingDays: parseLeavingDays(item.Tags ?? []),
            seriesId: item.SeriesId,
            indexNumber: item.IndexNumber ?? null,
            seriesName: item.SeriesName ?? null,
          });
        }
      }
      upsertMediaBatch(seasonRows);
    }

    return { slug: lib.slug, label: lib.label, synced: upserted + removed.length };
  } catch (err: unknown) {
    return { slug: lib.slug, label: lib.label, synced: 0, error: toErrorMessage(err) };
  }
}

export async function diffSyncAllLibraries(): Promise<SyncResult[]> {
  clearLibraryCache();
  const libraries = getLibraries().filter((lib) => !lib.isProxy);
  const results = await Promise.all(libraries.map((lib) => diffSyncLibrary(lib)));
  pruneStaleLeavingSoon();
  pruneStaleKeepRequests();
  return results;
}
