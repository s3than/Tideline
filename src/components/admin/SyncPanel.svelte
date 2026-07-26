<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { formatDateTime } from '../../lib/format';
  import { toErrorMessage } from '../../lib/response';

  type LibrarySyncInfo = {
    slug: string;
    label: string;
    syncedAt: string | null;
    count: number;
    isProxy: boolean;
  };

  type SyncResult = {
    slug: string;
    label: string;
    synced: number;
    error?: string;
  };

  type Props = {
    libraries: LibrarySyncInfo[];
    syncEnabled: boolean;
  };

  let { libraries: initial, syncEnabled: initialSyncEnabled }: Props = $props();

  let syncEnabled: boolean = $state(untrack(() => initialSyncEnabled));
  let showSyncInfo: boolean = $state(false);
  let togglingSync: boolean = $state(false);
  let libraries: LibrarySyncInfo[] = $state(untrack(() => initial));
  let syncing: 'full' | 'partial' | null = $state(null);
  let error: string | null = $state(null);
  let syncTimes: Record<string, string | null> = $state(
    untrack(() => Object.fromEntries(initial.map((l) => [l.slug, l.syncedAt]))),
  );
  let syncCounts: Record<string, number> = $state(
    untrack(() => Object.fromEntries(initial.map((l) => [l.slug, l.count]))),
  );
  let syncErrors: Record<string, string | undefined> = $state({});

  async function toggleSync() {
    togglingSync = true;
    error = null;
    const next = !syncEnabled;
    try {
      const resp = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sync_enabled: next ? '1' : '0' }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? 'Failed to save setting');
      syncEnabled = next;
      window.dispatchEvent(new CustomEvent('tideline:sync-changed', { detail: { enabled: next } }));
    } catch (e: unknown) {
      error = toErrorMessage(e);
    } finally {
      togglingSync = false;
    }
  }

  // Refresh when LibraryManager adds/edits/deletes a library, so proxy badges
  // and sync status reflect the change without a page reload.
  async function refreshLibraries() {
    try {
      const resp = await fetch('/api/admin/libraries');
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? 'Failed to load libraries');
      libraries = data.libraries as LibrarySyncInfo[];
      syncTimes = Object.fromEntries(libraries.map((l) => [l.slug, l.syncedAt]));
      syncCounts = Object.fromEntries(libraries.map((l) => [l.slug, l.count]));
      syncErrors = {};
    } catch (e: unknown) {
      error = toErrorMessage(e);
    }
  }

  onMount(() => {
    window.addEventListener('tideline:libraries-changed', refreshLibraries);
    return () => window.removeEventListener('tideline:libraries-changed', refreshLibraries);
  });

  async function runSync(partial: boolean) {
    syncing = partial ? 'partial' : 'full';
    error = null;
    try {
      const url = partial ? '/api/admin/sync?partial=1' : '/api/admin/sync';
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? 'Sync failed');
      const now = new Date().toISOString();
      for (const r of data.results as SyncResult[]) {
        syncErrors[r.slug] = r.error;
        if (!r.error) {
          syncTimes[r.slug] = now;
          if (!partial) syncCounts[r.slug] = r.synced;
        }
      }
      if (partial) await refreshLibraries();
    } catch (e: unknown) {
      error = toErrorMessage(e);
    } finally {
      syncing = null;
    }
  }
</script>

<div class="rounded-xl border border-white/10 bg-white/5 p-5 space-y-5">
  <!-- Sync enabled toggle -->
  <div class="flex items-center justify-between">
    <div>
      <p class="flex items-center gap-1.5 text-sm font-medium">
        Sync enabled
        <button
          onclick={() => {
            showSyncInfo = !showSyncInfo;
          }}
          class="flex h-4 w-4 items-center justify-center rounded-full border border-white/20 text-[10px] text-white/40 transition-colors hover:border-white/40 hover:text-white/70"
          aria-label="About sync">?</button
        >
      </p>
      <p class="text-xs text-white/40 mt-0.5">
        Controls whether libraries sync to the local database or proxy live from Jellyfin.
      </p>
      {#if showSyncInfo}
        <div
          class="mt-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-white/50 space-y-1.5"
        >
          <p>
            <span class="text-white/70">Sync disabled:</span> all libraries proxy live from Jellyfin —
            Jellyfin's per-user permissions are fully enforced.
          </p>
          <p>
            <span class="text-white/70">Sync enabled:</span> synced libraries serve from the local
            database — all users see all content regardless of Jellyfin permissions. Mark individual
            libraries as <span class="text-white/70">Proxy</span> to keep Jellyfin's access controls for
            them while syncing others.
          </p>
          <p>
            <span class="text-white/70">Search</span> follows the same split: synced libraries are searched
            locally (fast), proxy libraries fall back to Jellyfin (slower, permissions enforced).
          </p>
        </div>
      {/if}
    </div>
    <button
      onclick={toggleSync}
      disabled={togglingSync}
      aria-pressed={syncEnabled}
      class="relative ml-6 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50
        {syncEnabled ? 'bg-accent' : 'bg-white/20'}"
    >
      <span
        class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
          {syncEnabled ? 'translate-x-5' : 'translate-x-0'}"
      ></span>
    </button>
  </div>

  {#if !syncEnabled}
    <div
      class="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300"
    >
      Sync is disabled. All libraries are proxied live from Jellyfin. Jellyfin's per-user access
      controls are fully enforced.
    </div>
  {/if}

  <!-- Library sync status table -->
  <div class="divide-y divide-white/5">
    {#each libraries as lib (lib.slug)}
      <div class="flex items-center justify-between py-3">
        <div>
          <p class="flex items-center gap-2 text-sm font-medium">
            {lib.label}
            {#if lib.isProxy}
              <span
                class="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-blue-500/15 text-blue-300"
                title="Proxy — always fetched live from Jellyfin, not stored locally"
              >
                Proxy
              </span>
            {/if}
          </p>
          {#if !lib.isProxy}
            <p class="text-xs text-white/40">
              Last synced: {formatDateTime(syncTimes[lib.slug] ?? null)}
            </p>
          {/if}
        </div>
        {#if lib.isProxy}
          <span class="text-xs text-white/30">Live from Jellyfin</span>
        {:else if syncErrors[lib.slug]}
          <span class="text-xs text-red-400">{syncErrors[lib.slug]}</span>
        {:else if syncTimes[lib.slug]}
          <span class="text-xs text-green-400">{syncCounts[lib.slug] ?? 0} items synced</span>
        {/if}
      </div>
    {/each}
  </div>

  {#if error}
    <div class="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      {error}
    </div>
  {/if}

  <div class="flex items-center gap-2">
    <button
      onclick={() => runSync(false)}
      disabled={syncing !== null || !syncEnabled}
      class="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {#if syncing === 'full'}
        <svg
          class="h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
          ></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"
          ></path>
        </svg>
        Syncing…
      {:else}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          class="h-4 w-4"
        >
          <path
            fill-rule="evenodd"
            d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.389Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z"
            clip-rule="evenodd"
          />
        </svg>
        Full Sync
      {/if}
    </button>

    <button
      onclick={() => runSync(true)}
      disabled={syncing !== null || !syncEnabled}
      class="flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white/70 transition-colors hover:border-white/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      {#if syncing === 'partial'}
        <svg
          class="h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
          ></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"
          ></path>
        </svg>
        Syncing…
      {:else}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          class="h-4 w-4"
        >
          <path d="M10 3a7 7 0 1 0 7 7h-2a5 5 0 1 1-5-5V3Z" />
        </svg>
        Partial Sync
      {/if}
    </button>
  </div>
</div>
