<script lang="ts">
  import { untrack } from 'svelte';
  import { toErrorMessage } from '../../lib/response';
  import AdminError from './AdminError.svelte';

  type EnvLocked = {
    externalUrl: boolean;
    internalUrl: boolean;
    apiKey: boolean;
  };

  type Props = {
    externalUrl: string;
    internalUrl: string;
    hasApiKey: boolean;
    envLocked: EnvLocked;
  };

  let {
    externalUrl: initialExternalUrl,
    internalUrl: initialInternalUrl,
    hasApiKey: initialHasApiKey,
    envLocked,
  }: Props = $props();

  let externalUrl: string = $state(untrack(() => initialExternalUrl));
  let internalUrl: string = $state(untrack(() => initialInternalUrl));
  let apiKey: string = $state('');
  let hasApiKey: boolean = $state(untrack(() => initialHasApiKey));
  let saving: boolean = $state(false);
  let error: string | null = $state(null);
  let connectedTo: string | null = $state(null);

  const anyEditable = $derived(
    !envLocked.externalUrl || !envLocked.internalUrl || !envLocked.apiKey,
  );

  async function save() {
    saving = true;
    error = null;
    connectedTo = null;
    try {
      const body: Record<string, string> = {};
      if (!envLocked.externalUrl) body.externalUrl = externalUrl;
      if (!envLocked.internalUrl) body.internalUrl = internalUrl;
      if (!envLocked.apiKey && apiKey) body.apiKey = apiKey;

      const resp = await fetch('/api/admin/jellyfin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? 'Failed to save');

      if (apiKey) {
        hasApiKey = true;
        apiKey = '';
      }
      connectedTo = data.serverName ?? 'Jellyfin';
      setTimeout(() => {
        connectedTo = null;
      }, 4000);
    } catch (e: unknown) {
      error = toErrorMessage(e);
    } finally {
      saving = false;
    }
  }
</script>

<div class="rounded-xl border border-white/10 p-5 space-y-5">
  <AdminError {error} />

  {#if connectedTo}
    <div
      class="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300"
    >
      Connected to {connectedTo}
    </div>
  {/if}

  <div class="space-y-5">
    <!-- External URL -->
    <div>
      <label class="block text-sm font-medium text-white/80" for="jellyfin-url">
        Jellyfin URL
      </label>
      <p class="mt-1 text-xs text-white/40">The public-facing URL used for browser links.</p>
      {#if envLocked.externalUrl}
        <p class="mt-2 font-mono text-sm text-white/60 break-all">{externalUrl || '—'}</p>
        <p class="mt-1 text-xs text-white/30">
          Set via <code class="rounded bg-white/10 px-1">JELLYFIN_URL</code> environment variable
        </p>
      {:else}
        <input
          id="jellyfin-url"
          type="url"
          bind:value={externalUrl}
          placeholder="https://jellyfin.example.com"
          class="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-accent focus:outline-none"
        />
      {/if}
    </div>

    <!-- Internal URL -->
    <div class="border-t border-white/10 pt-4">
      <label class="block text-sm font-medium text-white/80" for="jellyfin-internal-url">
        Internal URL <span class="font-normal text-white/30">(optional)</span>
      </label>
      <p class="mt-1 text-xs text-white/40">
        Server-side requests use this URL. Leave blank to use the Jellyfin URL above.
      </p>
      {#if envLocked.internalUrl}
        <p class="mt-2 font-mono text-sm text-white/60 break-all">{internalUrl || '—'}</p>
        <p class="mt-1 text-xs text-white/30">
          Set via <code class="rounded bg-white/10 px-1">JELLYFIN_INTERNAL_URL</code> environment variable
        </p>
      {:else}
        <input
          id="jellyfin-internal-url"
          type="url"
          bind:value={internalUrl}
          placeholder="http://jellyfin.internal:8096"
          class="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-accent focus:outline-none"
        />
      {/if}
    </div>

    <!-- API Key -->
    <div class="border-t border-white/10 pt-4">
      <label class="block text-sm font-medium text-white/80" for="jellyfin-api-key">
        API Key
      </label>
      {#if envLocked.apiKey}
        <p class="mt-1 text-xs text-white/40">
          Set via <code class="rounded bg-white/10 px-1">JELLYFIN_API_KEY</code> environment variable
        </p>
      {:else}
        <p class="mt-1 text-xs text-white/40">
          {hasApiKey ? 'Leave blank to keep the existing key.' : 'No API key is configured.'}
        </p>
        <input
          id="jellyfin-api-key"
          type="password"
          bind:value={apiKey}
          placeholder={hasApiKey ? '••••••••' : 'Enter API key'}
          autocomplete="off"
          class="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-accent focus:outline-none"
        />
      {/if}
    </div>
  </div>

  {#if anyEditable}
    <div class="flex items-center gap-3 border-t border-white/10 pt-4">
      <button
        type="button"
        onclick={save}
        disabled={saving}
        class="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {saving ? 'Verifying…' : 'Verify & Save'}
      </button>
      <span class="text-xs text-white/30">Connection to Jellyfin is verified on save.</span>
    </div>
  {/if}
</div>
