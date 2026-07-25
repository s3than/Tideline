import type { APIRoute } from 'astro';
import { isJellyfinConfigured, verifyJellyfinServer } from '../../../lib/jellyfin/client';
import { validateSetupToken } from '../../../lib/setupToken';
import { setSetting } from '../../../lib/db/settings';
import { json, validHttpUrl } from '../../../lib/response';

export const POST: APIRoute = async ({ request }) => {
  if (isJellyfinConfigured()) {
    return json({ error: 'Already configured' }, 403);
  }

  const body = (await request.json()) as {
    url?: string;
    internalUrl?: string | null;
    apiKey?: string;
    setupToken?: string;
  };
  const { url, internalUrl, apiKey, setupToken } = body;

  if (!validateSetupToken(setupToken ?? '')) {
    return json({ error: 'Invalid setup token' }, 403);
  }

  if (!url?.trim() || !apiKey?.trim()) {
    return json({ error: 'URL and API key are required' }, 400);
  }

  if (!validHttpUrl(url.trim()) || (internalUrl?.trim() && !validHttpUrl(internalUrl.trim()))) {
    return json({ error: 'URL must use http or https' }, 400);
  }

  // Verify against the internal URL if provided — that's what the server will use at runtime.
  const verifyBase = (internalUrl?.trim() || url.trim()).replace(/\/$/, '');
  const verify = await verifyJellyfinServer(verifyBase, apiKey.trim());
  if (!verify.ok) {
    return json({ error: verify.error }, 400);
  }

  setSetting('jellyfin_url', url.trim().replace(/\/$/, ''));
  if (internalUrl?.trim()) {
    setSetting('jellyfin_internal_url', internalUrl.trim().replace(/\/$/, ''));
  }
  setSetting('jellyfin_api_key', apiKey.trim());

  return json({ ok: true });
};
