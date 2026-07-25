import type { APIRoute } from 'astro';
import { syncAllLibraries } from '../../../lib/sync';
import { getSetting } from '../../../lib/db';
import { json, requireAdmin } from '../../../lib/response';

export const POST: APIRoute = async ({ locals }) => {
  const deny = requireAdmin(locals);
  if (deny) return deny;
  if (getSetting('sync_enabled', '1') === '0') {
    return json({ error: 'Sync is disabled' }, 409);
  }
  const results = await syncAllLibraries();
  return json({ results });
};
