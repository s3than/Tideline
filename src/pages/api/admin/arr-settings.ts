import type { APIRoute } from 'astro';
import { setSetting } from '../../../lib/db';
import { verifyRadarr } from '../../../lib/arr/radarr';
import { verifySonarr } from '../../../lib/arr/sonarr';
import { json, requireAdmin, validHttpUrl, toErrorMessage } from '../../../lib/response';

export const PATCH: APIRoute = async ({ request, locals }) => {
  const deny = requireAdmin(locals);
  if (deny) return deny;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const radarrUrl = typeof body.radarrUrl === 'string' ? body.radarrUrl.trim() : null;
  const radarrInternalUrl =
    typeof body.radarrInternalUrl === 'string' ? body.radarrInternalUrl.trim() : null;
  const radarrApiKey = typeof body.radarrApiKey === 'string' ? body.radarrApiKey.trim() : null;
  const sonarrUrl = typeof body.sonarrUrl === 'string' ? body.sonarrUrl.trim() : null;
  const sonarrInternalUrl =
    typeof body.sonarrInternalUrl === 'string' ? body.sonarrInternalUrl.trim() : null;
  const sonarrApiKey = typeof body.sonarrApiKey === 'string' ? body.sonarrApiKey.trim() : null;

  for (const [label, url] of [
    ['Radarr URL', radarrUrl],
    ['Radarr internal URL', radarrInternalUrl],
    ['Sonarr URL', sonarrUrl],
    ['Sonarr internal URL', sonarrInternalUrl],
  ] as const) {
    if (url !== null && url !== '' && !validHttpUrl(url)) {
      return json({ error: `Invalid ${label}` }, 400);
    }
  }

  // Verify using the internal URL when set (it's the one used for API calls); fall back to external
  const radarrVerifyUrl = radarrInternalUrl || radarrUrl;
  const sonarrVerifyUrl = sonarrInternalUrl || sonarrUrl;

  try {
    if (radarrVerifyUrl && radarrApiKey) {
      const result = await verifyRadarr(radarrVerifyUrl, radarrApiKey);
      if (!result.ok) return json({ error: `Radarr: ${result.error}` }, 422);
    }

    if (sonarrVerifyUrl && sonarrApiKey) {
      const result = await verifySonarr(sonarrVerifyUrl, sonarrApiKey);
      if (!result.ok) return json({ error: `Sonarr: ${result.error}` }, 422);
    }

    if (radarrUrl !== null) setSetting('radarr_url', radarrUrl);
    if (radarrInternalUrl !== null) setSetting('radarr_internal_url', radarrInternalUrl);
    if (radarrApiKey) setSetting('radarr_api_key', radarrApiKey);
    if (sonarrUrl !== null) setSetting('sonarr_url', sonarrUrl);
    if (sonarrInternalUrl !== null) setSetting('sonarr_internal_url', sonarrInternalUrl);
    if (sonarrApiKey) setSetting('sonarr_api_key', sonarrApiKey);

    return json({ ok: true });
  } catch (e: unknown) {
    return json({ error: toErrorMessage(e) }, 502);
  }
};
