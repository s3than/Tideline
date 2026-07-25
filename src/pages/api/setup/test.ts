import type { APIRoute } from 'astro';
import { isJellyfinConfigured, verifyJellyfinServer } from '../../../lib/jellyfin/client';
import { validateSetupToken } from '../../../lib/setupToken';
import { json, validHttpUrl } from '../../../lib/response';

export const POST: APIRoute = async ({ request }) => {
  if (isJellyfinConfigured()) {
    return json({ ok: false, error: 'Already configured' }, 403);
  }

  const body = (await request.json()) as { url?: string; apiKey?: string; setupToken?: string };
  const { url, apiKey, setupToken } = body;

  if (!validateSetupToken(setupToken ?? '')) {
    return json({ ok: false, error: 'Invalid setup token' }, 403);
  }

  if (!url?.trim() || !apiKey?.trim()) {
    return json({ ok: false, error: 'URL and API key are required' }, 400);
  }

  if (!validHttpUrl(url.trim())) {
    return json({ ok: false, error: 'URL must use http or https' }, 400);
  }

  const result = await verifyJellyfinServer(url.trim().replace(/\/$/, ''), apiKey.trim());
  return json(result);
};
