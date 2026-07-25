import type { APIRoute } from 'astro';
import { addKeepRequest, removeKeepRequest, getMediaById } from '../../../lib/db';
import { sendNotification } from '../../../lib/notifications';
import { json, ITEM_ID_RE, absolutePosterUrl } from '../../../lib/response';

export const PUT: APIRoute = ({ params, locals, request }) => {
  if (!locals.user) return json({ error: 'Unauthorized' }, 401);

  const { id } = params;
  if (!id || !ITEM_ID_RE.test(id)) return json({ error: 'Bad request' }, 400);

  if (!addKeepRequest(id, locals.user.jellyfinId)) {
    return json({ error: 'Item is not leaving soon' }, 404);
  }

  const item = getMediaById(id);
  if (item) {
    sendNotification({
      type: 'keep_requested',
      itemName: item.name,
      requestedBy: locals.user.name,
      year: item.year ?? undefined,
      overview: item.overview ?? undefined,
      posterUrl: item.posterTag ? absolutePosterUrl(request, id, item.posterTag) : undefined,
    });
  }

  return json({ ok: true });
};

export const DELETE: APIRoute = ({ params, locals }) => {
  if (!locals.user) return json({ error: 'Unauthorized' }, 401);

  const { id } = params;
  if (!id || !ITEM_ID_RE.test(id)) return json({ error: 'Bad request' }, 400);

  removeKeepRequest(id, locals.user.jellyfinId);
  return json({ ok: true });
};
