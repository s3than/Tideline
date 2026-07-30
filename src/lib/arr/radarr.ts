import { getSetting } from '../db/settings';

export function resolveRadarrExternalUrl(): string {
  return (
    import.meta.env.RADARR_URL ||
    process.env.RADARR_URL ||
    getSetting('radarr_url', '')
  ).replace(/\/$/, '');
}

function resolveRadarrInternalUrl(): string {
  const internal = (
    import.meta.env.RADARR_INTERNAL_URL ||
    process.env.RADARR_INTERNAL_URL ||
    getSetting('radarr_internal_url', '')
  ).replace(/\/$/, '');
  return internal || resolveRadarrExternalUrl();
}

function resolveRadarrApiKey(): string {
  return (
    import.meta.env.RADARR_API_KEY || process.env.RADARR_API_KEY || getSetting('radarr_api_key', '')
  );
}

export function isRadarrConfigured(): boolean {
  return !!(resolveRadarrExternalUrl() && resolveRadarrApiKey());
}

function radarrHeaders(apiKey?: string): HeadersInit {
  return { 'X-Api-Key': apiKey ?? resolveRadarrApiKey(), 'Content-Type': 'application/json' };
}

async function radarrFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const base = resolveRadarrInternalUrl();
  if (!base) throw new Error('Radarr URL not configured');
  if (!resolveRadarrApiKey()) throw new Error('Radarr API key not configured');

  const resp = await fetch(`${base}${path}`, {
    ...options,
    headers: { ...radarrHeaders(), ...((options?.headers as Record<string, string>) ?? {}) },
  });
  if (!resp.ok) throw new Error(`Radarr ${resp.status}: ${path}`);
  if (resp.status === 204 || resp.headers.get('content-length') === '0') return undefined as T;
  return resp.json() as Promise<T>;
}

export interface RadarrMovie {
  id: number;
  tmdbId: number;
  title: string;
  titleSlug: string;
}

interface RadarrStatus {
  appName?: string;
}

export async function verifyRadarr(
  base: string,
  apiKey: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const resp = await fetch(`${base.replace(/\/$/, '')}/api/v3/system/status`, {
      headers: radarrHeaders(apiKey),
    });
    if (!resp.ok) return { ok: false, error: `Radarr returned ${resp.status}` };
    const data = (await resp.json()) as RadarrStatus;
    if (data.appName !== 'Radarr')
      return { ok: false, error: 'URL does not appear to be a Radarr instance' };
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function findRadarrMovieByTmdbId(tmdbId: string): Promise<RadarrMovie | null> {
  const movies = await radarrFetch<RadarrMovie[]>(
    `/api/v3/movie?tmdbId=${encodeURIComponent(tmdbId)}`,
  );
  return movies[0] ?? null;
}

export async function deleteRadarrMovie(radarrId: number): Promise<void> {
  await radarrFetch<void>(`/api/v3/movie/${radarrId}?deleteFiles=true&addImportExclusion=false`, {
    method: 'DELETE',
  });
}
