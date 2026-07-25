<script lang="ts">
  type Props = {
    id: string;
    name: string;
    year?: number | null;
    overview: string | null;
    posterTag: string | null;
    eager?: boolean;
  };

  let { id, name, year, overview, posterTag, eager = false }: Props = $props();

  const posterSrc = $derived(
    posterTag ? `/api/image/Primary/${id}?tag=${encodeURIComponent(posterTag)}&w=300` : '',
  );
</script>

<a
  href={`/media/${id}`}
  class="group flex flex-col overflow-hidden rounded-lg border border-white/5 bg-white/5 transition-colors hover:border-white/20 hover:bg-white/10"
>
  <div class="relative aspect-[2/3] w-full overflow-hidden bg-white/5">
    {#if posterTag}
      <img
        src={posterSrc}
        alt={name}
        class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        loading={eager ? 'eager' : 'lazy'}
        fetchpriority={eager ? 'high' : 'auto'}
      />
    {:else}
      <div class="flex h-full items-center justify-center text-white/20">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          class="h-8 w-8"
        >
          <path d="M12 9a3.75 3.75 0 1 0 0 7.5A3.75 3.75 0 0 0 12 9Z" />
          <path
            fill-rule="evenodd"
            d="M9.344 3.071a49.52 49.52 0 0 1 5.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 0 1-3 3h-15a3 3 0 0 1-3-3V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.151-.178a1.56 1.56 0 0 0 1.11-.71l.822-1.315a2.942 2.942 0 0 1 2.332-1.39ZM6.75 12.75a5.25 5.25 0 1 1 10.5 0 5.25 5.25 0 0 1-10.5 0Zm12-1.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
            clip-rule="evenodd"
          />
        </svg>
      </div>
    {/if}

    {#if overview}
      <div
        class="absolute inset-0 flex flex-col justify-end bg-black/85 p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      >
        <p class="line-clamp-[8] text-xs leading-relaxed text-white/80">{overview}</p>
      </div>
    {/if}
  </div>

  <div class="p-2">
    <p class="truncate text-xs font-medium leading-snug">{name}</p>
    {#if year}
      <p class="mt-0.5 text-[10px] text-white/40">{year}</p>
    {/if}
  </div>
</a>
