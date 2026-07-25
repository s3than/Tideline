import {
  getLibraries,
  upsertMediaBatch,
  clearMediaByLibrary,
  pruneStaleLeavingSoon,
  pruneStaleKeepRequests,
  type LibraryRow,
  type MediaInsert,
} from './db';
import { toErrorMessage } from './response';
import {
  getLibraryId,
  fetchAllLibraryItems,
  getLeavingSoonItems,
  clearLibraryCache,
} from './jellyfin';

export interface SyncResult {
  slug: string;
  label: string;
  synced: number;
  error?: string;
}

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
