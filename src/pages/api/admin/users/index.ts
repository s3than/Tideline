import type { APIRoute } from 'astro';
import { getUsersWithSessionCounts } from '../../../../lib/db';
import { json, requireAdmin } from '../../../../lib/response';

export const GET: APIRoute = ({ locals }) => {
  const deny = requireAdmin(locals);
  if (deny) return deny;
  return json({ users: getUsersWithSessionCounts() });
};
