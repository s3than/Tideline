import type { APIRoute } from 'astro';
import { getAllSessions } from '../../../../lib/db';
import { json, requireAdmin } from '../../../../lib/response';

export const GET: APIRoute = ({ locals }) => {
  const deny = requireAdmin(locals);
  if (deny) return deny;
  return json({ sessions: getAllSessions() });
};
