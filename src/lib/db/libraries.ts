import { openDb } from './connection';
import type { LibraryRow, LibrarySort, CreateLibraryInput, UpdateLibraryInput } from './types';

export function getLibraries(): LibraryRow[] {
  return (
    openDb()
      .prepare(
        'SELECT id, slug, label, jellyfin_name, item_type, display_order, sort, view_in_menu, view_leaving_soon, is_proxy FROM libraries ORDER BY display_order',
      )
      .all() as Array<{
      id: number;
      slug: string;
      label: string;
      jellyfin_name: string;
      item_type: string;
      display_order: number;
      sort: string;
      view_in_menu: number;
      view_leaving_soon: number;
      is_proxy: number;
    }>
  ).map((row) => ({
    id: row.id,
    slug: row.slug,
    label: row.label,
    jellyfinName: row.jellyfin_name,
    itemType: row.item_type as 'Movie' | 'Series' | 'Collection',
    displayOrder: row.display_order,
    sort: row.sort as LibrarySort,
    viewInMenu: row.view_in_menu === 1,
    viewLeavingSoon: row.view_leaving_soon === 1,
    isProxy: row.is_proxy === 1,
  }));
}

export function createLibrary(input: CreateLibraryInput): LibraryRow {
  const db = openDb();
  db.prepare(
    'INSERT INTO libraries (slug, label, jellyfin_name, item_type, display_order, view_in_menu, view_leaving_soon, is_proxy) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(
    input.slug,
    input.label,
    input.jellyfinName,
    input.itemType,
    input.displayOrder,
    input.viewInMenu !== false ? 1 : 0,
    input.viewLeavingSoon !== false ? 1 : 0,
    input.isProxy ? 1 : 0,
  );

  return getLibraries().find((l) => l.slug === input.slug)!;
}

export function updateLibrary(slug: string, input: UpdateLibraryInput): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.label !== undefined) {
    fields.push('label = ?');
    values.push(input.label);
  }
  if (input.jellyfinName !== undefined) {
    fields.push('jellyfin_name = ?');
    values.push(input.jellyfinName);
  }
  if (input.itemType !== undefined) {
    fields.push('item_type = ?');
    values.push(input.itemType);
  }
  if (input.displayOrder !== undefined) {
    fields.push('display_order = ?');
    values.push(input.displayOrder);
  }
  if (input.sort !== undefined) {
    fields.push('sort = ?');
    values.push(input.sort);
  }
  if (input.viewInMenu !== undefined) {
    fields.push('view_in_menu = ?');
    values.push(input.viewInMenu ? 1 : 0);
  }
  if (input.viewLeavingSoon !== undefined) {
    fields.push('view_leaving_soon = ?');
    values.push(input.viewLeavingSoon ? 1 : 0);
  }
  if (input.isProxy !== undefined) {
    fields.push('is_proxy = ?');
    values.push(input.isProxy ? 1 : 0);
  }

  if (fields.length === 0) return;
  values.push(slug);
  openDb()
    .prepare(`UPDATE libraries SET ${fields.join(', ')} WHERE slug = ?`)
    .run(...values);
}

export function deleteLibrary(slug: string): void {
  openDb().prepare('DELETE FROM libraries WHERE slug = ?').run(slug);
}
