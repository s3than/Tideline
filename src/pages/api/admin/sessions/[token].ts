import type { APIRoute } from 'astro';
import { deleteSession } from '../../../../lib/db';
import { json, requireAdmin } from '../../../../lib/response';

export const DELETE: APIRoute = ({ params, locals }) => {
  const deny = requireAdmin(locals);
  if (deny) return deny;

  const { token } = params;
  if (!token) return json({ error: 'Missing token' }, 400);

  deleteSession(token);
  return json({ ok: true });
};
