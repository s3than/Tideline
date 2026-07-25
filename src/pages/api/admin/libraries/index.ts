import type { APIRoute } from 'astro';
import {
  getLibraries,
  createLibrary,
  getLibrarySyncedAt,
  getMediaCount,
  getSetting,
  type CreateLibraryInput,
} from '../../../../lib/db';
import { syncLibrary } from '../../../../lib/sync';
import { json, requireAdmin, toErrorMessage } from '../../../../lib/response';
import { VALID_LIBRARY_TYPES } from '../../../../lib/constants';

export const GET: APIRoute = ({ locals }) => {
  const deny = requireAdmin(locals);
  if (deny) return deny;
  const libraries = getLibraries().map((l) => ({
    ...l,
    syncedAt: getLibrarySyncedAt(l.slug),
    count: getMediaCount(l.slug),
  }));
  return json({ libraries });
};

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const POST: APIRoute = async ({ request, locals }) => {
  const deny = requireAdmin(locals);
  if (deny) return deny;

  let body: Partial<CreateLibraryInput> & {
    viewInMenu?: boolean;
    viewLeavingSoon?: boolean;
    isProxy?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid body' }, 400);
  }

  const { slug, label, jellyfinName, itemType, displayOrder } = body;

  if (!slug || !SLUG_RE.test(slug))
    return json({ error: 'Invalid slug (lowercase letters, numbers, hyphens)' }, 400);
  if (!label?.trim()) return json({ error: 'Label is required' }, 400);
  if (!jellyfinName?.trim()) return json({ error: 'Jellyfin library name is required' }, 400);
  if (!itemType || !VALID_LIBRARY_TYPES.has(itemType))
    return json({ error: 'itemType must be Movie, Series, or Collection' }, 400);

  const existing = getLibraries().find((l) => l.slug === slug);
  if (existing) return json({ error: `Slug "${slug}" is already in use` }, 409);

  const syncDisabled = getSetting('sync_enabled', '1') === '0';
  const isProxy = syncDisabled
    ? true
    : body.isProxy !== undefined
      ? Boolean(body.isProxy)
      : itemType === 'Collection';

  try {
    const library = createLibrary({
      slug,
      label: label.trim(),
      jellyfinName: jellyfinName.trim(),
      itemType,
      displayOrder: displayOrder ?? 0,
      viewInMenu: body.viewInMenu !== false,
      viewLeavingSoon:
        isProxy || itemType === 'Collection' ? false : body.viewLeavingSoon !== false,
      isProxy,
    });

    if (!library.isProxy && !syncDisabled) {
      syncLibrary(library).catch((err) =>
        console.error(`[sync] Auto-sync for "${library.slug}" failed:`, err),
      );
    }

    return json({ library }, 201);
  } catch (err: unknown) {
    return json({ error: toErrorMessage(err) }, 500);
  }
};
