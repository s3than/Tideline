import type { APIRoute } from 'astro';
import { getJellyfinLibraries } from '../../../../lib/jellyfin';
import { json, requireAdmin } from '../../../../lib/response';

export const GET: APIRoute = async ({ locals }) => {
  const deny = requireAdmin(locals);
  if (deny) return deny;

  try {
    const libraries = await getJellyfinLibraries();
    return json({ libraries });
  } catch {
    return json({ error: 'Could not reach Jellyfin' }, 502);
  }
};
