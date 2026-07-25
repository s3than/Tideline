import type { APIRoute } from 'astro';
import { addNomination, removeNomination, getMediaById, getLibraries } from '../../../lib/db';
import { sendNotification } from '../../../lib/notifications';
import { json, ITEM_ID_RE, absolutePosterUrl } from '../../../lib/response';

export const PUT: APIRoute = async ({ params, locals, request }) => {
  if (!locals.user) return json({ error: 'Unauthorized' }, 401);

  const { id } = params;
  if (!id || !ITEM_ID_RE.test(id)) return json({ error: 'Bad request' }, 400);

  let body: { itemName?: string; librarySlug?: string | null } = {};
  try {
    body = await request.json();
  } catch {
    /* ignore parse errors */
  }

  const itemName =
    typeof body.itemName === 'string' && body.itemName.trim()
      ? body.itemName.trim().slice(0, 500)
      : 'Unknown';
  const librarySlug = typeof body.librarySlug === 'string' ? body.librarySlug : null;

  addNomination(id, locals.user.jellyfinId, itemName, librarySlug);

  const libraries = getLibraries();
  const libraryLabel = librarySlug
    ? (libraries.find((l) => l.slug === librarySlug)?.label ?? librarySlug)
    : 'unknown library';

  const item = getMediaById(id);
  sendNotification({
    type: 'nominated',
    itemName,
    libraryLabel,
    nominatedBy: locals.user.name,
    year: item?.year ?? undefined,
    overview: item?.overview ?? undefined,
    posterUrl: item?.posterTag ? absolutePosterUrl(request, id, item.posterTag) : undefined,
  });

  return json({ ok: true });
};

export const DELETE: APIRoute = ({ params, locals }) => {
  if (!locals.user) return json({ error: 'Unauthorized' }, 401);

  const { id } = params;
  if (!id || !ITEM_ID_RE.test(id)) return json({ error: 'Bad request' }, 400);

  removeNomination(id, locals.user.jellyfinId);
  return json({ ok: true });
};
