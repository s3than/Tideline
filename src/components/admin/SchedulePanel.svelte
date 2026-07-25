<script lang="ts">
  import { untrack } from 'svelte';
  import { formatDateTime } from '../../lib/format';
  import { toErrorMessage } from '../../lib/response';

  type Props = {
    scheduleEnabled: boolean;
    intervalHours: number;
    lastSync: string | null;
    nextSync: string | null;
  };

  const INTERVAL_OPTIONS = [
    { label: '1h', value: 1 },
    { label: '3h', value: 3 },
    { label: '6h', value: 6 },
    { label: '12h', value: 12 },
    { label: '24h', value: 24 },
    { label: '48h', value: 48 },
    { label: '1w', value: 168 },
  ];

  let {
    scheduleEnabled: initialEnabled,
    intervalHours: initialHours,
    lastSync: initialLast,
    nextSync: initialNext,
  }: Props = $props();

  let scheduleEnabled: boolean = $state(untrack(() => initialEnabled));
  let intervalHours: number = $state(untrack(() => initialHours));
  let lastSync: string | null = $state(untrack(() => initialLast));
  let nextSync: string | null = $state(untrack(() => initialNext));
  let saving: boolean = $state(false);
  let saved: boolean = $state(false);
  let error: string | null = $state(null);

  async function save() {
    saving = true;
    saved = false;
    error = null;
    try {
      const resp = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sync_schedule_enabled: scheduleEnabled ? '1' : '0',
          sync_interval_hours: intervalHours,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? 'Failed to save');

      const statusResp = await fetch('/api/admin/settings');
      if (statusResp.ok) {
        const { scheduleStatus } = await statusResp.json();
        lastSync = scheduleStatus.lastSync;
        nextSync = scheduleStatus.nextSync;
      }

      saved = true;
      setTimeout(() => {
        saved = false;
      }, 2000);
    } catch (e: unknown) {
      error = toErrorMessage(e);
    } finally {
      saving = false;
    }
  }
</script>

<div class="space-y-3">
  {#if error}
    <div class="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      {error}
    </div>
  {/if}

  <!-- Task list -->
  <div class="overflow-hidden rounded-xl border border-white/10">
    <!-- Sync Media task -->
    <div class="bg-white/5 px-5 py-4">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <p class="text-sm font-medium">Sync Media</p>
          <p class="mt-0.5 text-xs text-white/40">
            Syncs all non-proxy libraries from Jellyfin into the local database.
          </p>

          {#if scheduleEnabled}
            <div class="mt-3 flex flex-wrap gap-1.5">
              {#each INTERVAL_OPTIONS as opt (opt.value)}
                <button
                  type="button"
                  onclick={() => {
                    intervalHours = opt.value;
                  }}
                  class="rounded border px-2.5 py-1 text-xs transition-colors
                    {intervalHours === opt.value
                    ? 'border-accent bg-accent/10 text-white'
                    : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white'}"
                  >{opt.label}</button
                >
              {/each}
            </div>
          {/if}

          {#if scheduleEnabled && (lastSync || nextSync)}
            <div class="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-white/40">
              {#if lastSync}
                <span>Last run: <span class="text-white/60">{formatDateTime(lastSync)}</span></span>
              {/if}
              {#if nextSync}
                <span>Next: <span class="text-white/60">{formatDateTime(nextSync)}</span></span>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Toggle -->
        <button
          onclick={() => {
            scheduleEnabled = !scheduleEnabled;
          }}
          aria-pressed={scheduleEnabled}
          class="relative mt-0.5 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none
            {scheduleEnabled ? 'bg-accent' : 'bg-white/20'}"
        >
          <span
            class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
              {scheduleEnabled ? 'translate-x-5' : 'translate-x-0'}"
          ></span>
        </button>
      </div>
    </div>
  </div>

  <div class="flex items-center gap-3">
    <button
      onclick={save}
      disabled={saving}
      class="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
    >
      {saving ? 'Saving…' : 'Save'}
    </button>
    {#if saved}
      <span class="text-sm text-green-400">Saved</span>
    {/if}
  </div>
</div>
