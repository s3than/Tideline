import type { JellyfinItem } from './types';
import type { LibraryDisplayItem } from '../db/types';
import { jellyfinExternalBase } from './client';

export function posterUrl(item: JellyfinItem, width = 400): string {
  const tag = item.ImageTags.Primary;
  if (!tag) return '';
  return `/api/image/Primary/${item.Id}?tag=${encodeURIComponent(tag)}&w=${width}`;
}

export function backdropUrl(item: JellyfinItem, width = 1280): string {
  const tag = item.BackdropImageTags?.[0];
  if (!tag) return posterUrl(item, width);
  return `/api/image/Backdrop/${item.Id}?tag=${encodeURIComponent(tag)}&w=${width}`;
}

export function jellyfinWebUrl(itemId: string): string {
  return `${jellyfinExternalBase()}/web/index.html#!/details?id=${itemId}`;
}

export function itemWebUrl(item: JellyfinItem): string {
  return jellyfinWebUrl(item.Id);
}

export function jellyfinItemToDisplayItem(item: JellyfinItem): LibraryDisplayItem {
  return {
    id: item.Id,
    name: item.Name,
    year: item.ProductionYear,
    overview: item.Overview ?? null,
    posterTag: item.ImageTags?.Primary ?? null,
  };
}

export function itemTypeLabel(item: JellyfinItem): string {
  if (item.Type === 'Season') {
    const season = item.IndexNumber != null ? `Season ${item.IndexNumber}` : item.Name;
    return item.SeriesName ? `${item.SeriesName} — ${season}` : season;
  }
  return item.Name;
}
