import type { APIRoute } from 'astro';
import {
  updateLibrary,
  deleteLibrary,
  type UpdateLibraryInput,
  type LibrarySort,
} from '../../../../lib/db';
import { json, requireAdmin } from '../../../../lib/response';
import { VALID_LIBRARY_TYPES } from '../../../../lib/constants';

const VALID_SORTS: LibrarySort[] = ['alpha_asc', 'alpha_desc', 'expiry'];

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const deny = requireAdmin(locals);
  if (deny) return deny;

  const { slug } = params;
  if (!slug) return json({ error: 'Missing slug' }, 400);

  let body: Partial<UpdateLibraryInput & { jellyfinName: string; isProxy: boolean }>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid body' }, 400);
  }

  const input: UpdateLibraryInput = {};
  if (body.label !== undefined) input.label = String(body.label).trim();
  if (body.jellyfinName !== undefined) input.jellyfinName = String(body.jellyfinName).trim();
  if (body.itemType !== undefined) {
    if (!VALID_LIBRARY_TYPES.has(body.itemType as string))
      return json({ error: 'Invalid itemType' }, 400);
    input.itemType = body.itemType as 'Movie' | 'Series' | 'Collection';
  }
  if (body.displayOrder !== undefined) input.displayOrder = Number(body.displayOrder);
  if (body.sort !== undefined) {
    if (!VALID_SORTS.includes(body.sort as LibrarySort))
      return json({ error: 'Invalid sort' }, 400);
    input.sort = body.sort as LibrarySort;
  }
  if (body.viewInMenu !== undefined) input.viewInMenu = Boolean(body.viewInMenu);
  if (body.viewLeavingSoon !== undefined) input.viewLeavingSoon = Boolean(body.viewLeavingSoon);
  if (body.isProxy !== undefined) input.isProxy = Boolean(body.isProxy);

  updateLibrary(slug, input);
  return json({ ok: true });
};

export const DELETE: APIRoute = ({ params, locals }) => {
  const deny = requireAdmin(locals);
  if (deny) return deny;

  const { slug } = params;
  if (!slug) return json({ error: 'Missing slug' }, 400);

  deleteLibrary(slug);
  return json({ ok: true });
};
