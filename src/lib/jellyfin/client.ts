import type { JellyfinItem, Library } from './types';
import { resolveBlocked } from '../network';
import { getSetting } from '../db/settings';

export interface ItemsResponse {
  Items: JellyfinItem[];
  TotalRecordCount: number;
}

export const ITEM_FIELDS =
  'Overview,ImageTags,BackdropImageTags,Tags,SeriesId,SeriesName,SeasonId,SeasonName,CommunityRating,ProductionYear,RunTimeTicks,IndexNumber';

const SYNC_FIELDS =
  'Overview,ImageTags,BackdropImageTags,Tags,ProductionYear,DateCreated,DateLastSaved,SortName,' +
  'CommunityRating,CriticRating,OfficialRating,Taglines,PremiereDate,Genres,ProviderIds';

function resolveExternalUrl(): string {
  return (
    import.meta.env.JELLYFIN_URL ||
    process.env.JELLYFIN_URL ||
    getSetting('jellyfin_url', '')
  ).replace(/\/$/, '');
}

function resolveInternalUrl(): string {
  const internal = (
    import.meta.env.JELLYFIN_INTERNAL_URL ||
    process.env.JELLYFIN_INTERNAL_URL ||
    getSetting('jellyfin_internal_url', '')
  ).replace(/\/$/, '');
  return internal || resolveExternalUrl();
}

export function jellyfinBase(): string {
  const url = resolveInternalUrl();
  if (!url) throw new Error('Jellyfin URL not configured');
  return url;
}

export function jellyfinExternalBase(): string {
  const url = resolveExternalUrl();
  if (!url) throw new Error('Jellyfin URL not configured');
  return url;
}

export function jellyfinApiKey(): string {
  const key =
    import.meta.env.JELLYFIN_API_KEY ||
    process.env.JELLYFIN_API_KEY ||
    getSetting('jellyfin_api_key', '');
  if (!key) throw new Error('Jellyfin API key not configured');
  return key;
}

export function isJellyfinConfigured(): boolean {
  return !!(
    resolveExternalUrl() &&
    (import.meta.env.JELLYFIN_API_KEY ||
      process.env.JELLYFIN_API_KEY ||
      getSetting('jellyfin_api_key', ''))
  );
}

export interface JellyfinVerifyOk {
  ok: true;
  serverName?: string;
  version?: string;
}

export type JellyfinVerifyResult = JellyfinVerifyOk | { ok: false; error: string };

