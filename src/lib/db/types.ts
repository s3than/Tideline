export type LibrarySort = 'alpha_asc' | 'alpha_desc' | 'expiry';
export type LibrarySortView = 'leaving_soon' | 'library_view';

export interface UserRow {
  jellyfinId: string;
  name: string;
  primaryImageTag: string | null;
  isAdministrator: boolean;
  enableMediaPlayback: boolean;
  lastSeen: string;
}

export interface UserWithSessions extends UserRow {
  activeSessions: number;
}

export interface SessionRow {
  token: string;
  jellyfinId: string;
  userName: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
}

export interface LibraryRow {
  id: number;
  slug: string;
  label: string;
  jellyfinName: string;
  itemType: 'Movie' | 'Series' | 'Collection';
  displayOrder: number;
  sort: LibrarySort;
  viewInMenu: boolean;
  viewLeavingSoon: boolean;
  isProxy: boolean;
}

export interface LeavingSoonEntry {
  firstSeen: string; // YYYY-MM-DD
  expiresOn: string; // YYYY-MM-DD
}

export interface MediaRow {
  jellyfinId: string;
  librarySlug: string;
  name: string;
  sortName: string | null;
  year: number | null;
  premiereDate: string | null;
  dateAdded: string | null;
  overview: string | null;
  tagline: string | null;
  posterTag: string | null;
  backdropTag: string | null;
  communityRating: number | null;
  criticRating: number | null;
  officialRating: string | null;
  genres: string[] | null;
  providerIds: Record<string, string> | null;
  runtimeTicks: number | null;
  seriesStatus: string | null;
  episodeCount: number | null;
  itemType: 'Movie' | 'Series' | 'Season' | 'Collection';
  leavingSoon: boolean;
  leavingDays: number | null;
  syncedAt: string;
  seriesId: string | null;
  indexNumber: number | null;
  seriesName: string | null;
  jellyfinLastSaved: string | null;
}

export interface MediaInsert {
  jellyfinId: string;
  librarySlug: string;
  name: string;
  sortName: string | null;
  year: number | null;
  premiereDate?: string | null;
  dateAdded: string | null;
  overview: string | null;
  tagline?: string | null;
  posterTag: string | null;
  backdropTag?: string | null;
  communityRating?: number | null;
  criticRating?: number | null;
  officialRating?: string | null;
  genres?: string[] | null;
  providerIds?: Record<string, string> | null;
  runtimeTicks?: number | null;
  seriesStatus?: string | null;
  episodeCount?: number | null;
  itemType: 'Movie' | 'Series' | 'Season' | 'Collection';
  leavingSoon: boolean;
  leavingDays: number | null;
  seriesId?: string | null;
  indexNumber?: number | null;
  seriesName?: string | null;
  jellyfinLastSaved?: string | null;
}

export interface CreateLibraryInput {
  slug: string;
  label: string;
  jellyfinName: string;
  itemType: 'Movie' | 'Series' | 'Collection';
  displayOrder: number;
  viewInMenu?: boolean;
  viewLeavingSoon?: boolean;
  isProxy?: boolean;
}

export interface UpdateLibraryInput {
  label?: string;
  jellyfinName?: string;
  itemType?: 'Movie' | 'Series' | 'Collection';
  displayOrder?: number;
  sort?: LibrarySort;
  viewInMenu?: boolean;
  viewLeavingSoon?: boolean;
  isProxy?: boolean;
}

export interface LeavingSoonMediaRow extends MediaRow {
  resolvedDays: number;
}

export interface SyncResult {
  slug: string;
  label: string;
  synced: number;
  error?: string;
}

export interface LibraryDisplayItem {
  id: string;
  name: string;
  year?: number;
  overview: string | null;
  posterTag: string | null;
}
