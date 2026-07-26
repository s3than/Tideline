import type { APIRoute } from 'astro';
import { getSyncLog, getSetting } from '../../../lib/db';
import { json, requireAdmin } from '../../../lib/response';

export const GET: APIRoute = ({ locals }) => {
  const deny = requireAdmin(locals);
  if (deny) return deny;
  const limit = parseInt(getSetting('sync_log_max_entries', '20'), 10);
  return json({ entries: getSyncLog(limit) });
};
