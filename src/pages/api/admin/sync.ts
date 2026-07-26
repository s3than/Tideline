import type { APIRoute } from 'astro';
import { syncAllLibraries, diffSyncAllLibraries } from '../../../lib/sync';
import { getSetting } from '../../../lib/db';
import { json, requireAdmin } from '../../../lib/response';

export const POST: APIRoute = async ({ request, locals }) => {
  const deny = requireAdmin(locals);
  if (deny) return deny;
  if (getSetting('sync_enabled', '1') === '0') {
    return json({ error: 'Sync is disabled' }, 409);
  }
  const url = new URL(request.url);
  const partial = url.searchParams.get('partial') === '1';
  const results = await (partial ? diffSyncAllLibraries() : syncAllLibraries());
  return json({ results });
};
