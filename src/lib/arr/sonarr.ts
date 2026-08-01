import { getSetting } from '../db/settings';

export function resolveSonarrExternalUrl(): string {
  return (
    import.meta.env.SONARR_URL ||
    process.env.SONARR_URL ||
    getSetting('sonarr_url', '')
  ).replace(/\/$/, '');
}

function resolveSonarrInternalUrl(): string {
  const internal = (
    import.meta.env.SONARR_INTERNAL_URL ||
    process.env.SONARR_INTERNAL_URL ||
    getSetting('sonarr_internal_url', '')
  ).replace(/\/$/, '');
  return internal || resolveSonarrExternalUrl();
}

function resolveSonarrApiKey(): string {
  return (
    import.meta.env.SONARR_API_KEY || process.env.SONARR_API_KEY || getSetting('sonarr_api_key', '')
  );
}

export function isSonarrConfigured(): boolean {
  return !!(resolveSonarrExternalUrl() && resolveSonarrApiKey());
}

function sonarrHeaders(apiKey?: string): HeadersInit {
  return { 'X-Api-Key': apiKey ?? resolveSonarrApiKey(), 'Content-Type': 'application/json' };
}

async function sonarrFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const base = resolveSonarrInternalUrl();
  if (!base) throw new Error('Sonarr URL not configured');
  if (!resolveSonarrApiKey()) throw new Error('Sonarr API key not configured');

  const resp = await fetch(`${base}${path}`, {
    ...options,
    headers: { ...sonarrHeaders(), ...((options?.headers as Record<string, string>) ?? {}) },
  });
  if (!resp.ok) throw new Error(`Sonarr ${resp.status}: ${path}`);
  if (resp.status === 204 || resp.headers.get('content-length') === '0') return undefined as T;
  return resp.json() as Promise<T>;
}

export interface SonarrSeason {
  seasonNumber: number;
  monitored: boolean;
}

export interface SonarrSeries {
  id: number;
  tvdbId: number;
  title: string;
  titleSlug: string;
  seasons: SonarrSeason[];
}

interface SonarrEpisodeFile {
  id: number;
  seriesId: number;
  seasonNumber: number;
}

interface SonarrStatus {
  appName?: string;
}

export async function verifySonarr(
  base: string,
  apiKey: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const resp = await fetch(`${base.replace(/\/$/, '')}/api/v3/system/status`, {
      headers: sonarrHeaders(apiKey),
    });
    if (!resp.ok) return { ok: false, error: `Sonarr returned ${resp.status}` };
    const data = (await resp.json()) as SonarrStatus;
    if (data.appName !== 'Sonarr')
      return { ok: false, error: 'URL does not appear to be a Sonarr instance' };
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function findSonarrSeriesByTvdbId(tvdbId: string): Promise<SonarrSeries | null> {
  const series = await sonarrFetch<SonarrSeries[]>(
    `/api/v3/series?tvdbId=${encodeURIComponent(tvdbId)}`,
  );
  return series[0] ?? null;
}

export async function getSonarrSeries(sonarrId: number): Promise<SonarrSeries> {
  return sonarrFetch<SonarrSeries>(`/api/v3/series/${sonarrId}`);
}

export async function deleteSonarrSeries(sonarrId: number): Promise<void> {
  await sonarrFetch<void>(`/api/v3/series/${sonarrId}?deleteFiles=true`, { method: 'DELETE' });
}

export async function getSeasonEpisodeFiles(
  sonarrId: number,
  seasonNumber: number,
): Promise<SonarrEpisodeFile[]> {
  const files = await sonarrFetch<SonarrEpisodeFile[]>(
    `/api/v3/episodefile?seriesId=${sonarrId}`,
  );
  return files.filter((f) => f.seasonNumber === seasonNumber);
}

export async function deleteEpisodeFilesBulk(fileIds: number[]): Promise<void> {
  if (fileIds.length === 0) return;
  await sonarrFetch<void>('/api/v3/episodefile/bulk', {
    method: 'DELETE',
    body: JSON.stringify({ episodeFileIds: fileIds }),
  });
}

export async function unmonitorSeason(sonarrId: number, seasonNumber: number): Promise<void> {
  const series = await getSonarrSeries(sonarrId);
  const updated = {
    ...series,
    seasons: series.seasons.map((s) =>
      s.seasonNumber === seasonNumber ? { ...s, monitored: false } : s,
    ),
  };
  await sonarrFetch<SonarrSeries>(`/api/v3/series/${sonarrId}`, {
    method: 'PUT',
    body: JSON.stringify(updated),
  });
}
