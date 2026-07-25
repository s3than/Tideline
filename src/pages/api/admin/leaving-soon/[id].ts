import type { APIRoute } from 'astro';
import { addItemTags, removeItemLeavingSoonTags } from '../../../../lib/jellyfin';
import {
  getSetting,
  clearKeepRequests,
  tagItemLeavingSoon,
  leavingSoonExpiry,
  getMediaById,
  getLibraries,
} from '../../../../lib/db';
import { sendNotification } from '../../../../lib/notifications';
import {
  json,
  requireAdmin,
  ITEM_ID_RE,
  absolutePosterUrl,
  toErrorMessage,
} from '../../../../lib/response';

export const POST: APIRoute = async ({ params, locals, request }) => {
  const deny = requireAdmin(locals);
  if (deny) return deny;

  const { id } = params;
  if (!id || !ITEM_ID_RE.test(id)) return json({ error: 'Bad request' }, 400);

  let days: number;
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = Number(body?.days);
    days =
      Number.isFinite(parsed) && parsed > 0
        ? parsed
        : parseInt(getSetting('leaving_soon_days_fallback', '30'), 10);
  } catch {
    days = parseInt(getSetting('leaving_soon_days_fallback', '30'), 10);
  }

  try {
    const entry = leavingSoonExpiry(days);
    tagItemLeavingSoon(id, entry);
    await addItemTags(id, ['leaving-soon', `lv-${days}`]);

    const item = getMediaById(id);
    if (item) {
      const lib = getLibraries().find((l) => l.slug === item.librarySlug);
      sendNotification({
        type: 'tagged',
        itemName: item.name,
        libraryLabel: lib?.label ?? item.librarySlug,
        days,
        year: item.year ?? undefined,
        overview: item.overview ?? undefined,
        posterUrl: item.posterTag ? absolutePosterUrl(request, id, item.posterTag) : undefined,
      });
    }

    return json({ ok: true, days });
  } catch (e: unknown) {
    return json({ error: toErrorMessage(e) }, 502);
  }
};

export const DELETE: APIRoute = async ({ params, locals, request }) => {
  const deny = requireAdmin(locals);
  if (deny) return deny;

  const { id } = params;
  if (!id || !ITEM_ID_RE.test(id)) return json({ error: 'Bad request' }, 400);

  try {
    const item = getMediaById(id);
    await removeItemLeavingSoonTags(id);
    clearKeepRequests(id);

    if (item) {
      const lib = getLibraries().find((l) => l.slug === item.librarySlug);
      sendNotification({
        type: 'untagged',
        itemName: item.name,
        libraryLabel: lib?.label ?? item.librarySlug,
        year: item.year ?? undefined,
        overview: item.overview ?? undefined,
        posterUrl: item.posterTag ? absolutePosterUrl(request, id, item.posterTag) : undefined,
      });
    }

    return json({ ok: true });
  } catch (e: unknown) {
    return json({ error: toErrorMessage(e) }, 502);
  }
};
