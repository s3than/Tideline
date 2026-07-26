<script lang="ts">
  import { untrack } from 'svelte';
  import { formatDateTime } from '../../lib/format';
  import { toErrorMessage } from '../../lib/response';

  type SyncResult = {
    slug: string;
    label: string;
    synced: number;
    error?: string;
  };

  type SyncLogEntry = {
    id: number;
    runAt: string;
    type: 'full' | 'partial';
    durationMs: number;
    results: SyncResult[];
  };

  type Props = {
    initialEntries: SyncLogEntry[];
    maxEntries: number;
  };

  let { initialEntries, maxEntries: initialMax }: Props = $props();

  let entries: SyncLogEntry[] = $state(untrack(() => initialEntries));
  let maxEntries: number = $state(untrack(() => initialMax));
  let savingMax: boolean = $state(false);
  let savedMax: boolean = $state(false);
  let refreshing: boolean = $state(false);
  let error: string | null = $state(null);

  async function saveMax() {
    savingMax = true;
    savedMax = false;
    error = null;
    try {
      const resp = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sync_log_max_entries: maxEntries }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? 'Failed to save');
      savedMax = true;
      setTimeout(() => {
        savedMax = false;
      }, 2000);
    } catch (e: unknown) {
      error = toErrorMessage(e);
    } finally {
      savingMax = false;
    }
  }

  async function refresh() {
    refreshing = true;
    error = null;
    try {
      const resp = await fetch('/api/admin/sync-log');
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? 'Failed to load log');
      entries = data.entries as SyncLogEntry[];
    } catch (e: unknown) {
      error = toErrorMessage(e);
    } finally {
      refreshing = false;
    }
  }

  function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function entryHasError(entry: SyncLogEntry): boolean {
    return entry.results.some((r) => r.error);
  }
</script>

<div class="space-y-4">
  {#if error}
    <div class="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      {error}
    </div>
  {/if}

  <!-- Retention setting -->
  <div class="flex items-center gap-3">
    <label class="text-sm text-white/60" for="log-max">Keep last</label>
    <input
      id="log-max"
      type="number"
      min="1"
      max="500"
      bind:value={maxEntries}
      class="w-20 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-accent focus:outline-none"
    />
    <span class="text-sm text-white/60">entries</span>
    <button
      onclick={saveMax}
      disabled={savingMax}
      class="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/20 disabled:opacity-50"
    >
      {savingMax ? 'Saving…' : 'Save'}
    </button>
    {#if savedMax}
      <span class="text-sm text-green-400">Saved</span>
    {/if}

    <button
      onclick={refresh}
      disabled={refreshing}
      aria-label="Refresh log"
      class="ml-auto flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white/50 transition-colors hover:border-white/20 hover:text-white/80 disabled:opacity-50"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        class="h-3.5 w-3.5 {refreshing ? 'animate-spin' : ''}"
      >
        <path
          fill-rule="evenodd"
          d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.389Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z"
          clip-rule="evenodd"
        />
      </svg>
      Refresh
    </button>
  </div>

  <!-- Log table -->
  {#if entries.length === 0}
    <p class="py-4 text-sm text-white/30">No scheduled sync runs recorded yet.</p>
  {:else}
    <div class="overflow-hidden rounded-xl border border-white/10">
      {#each entries as entry (entry.id)}
        <div
          class="border-b border-white/5 px-5 py-3.5 last:border-0
            {entryHasError(entry) ? 'bg-red-500/5' : 'bg-white/5'}"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 space-y-1.5">
              <!-- Header row -->
              <div class="flex items-center gap-2.5">
                <span class="text-sm text-white/70">{formatDateTime(entry.runAt)}</span>
                <span
                  class="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide
                    {entry.type === 'full'
                    ? 'bg-accent/15 text-accent'
                    : 'bg-white/10 text-white/50'}"
                >
                  {entry.type}
                </span>
                <span class="text-xs text-white/30">{formatDuration(entry.durationMs)}</span>
              </div>

              <!-- Per-library results -->
              <div class="flex flex-wrap gap-x-5 gap-y-0.5">
                {#each entry.results as r (r.slug)}
                  <span class="text-xs {r.error ? 'text-red-400' : 'text-white/40'}">
                    {r.label}:
                    {#if r.error}
                      {r.error}
                    {:else}
                      {r.synced} items
                    {/if}
                  </span>
                {/each}
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
