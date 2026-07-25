import { openDb } from './connection';
import type { LibrarySort, LibrarySortView } from './types';

export function getUserLibrarySort(
  jellyfinId: string,
  librarySlug: string,
  view: LibrarySortView,
): LibrarySort | null {
  const row = openDb()
    .prepare(
      'SELECT sort FROM user_library_sort WHERE jellyfin_id = ? AND library_slug = ? AND view = ?',
    )
    .get(jellyfinId, librarySlug, view) as { sort: LibrarySort } | undefined;
  return row?.sort ?? null;
}

export function setUserLibrarySort(
  jellyfinId: string,
  librarySlug: string,
  view: LibrarySortView,
  sort: LibrarySort,
): void {
  openDb()
    .prepare(
      `
      INSERT INTO user_library_sort (jellyfin_id, library_slug, view, sort)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(jellyfin_id, library_slug, view) DO UPDATE SET sort = excluded.sort
    `,
    )
    .run(jellyfinId, librarySlug, view, sort);
}