export async function verifyJellyfinServer(
  base: string,
  apiKey: string,
): Promise<JellyfinVerifyResult> {
  let hostname: string;
  try {
    hostname = new URL(base).hostname;
  } catch {
    return { ok: false, error: 'Invalid URL' };
  }

  try {
    const blocked = await resolveBlocked(hostname);
    if (blocked) {
      return {
        ok: false,
        error: `Requests to ${blocked} are not permitted — use environment variables to configure local Jellyfin instances`,
      };
    }
  } catch {
    // DNS failure: let the fetch attempt handle it
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const resp = await fetch(`${base}/System/Info`, {
      headers: { Authorization: `MediaBrowser Token="${apiKey}"` },
      signal: controller.signal,
    });
    if (!resp.ok) {
      return { ok: false, error: `Jellyfin server returned ${resp.status}` };
    }
    const data = (await resp.json()) as {
      Id?: string;
      ServerName?: string;
      Version?: string;
      ProductName?: string;
    };
    if (data.ProductName !== 'Jellyfin Server') {
      return { ok: false, error: 'URL does not appear to be a Jellyfin server' };
    }
    return { ok: true, serverName: data.ServerName, version: data.Version };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

function makeHeaders(): HeadersInit {
  return {
    Authorization: `MediaBrowser Token="${jellyfinApiKey()}"`,
    'Content-Type': 'application/json',
  };
}

const FETCH_TIMEOUT_MS = 10_000;

export class JellyfinSessionExpiredError extends Error {
  constructor() {
    super('Jellyfin session expired');
    this.name = 'JellyfinSessionExpiredError';
  }
}

export async function fetchJson<T>(path: string, userToken?: string): Promise<T> {
  const url = `${jellyfinBase()}${path}`;
  const headers = userToken
    ? { Authorization: `MediaBrowser Token="${userToken}"`, 'Content-Type': 'application/json' }
    : makeHeaders();
  console.log(
    `[fetchJson] using ${userToken ? `user token ...${userToken.slice(-6)}` : 'global key'}`,
  );
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let resp: Response;
  try {
    resp = await fetch(url, { headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
  const ms = Date.now() - start;
  console.log(`[jellyfin] ${resp.status} ${path} (${ms}ms)`);
  if (!resp.ok) {
    if (resp.status === 401 && userToken) throw new JellyfinSessionExpiredError();
    throw new Error(`Jellyfin API ${resp.status}: ${url}`);
  }
  return resp.json() as Promise<T>;
}

let cachedServerId: string | null = null;

export async function getServerId(): Promise<string | null> {
  if (cachedServerId) return cachedServerId;
  try {
    const data = await fetchJson<{ Id: string }>('/System/Info');
    cachedServerId = data.Id;
    return cachedServerId;
  } catch {
    return null;
  }
}

const LIBRARY_CACHE_TTL_MS = 5 * 60 * 1000;
let libraryCache: Promise<Library[]> | null = null;
let libraryCachedAt = 0;

export function clearLibraryCache(): void {
  libraryCache = null;
  libraryCachedAt = 0;
}

export function getJellyfinLibraries(): Promise<Library[]> {
  if (!libraryCache || Date.now() - libraryCachedAt > LIBRARY_CACHE_TTL_MS) {
    libraryCachedAt = Date.now();
    libraryCache = fetchJson<Library[]>('/Library/VirtualFolders').catch((err) => {
      libraryCache = null;
      throw err;
    });
  }
  return libraryCache;
}

export async function getLibraryId(name: string): Promise<string | null> {
  const libs = await getJellyfinLibraries();
  return libs.find((l) => l.Name.toLowerCase() === name.toLowerCase())?.ItemId ?? null;
}

export async function searchItems(
  libraryId: string,
  query: string,
  itemTypes: string,
  limit = 6,
  userToken?: string,
): Promise<JellyfinItem[]> {
  const data = await fetchJson<ItemsResponse>(
    `/Items?ParentId=${encodeURIComponent(libraryId)}&Recursive=true` +
      `&SearchTerm=${encodeURIComponent(query)}` +
      `&IncludeItemTypes=${itemTypes}` +
      `&Fields=ImageTags,BackdropImageTags,ProductionYear,Overview,CommunityRating` +
      `&Limit=${limit}` +
      `&SortBy=SortName&SortOrder=Ascending`,
    userToken,
  );

  const items = data.Items;

  // Jellyfin's search endpoint often omits Overview for Series even when
  // requested. Batch-fetch the full records for any items missing it.
  const missing = items.filter((i) => !i.Overview?.trim());
  if (missing.length) {
    const ids = missing.map((i) => i.Id).join(',');
    const full = await fetchJson<ItemsResponse>(`/Items?Ids=${ids}&Fields=Overview`, userToken);
    const overviewMap = new Map(full.Items.map((i) => [i.Id, i.Overview]));
    for (const item of items) {
      if (!item.Overview?.trim()) {
        item.Overview = overviewMap.get(item.Id);
      }
    }
  }

  return items;
}

function jellyfinItemType(libType: 'Movie' | 'Series' | 'Collection'): string {
  return libType === 'Collection' ? 'BoxSet' : libType;
}

export async function getLibraryItems(
  jellyfinLibId: string,
  itemType: 'Movie' | 'Series' | 'Collection',
  startIndex: number,
  limit: number,
  userToken?: string,
): Promise<{ items: JellyfinItem[]; total: number }> {
  const data = await fetchJson<ItemsResponse>(
    `/Items?ParentId=${encodeURIComponent(jellyfinLibId)}&Recursive=true` +
      `&IncludeItemTypes=${jellyfinItemType(itemType)}` +
      `&Fields=ImageTags,ProductionYear` +
      `&SortBy=SortName&SortOrder=Ascending` +
      `&StartIndex=${startIndex}&Limit=${limit}`,
    userToken,
  );
  const seen = new Set<string>();
  const items = data.Items.filter((i) => {
    if (seen.has(i.Id)) return false;
    seen.add(i.Id);
    return true;
  });
  return { items, total: data.TotalRecordCount };
}

export async function fetchAllLibraryItems(
  jellyfinId: string,
  itemType: 'Movie' | 'Series' | 'Collection',
): Promise<JellyfinItem[]> {
  const BATCH = 500;
  const all: JellyfinItem[] = [];
  const seen = new Set<string>();
  let start = 0;

  for (;;) {
    const data = await fetchJson<ItemsResponse>(
      `/Items?ParentId=${encodeURIComponent(jellyfinId)}&Recursive=true` +
        `&IncludeItemTypes=${jellyfinItemType(itemType)}` +
        `&Fields=${SYNC_FIELDS}` +
        `&SortBy=SortName&SortOrder=Ascending` +
        `&StartIndex=${start}&Limit=${BATCH}`,
    );
    for (const item of data.Items) {
      if (!seen.has(item.Id)) {
        seen.add(item.Id);
        all.push(item);
      }
    }
    if (data.Items.length === 0 || all.length >= data.TotalRecordCount) break;
    start += BATCH;
  }

  return all;
}

export async function getSeasonEpisodes(
  seasonId: string,
  userToken?: string,
): Promise<JellyfinItem[]> {
  try {
    const data = await fetchJson<ItemsResponse>(
      `/Items?ParentId=${encodeURIComponent(seasonId)}&IncludeItemTypes=Episode` +
        `&Fields=ImageTags,IndexNumber,Overview,RunTimeTicks` +
        `&SortBy=IndexNumber&SortOrder=Ascending`,
      userToken,
    );
    return data.Items ?? [];
  } catch (e) {
    if (e instanceof JellyfinSessionExpiredError) throw e;
    return [];
  }
}

export async function getSeriesSeasons(
  seriesId: string,
  userToken?: string,
): Promise<JellyfinItem[]> {
  try {
    const data = await fetchJson<ItemsResponse>(
      `/Shows/${seriesId}/Seasons?Fields=ImageTags,ProductionYear,EpisodeCount,ChildCount,IndexNumber,Overview`,
      userToken,
    );
    return data.Items ?? [];
  } catch (e) {
    if (e instanceof JellyfinSessionExpiredError) throw e;
    return [];
  }
}

export async function getCollectionItems(
  collectionId: string,
  userToken?: string,
): Promise<JellyfinItem[]> {
  try {
    const data = await fetchJson<ItemsResponse>(
      `/Items?ParentId=${encodeURIComponent(collectionId)}&Recursive=true` +
        `&IncludeItemTypes=Movie,Series` +
        `&Fields=ImageTags,ProductionYear,CommunityRating,Overview` +
        `&SortBy=SortName&SortOrder=Ascending`,
      userToken,
    );
    return data.Items ?? [];
  } catch (e) {
    if (e instanceof JellyfinSessionExpiredError) throw e;
    return [];
  }
}

const DETAIL_FIELDS =
  'Overview,ImageTags,BackdropImageTags,Tags,ProductionYear,OfficialRating,' +
  'CommunityRating,CriticRating,RunTimeTicks,Taglines,ProviderIds,PremiereDate,' +
  'Genres,People,Studios,SortName,Status,EpisodeCount,' +
  'ParentBackdropItemId,ParentBackdropImageTags,ParentLogoItemId,ParentLogoImageTag';

async function writeItemTags(item: JellyfinItem, tags: string[]): Promise<void> {
  const url = `${jellyfinBase()}/Items/${item.Id}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: makeHeaders(),
      body: JSON.stringify({ ...item, Tags: tags }),
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`Jellyfin update failed: ${resp.status}`);
  } finally {
    clearTimeout(timer);
  }
}

export async function addItemTags(itemId: string, tags: string[]): Promise<void> {
  const data = await fetchJson<ItemsResponse>(`/Items?Ids=${itemId}&Fields=${DETAIL_FIELDS}`);
  const item = data.Items[0];
  if (!item) throw new Error(`Item ${itemId} not found in Jellyfin`);

  // Replace any existing leaving-soon / lv-N tags, then append the new ones
  const incomingHasLvN = tags.some((t) => /^lv-\d+$/.test(t));
  const filtered = (item.Tags ?? []).filter(
    (t) => !tags.includes(t) && !(incomingHasLvN && /^lv-\d+$/.test(t)),
  );
  await writeItemTags(item, [...filtered, ...tags]);
}

export async function removeItemLeavingSoonTags(itemId: string): Promise<void> {
  const data = await fetchJson<ItemsResponse>(`/Items?Ids=${itemId}&Fields=${DETAIL_FIELDS}`);
  const item = data.Items[0];
  if (!item) throw new Error(`Item ${itemId} not found in Jellyfin`);

  await writeItemTags(
    item,
    (item.Tags ?? []).filter((t) => t !== 'leaving-soon' && !/^lv-\d+$/.test(t)),
  );
}

export async function getItemDetail(
  jellyfinId: string,
  userToken?: string,
): Promise<JellyfinItem | null> {
  try {
    const data = await fetchJson<ItemsResponse>(
      `/Items?Ids=${jellyfinId}&Fields=${DETAIL_FIELDS}`,
      userToken,
    );
    return data.Items[0] ?? null;
  } catch (e) {
    if (e instanceof JellyfinSessionExpiredError) throw e;
    return null;
  }
}

export interface ItemStub {
  Id: string;
  DateLastSaved?: string;
}

export async function fetchLibraryItemStubs(
  jellyfinId: string,
  itemType: 'Movie' | 'Series' | 'Collection',
): Promise<ItemStub[]> {
  const BATCH = 500;
  const all: ItemStub[] = [];
  const seen = new Set<string>();
  let start = 0;

  for (;;) {
    const data = await fetchJson<{ Items: ItemStub[]; TotalRecordCount: number }>(
      `/Items?ParentId=${encodeURIComponent(jellyfinId)}&Recursive=true` +
        `&IncludeItemTypes=${jellyfinItemType(itemType)}` +
        `&Fields=DateLastSaved` +
        `&SortBy=Id&SortOrder=Ascending` +
        `&StartIndex=${start}&Limit=${BATCH}`,
    );
    for (const item of data.Items) {
      if (!seen.has(item.Id)) {
        seen.add(item.Id);
        all.push(item);
      }
    }
    if (data.Items.length === 0 || all.length >= data.TotalRecordCount) break;
    start += BATCH;
  }

  return all;
}

export async function fetchItemsByIds(ids: string[]): Promise<JellyfinItem[]> {
  if (ids.length === 0) return [];
  const CHUNK = 100;
  const all: JellyfinItem[] = [];

  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const data = await fetchJson<ItemsResponse>(
      `/Items?Ids=${chunk.map(encodeURIComponent).join(',')}&Fields=${SYNC_FIELDS}`,
    );
    all.push(...data.Items);
  }

  return all;
}

export async function getLeavingSoonItems(
  libraryId: string,
  itemTypes: string,
): Promise<JellyfinItem[]> {
  const data = await fetchJson<ItemsResponse>(
    `/Items?ParentId=${libraryId}&Recursive=true&Tags=leaving-soon` +
      `&IncludeItemTypes=${itemTypes}&Fields=${ITEM_FIELDS}` +
      `&SortBy=SortName&SortOrder=Ascending`,
  );
  return data.Items;
}

export async function refreshJellyfinLibrary(): Promise<void> {
  const url = `${jellyfinBase()}/Library/Refresh`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    await fetch(url, { method: 'POST', headers: makeHeaders(), signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function deleteJellyfinItem(jellyfinId: string): Promise<void> {
  const url = `${jellyfinBase()}/Items/${jellyfinId}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      method: 'DELETE',
      headers: makeHeaders(),
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`Jellyfin DELETE /Items/${jellyfinId} returned ${resp.status}`);
  } finally {
    clearTimeout(timer);
  }
}
