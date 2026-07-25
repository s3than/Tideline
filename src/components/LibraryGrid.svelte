<script lang="ts">
  import { untrack } from 'svelte';
  import PosterCard from './PosterCard.svelte';
  import type { LibraryDisplayItem } from '../lib/db';
  import { toErrorMessage } from '../lib/response';

  type Props = {
    slug: string;
    initialItems: LibraryDisplayItem[];
    total: number;
    pageSize: number;
  };

  let { slug, initialItems, total, pageSize }: Props = $props();

  let items: LibraryDisplayItem[] = $state(untrack(() => initialItems));
  let currentPage: number = $state(0);
  let totalItems: number = $state(untrack(() => total));
  let loading: boolean = $state(false);
  let error: string | null = $state(null);

  let totalPages = $derived(Math.ceil(totalItems / pageSize));
  let hasPrev = $derived(currentPage > 0);
  let hasNext = $derived(currentPage < totalPages - 1);

  async function goToPage(page: number) {
    if (page < 0 || page >= totalPages || loading) return;
    loading = true;
    error = null;
    try {
      const resp = await fetch(`/api/libraries/${slug}?page=${page}`);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? 'Failed to load page');
      items = data.items;
      totalItems = data.total;
      currentPage = page;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: unknown) {
      error = toErrorMessage(e);
    } finally {
      loading = false;
    }
  }
</script>

<div>
  {#if error}
    <div
      class="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
    >
      {error}
    </div>
  {/if}

  <!-- Grid -->
  <div class="relative">
    {#if loading}
      <div class="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/40">
        <div class="text-sm text-white/60">Loading…</div>
      </div>
    {/if}

    <div
      class="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 {loading
        ? 'opacity-50'
        : ''}"
    >
      {#each items as item, i (item.id)}
        <PosterCard
          id={item.id}
          name={item.name}
          year={item.year}
          overview={item.overview}
          posterTag={item.posterTag}
          eager={i < pageSize}
        />
      {/each}
    </div>
  </div>

  <!-- Pagination -->
  {#if totalPages > 1}
    <div class="mt-8 flex items-center justify-between">
      <button
        onclick={() => goToPage(currentPage - 1)}
        disabled={!hasPrev || loading}
        aria-label="Previous page"
        class="flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-white shadow-lg shadow-black/40 backdrop-blur transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-30"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          class="h-5 w-5"
        >
          <path
            fill-rule="evenodd"
            d="M15.78 5.22a.75.75 0 0 1 0 1.06L9.06 13l6.72 6.72a.75.75 0 1 1-1.06 1.06l-7.25-7.25a.75.75 0 0 1 0-1.06l7.25-7.25a.75.75 0 0 1 1.06 0Z"
            clip-rule="evenodd"
          />
        </svg>
      </button>

      <span class="text-sm text-white/40">
        Page {currentPage + 1} of {totalPages}
        <span class="text-white/25">· {totalItems} items</span>
      </span>

      <button
        onclick={() => goToPage(currentPage + 1)}
        disabled={!hasNext || loading}
        aria-label="Next page"
        class="flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-white shadow-lg shadow-black/40 backdrop-blur transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-30"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          class="h-5 w-5"
        >
          <path
            fill-rule="evenodd"
            d="M8.22 5.22a.75.75 0 0 1 1.06 0l7.25 7.25a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 1 1-1.06-1.06L14.94 13 8.22 6.28a.75.75 0 0 1 0-1.06Z"
            clip-rule="evenodd"
          />
        </svg>
      </button>
    </div>
  {/if}
</div>
