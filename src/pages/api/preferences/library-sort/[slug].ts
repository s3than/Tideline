import type { APIRoute } from 'astro';
import {
  getLibraries,
  setUserLibrarySort,
  type LibrarySort,
  type LibrarySortView,
} from '../../../../lib/db';
import { json } from '../../../../lib/response';

const VALID_SORTS = new Set<LibrarySort>(['alpha_asc', 'alpha_desc', 'expiry']);
const VALID_VIEWS = new Set<LibrarySortView>(['leaving_soon', 'library_view']);

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  if (!locals.user) return json({ error: 'Unauthorized' }, 401);

  const library = getLibraries().find((l) => l.slug === params.slug);
  if (!library) return json({ error: 'Not found' }, 404);

  let body: { sort?: string; view?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid body' }, 400);
  }

  if (!body.sort || !VALID_SORTS.has(body.sort as LibrarySort)) {
    return json({ error: 'sort must be one of alpha_asc, alpha_desc, expiry' }, 400);
  }
  if (!body.view || !VALID_VIEWS.has(body.view as LibrarySortView)) {
    return json({ error: 'view must be one of leaving_soon, library_view' }, 400);
  }

  setUserLibrarySort(
    locals.user.jellyfinId,
    library.slug,
    body.view as LibrarySortView,
    body.sort as LibrarySort,
  );
  return json({ ok: true });
};
