<script lang="ts">
  import { untrack } from 'svelte';
  import { toErrorMessage } from '../../lib/response';
  import AdminError from './AdminError.svelte';
  import AdminSaveButton from './AdminSaveButton.svelte';

  type EnvLocked = {
    radarrUrl: boolean;
    radarrInternalUrl: boolean;
    radarrApiKey: boolean;
    sonarrUrl: boolean;
    sonarrInternalUrl: boolean;
    sonarrApiKey: boolean;
  };

  let {
    radarrUrl: initialRadarrUrl,
    radarrInternalUrl: initialRadarrInternalUrl,
    hasRadarrApiKey: initialHasRadarrApiKey,
    sonarrUrl: initialSonarrUrl,
    sonarrInternalUrl: initialSonarrInternalUrl,
    hassonarrApiKey: initialHasSonarrApiKey,
    envLocked,
  }: {
    radarrUrl: string;
    radarrInternalUrl: string;
    hasRadarrApiKey: boolean;
    sonarrUrl: string;
    sonarrInternalUrl: string;
    hassonarrApiKey: boolean;
    envLocked: EnvLocked;
  } = $props();

  let radarrUrl: string = $state(untrack(() => initialRadarrUrl));
  let radarrInternalUrl: string = $state(untrack(() => initialRadarrInternalUrl));
  let radarrApiKey: string = $state('');
  let hasRadarrApiKey: boolean = $state(untrack(() => initialHasRadarrApiKey));

  let sonarrUrl: string = $state(untrack(() => initialSonarrUrl));
  let sonarrInternalUrl: string = $state(untrack(() => initialSonarrInternalUrl));
  let sonarrApiKey: string = $state('');
  let hasSonarrApiKey: boolean = $state(untrack(() => initialHasSonarrApiKey));

  let saving: boolean = $state(false);
  let saved: boolean = $state(false);
  let error: string | null = $state(null);

  async function save() {
    saving = true;
    saved = false;
    error = null;
    try {
      const body: Record<string, string> = {};
      if (!envLocked.radarrUrl) body.radarrUrl = radarrUrl;
      if (!envLocked.radarrInternalUrl) body.radarrInternalUrl = radarrInternalUrl;
      if (!envLocked.radarrApiKey && radarrApiKey) body.radarrApiKey = radarrApiKey;
      if (!envLocked.sonarrUrl) body.sonarrUrl = sonarrUrl;
      if (!envLocked.sonarrInternalUrl) body.sonarrInternalUrl = sonarrInternalUrl;
      if (!envLocked.sonarrApiKey && sonarrApiKey) body.sonarrApiKey = sonarrApiKey;

      const resp = await fetch('/api/admin/arr-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? 'Failed to save');

      if (radarrApiKey) {
        hasRadarrApiKey = true;
        radarrApiKey = '';
      }
      if (sonarrApiKey) {
        hasSonarrApiKey = true;
        sonarrApiKey = '';
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

<div class="rounded-xl border border-white/10 p-5 space-y-6">
  <AdminError {error} />

  <!-- Radarr -->
  <div class="space-y-4">
    <h3 class="text-sm font-semibold text-white/70 uppercase tracking-widest">Radarr</h3>

    <div>
      <label class="block text-sm font-medium text-white/80" for="radarr-url">URL</label>
      <p class="mt-1 text-xs text-white/40">Public-facing URL — used for browser links.</p>
      {#if envLocked.radarrUrl}
        <p class="mt-2 font-mono text-sm text-white/60 break-all">{radarrUrl || '—'}</p>
        <p class="mt-1 text-xs text-white/30">
          Set via <code class="rounded bg-white/10 px-1">RADARR_URL</code> environment variable
        </p>
      {:else}
        <input
          id="radarr-url"
          type="url"
          bind:value={radarrUrl}
          placeholder="http://radarr:7878"
          class="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-accent focus:outline-none"
        />
      {/if}
    </div>

    <div>
      <label class="block text-sm font-medium text-white/80" for="radarr-internal-url">
        Internal URL <span class="font-normal text-white/30">(optional)</span>
      </label>
      <p class="mt-1 text-xs text-white/40">
        Server-side API calls use this URL. Leave blank to use the URL above.
      </p>
      {#if envLocked.radarrInternalUrl}
        <p class="mt-2 font-mono text-sm text-white/60 break-all">{radarrInternalUrl || '—'}</p>
        <p class="mt-1 text-xs text-white/30">
          Set via <code class="rounded bg-white/10 px-1">RADARR_INTERNAL_URL</code> environment variable
        </p>
      {:else}
        <input
          id="radarr-internal-url"
          type="url"
          bind:value={radarrInternalUrl}
          placeholder="http://radarr.internal:7878"
          class="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-accent focus:outline-none"
        />
      {/if}
    </div>

    <div>
      <label class="block text-sm font-medium text-white/80" for="radarr-api-key">API Key</label>
      {#if envLocked.radarrApiKey}
        <p class="mt-1 text-xs text-white/40">
          Set via <code class="rounded bg-white/10 px-1">RADARR_API_KEY</code> environment variable
        </p>
      {:else}
        <p class="mt-1 text-xs text-white/40">
          {hasRadarrApiKey ? 'Leave blank to keep the existing key.' : 'No API key configured.'}
        </p>
        <input
          id="radarr-api-key"
          type="password"
          bind:value={radarrApiKey}
          placeholder={hasRadarrApiKey ? '••••••••' : 'Enter API key'}
          autocomplete="off"
          class="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-accent focus:outline-none"
        />
      {/if}
    </div>
  </div>

  <div class="border-t border-white/10" />

  <!-- Sonarr -->
  <div class="space-y-4">
    <h3 class="text-sm font-semibold text-white/70 uppercase tracking-widest">Sonarr</h3>

    <div>
      <label class="block text-sm font-medium text-white/80" for="sonarr-url">URL</label>
      <p class="mt-1 text-xs text-white/40">Public-facing URL — used for browser links.</p>
      {#if envLocked.sonarrUrl}
        <p class="mt-2 font-mono text-sm text-white/60 break-all">{sonarrUrl || '—'}</p>
        <p class="mt-1 text-xs text-white/30">
          Set via <code class="rounded bg-white/10 px-1">SONARR_URL</code> environment variable
        </p>
      {:else}
        <input
          id="sonarr-url"
          type="url"
          bind:value={sonarrUrl}
          placeholder="http://sonarr:8989"
          class="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-accent focus:outline-none"
        />
      {/if}
    </div>

    <div>
      <label class="block text-sm font-medium text-white/80" for="sonarr-internal-url">
        Internal URL <span class="font-normal text-white/30">(optional)</span>
      </label>
      <p class="mt-1 text-xs text-white/40">
        Server-side API calls use this URL. Leave blank to use the URL above.
      </p>
      {#if envLocked.sonarrInternalUrl}
        <p class="mt-2 font-mono text-sm text-white/60 break-all">{sonarrInternalUrl || '—'}</p>
        <p class="mt-1 text-xs text-white/30">
          Set via <code class="rounded bg-white/10 px-1">SONARR_INTERNAL_URL</code> environment variable
        </p>
      {:else}
        <input
          id="sonarr-internal-url"
          type="url"
          bind:value={sonarrInternalUrl}
          placeholder="http://sonarr.internal:8989"
          class="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-accent focus:outline-none"
        />
      {/if}
    </div>

    <div>
      <label class="block text-sm font-medium text-white/80" for="sonarr-api-key">API Key</label>
      {#if envLocked.sonarrApiKey}
        <p class="mt-1 text-xs text-white/40">
          Set via <code class="rounded bg-white/10 px-1">SONARR_API_KEY</code> environment variable
        </p>
      {:else}
        <p class="mt-1 text-xs text-white/40">
          {hasSonarrApiKey ? 'Leave blank to keep the existing key.' : 'No API key configured.'}
        </p>
        <input
          id="sonarr-api-key"
          type="password"
          bind:value={sonarrApiKey}
          placeholder={hasSonarrApiKey ? '••••••••' : 'Enter API key'}
          autocomplete="off"
          class="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-accent focus:outline-none"
        />
      {/if}
    </div>
  </div>

  <div class="flex items-center gap-3 border-t border-white/10 pt-4">
    <AdminSaveButton {saving} {saved} onsave={save} />
    <span class="text-xs text-white/30"
      >Connection is verified on save when URL and key are provided.</span
    >
  </div>
</div>
