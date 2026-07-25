import type { APIRoute } from 'astro';
import { deleteSessionsForUser } from '../../../../../lib/db';
import { json, requireAdmin } from '../../../../../lib/response';

export const DELETE: APIRoute = ({ params, locals }) => {
  const deny = requireAdmin(locals);
  if (deny) return deny;

  const id = params.id;
  if (!id) return json({ error: 'Missing id' }, 400);

  deleteSessionsForUser(id);
  return json({ ok: true });
};
