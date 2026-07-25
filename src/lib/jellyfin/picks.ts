import type { JellyfinItem } from './types';
import type { LibraryRow, MediaRow } from '../db';
import { getPickHistory, upsertPick, getRandomPickFromMedia, getMediaById } from '../db';
import { lcgIndex, monthSeed } from '../pickSeed';
import { fetchJson, ITEM_FIELDS, type ItemsResponse } from './client';

function mediaToJellyfinItem(row: MediaRow): JellyfinItem {
  return {
    Id: row.jellyfinId,
    Name: row.name,
    Type: row.itemType as 'Movie' | 'Series',
    Tags: [],
    ProductionYear: row.year ?? undefined,
    Overview: row.overview ?? undefined,
    CommunityRating: row.communityRating ?? undefined,
    ImageTags: { Primary: row.posterTag ?? undefined },
    BackdropImageTags: row.backdropTag ? [row.backdropTag] : undefined,
  };
}

export async function getMonthPick(
  jellyfinLibId: string,
  library: LibraryRow,
): Promise<JellyfinItem | null> {
  const now = new Date();
  const month = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

  const history = getPickHistory(library.slug, 6);
  const thisMonth = history.find((e) => e.month === month);

  if (thisMonth) {
    const cached = getMediaById(thisMonth.item_id);
    if (cached) return mediaToJellyfinItem(cached);
    // item was removed from media (library deleted/resynced) — fall through to pick a new one
  }

  const mediaCandidate = getRandomPickFromMedia(library.slug, month);
  if (mediaCandidate) {
    upsertPick(library.slug, month, mediaCandidate.jellyfinId);
    return mediaToJellyfinItem(mediaCandidate);
  }

  // Fallback: library not yet synced — pick via Jellyfin LCG
  const excluded = new Set(
    history
      .filter((e) => e.month !== month)
      .slice(0, 5)
      .map((e) => e.item_id),
  );

  const countData = await fetchJson<ItemsResponse>(
    `/Items?ParentId=${jellyfinLibId}&Recursive=true&IncludeItemTypes=${library.itemType}&Limit=0`,
  );
  if (countData.TotalRecordCount === 0) return null;

  const max = countData.TotalRecordCount;
  const seed = monthSeed(month, library.slug);
  // 8 attempts covers the ≤5-item exclusion list with headroom; fetched in
  // parallel so a slow Jellyfin costs one round-trip, not attempts × timeout
  // (this path runs on every home page load while a library is unsynced).
  const maxAttempts = Math.min(max, 8);

  const indexes = Array.from({ length: maxAttempts }, (_, i) => lcgIndex(seed + i, max));
  const uniqueIndexes = [...new Set(indexes)];
  const settled = await Promise.allSettled(
    uniqueIndexes.map((index) =>
      fetchJson<ItemsResponse>(
        `/Items?ParentId=${jellyfinLibId}&Recursive=true&IncludeItemTypes=${library.itemType}` +
          `&SortBy=SortName&SortOrder=Ascending&StartIndex=${index}&Limit=1&Fields=${ITEM_FIELDS}`,
      ),
    ),
  );
  const byIndex = new Map(uniqueIndexes.map((index, i) => [index, settled[i]]));

  for (const index of indexes) {
    const result = byIndex.get(index)!;
    if (result.status === 'rejected') throw result.reason;
    const candidate = result.value.Items[0];
    if (!candidate) break;

    if (!excluded.has(candidate.Id)) {
      upsertPick(library.slug, month, candidate.Id);
      return candidate;
    }
  }

  return null;
}
