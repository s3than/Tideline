import type { APIRoute } from 'astro';
import { clearKeepRequests, clearNominations } from '../../../../lib/db';
import { json, requireAdmin, ITEM_ID_RE } from '../../../../lib/response';

export const DELETE: APIRoute = ({ params, locals, request }) => {
  const deny = requireAdmin(locals);
  if (deny) return deny;

  const { id } = params;
  if (!id || !ITEM_ID_RE.test(id)) return json({ error: 'Bad request' }, 400);

  const url = new URL(request.url);
  const type = url.searchParams.get('type');

  if (type === 'keep') {
    clearKeepRequests(id);
  } else if (type === 'nominate') {
    clearNominations(id);
  } else {
    return json({ error: 'type must be keep or nominate' }, 400);
  }

  return json({ ok: true });
};

export const POST: APIRoute = ({ params, locals, request }) => {
  const deny = requireAdmin(locals);
  if (deny) return deny;

  const { id } = params;
  if (!id || !ITEM_ID_RE.test(id)) return json({ error: 'Bad request' }, 400);

  const url = new URL(request.url);
  const type = url.searchParams.get('type');

  if (type === 'keep') {
    clearKeepRequests(id);
  } else if (type === 'nominate') {
    clearNominations(id);
  } else {
    return json({ error: 'type must be keep or nominate' }, 400);
  }

  return json({ ok: true });
};
