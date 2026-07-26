import type { APIRoute } from 'astro';
import { verifyJellyfinServer } from '../../../lib/jellyfin/client';
import { getSetting, setSetting } from '../../../lib/db';
import { json, requireAdmin, validHttpUrl } from '../../../lib/response';

const ENV_URL = import.meta.env.JELLYFIN_URL || process.env.JELLYFIN_URL || undefined;
const ENV_INTERNAL_URL =
  import.meta.env.JELLYFIN_INTERNAL_URL || process.env.JELLYFIN_INTERNAL_URL || undefined;
const ENV_API_KEY = import.meta.env.JELLYFIN_API_KEY || process.env.JELLYFIN_API_KEY || undefined;

export const GET: APIRoute = ({ locals }) => {
  const deny = requireAdmin(locals);
  if (deny) return deny;

  return json({
    externalUrl: (ENV_URL ?? getSetting('jellyfin_url', '')).replace(/\/$/, ''),
    internalUrl: (ENV_INTERNAL_URL ?? getSetting('jellyfin_internal_url', '')).replace(/\/$/, ''),
    hasApiKey: !!(ENV_API_KEY ?? getSetting('jellyfin_api_key', '')),
    envLocked: {
      externalUrl: !!ENV_URL,
      internalUrl: !!ENV_INTERNAL_URL,
      apiKey: !!ENV_API_KEY,
    },
  });
};

export const PATCH: APIRoute = async ({ request, locals }) => {
  const deny = requireAdmin(locals);
  if (deny) return deny;

  let body: { externalUrl?: string; internalUrl?: string; apiKey?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid body' }, 400);
  }

  const newExternalUrl =
    !ENV_URL && typeof body.externalUrl === 'string' ? body.externalUrl.trim() : null;
  const newInternalUrl =
    !ENV_INTERNAL_URL && typeof body.internalUrl === 'string' ? body.internalUrl.trim() : null;
  const newApiKey =
    !ENV_API_KEY && typeof body.apiKey === 'string' && body.apiKey.trim()
      ? body.apiKey.trim()
      : null;

  if (newExternalUrl !== null) {
    if (!newExternalUrl) return json({ error: 'Jellyfin URL is required' }, 400);
    if (!validHttpUrl(newExternalUrl)) return json({ error: 'Jellyfin URL must use http or https' }, 400);
  }
  if (newInternalUrl !== null && newInternalUrl !== '') {
    if (!validHttpUrl(newInternalUrl)) return json({ error: 'Internal URL must use http or https' }, 400);
  }

  // Effective values for verification: env > submitted > stored
  const effectiveExternalUrl = (ENV_URL ?? newExternalUrl ?? getSetting('jellyfin_url', '')).replace(/\/$/, '');
  const effectiveInternalUrl = (ENV_INTERNAL_URL ?? newInternalUrl ?? getSetting('jellyfin_internal_url', '')).replace(/\/$/, '');
  const effectiveApiKey = ENV_API_KEY ?? newApiKey ?? getSetting('jellyfin_api_key', '');

  if (!effectiveExternalUrl) return json({ error: 'Jellyfin URL is required' }, 400);
  if (!effectiveApiKey) return json({ error: 'API key is required' }, 400);

  const verifyBase = effectiveInternalUrl || effectiveExternalUrl;
  const verify = await verifyJellyfinServer(verifyBase, effectiveApiKey);
  if (!verify.ok) return json({ error: verify.error }, 400);

  if (newExternalUrl !== null) setSetting('jellyfin_url', newExternalUrl.replace(/\/$/, ''));
  if (newInternalUrl !== null) setSetting('jellyfin_internal_url', newInternalUrl.replace(/\/$/, ''));
  if (newApiKey) setSetting('jellyfin_api_key', newApiKey);

  return json({ ok: true, serverName: verify.serverName, version: verify.version });
};
