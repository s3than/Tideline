// Shared by api/search.ts (server) and components/Search.astro (client).
export type SearchHit = {
  id: string;
  title: string;
  year: number | null;
  rating: number | null;
  overview: string | null;
  poster: string | null;
  backdrop: string | null;
  url: string;
  watchUrl: string;
};
