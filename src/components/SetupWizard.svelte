<script lang="ts">
  import { toErrorMessage } from '../lib/response';

  let url = $state('');
  let internalUrl = $state('');
  let apiKey = $state('');
  let setupToken = $state('');
  let testing = $state(false);
  let testResult: { ok: boolean; serverName?: string; version?: string; error?: string } | null =
    $state(null);
  let saving = $state(false);
  let error: string | null = $state(null);

  async function testConnection() {
    testing = true;
    testResult = null;
    try {
      const testUrl = internalUrl.trim() || url.trim();
      const resp = await fetch('/api/setup/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: testUrl,
          apiKey: apiKey.trim(),
          setupToken: setupToken.trim(),
        }),
      });
      testResult = await resp.json();
    } catch {
      testResult = { ok: false, error: 'Network error — could not reach the server.' };
    } finally {
      testing = false;
    }
  }

  async function save() {
    error = null;
    saving = true;
    try {
      const resp = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          internalUrl: internalUrl.trim() || null,
          apiKey: apiKey.trim(),
          setupToken: setupToken.trim(),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? 'Failed to save');
      window.location.href = '/login';
    } catch (e: unknown) {
      error = toErrorMessage(e);
    } finally {
      saving = false;
    }
  }

  let formReady = $derived(!!(url.trim() && apiKey.trim() && setupToken.trim()));
</script>

<div class="w-full max-w-lg rounded-2xl border border-white/10 bg-white/5 p-8 space-y-6">
  <div>
    <h1 class="text-xl font-bold tracking-tight">Connect Jellyfin</h1>
    <p class="mt-1 text-sm text-white/40">Configure your Jellyfin server to get started.</p>
  </div>

  {#if error}
    <div class="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      {error}
    </div>
  {/if}

  <div class="space-y-5">
    <div>
      <label class="block text-sm font-medium text-white/80" for="setup-url">Jellyfin URL</label>
      <p class="mt-0.5 text-xs text-white/40">The address your users open in their browser.</p>
      <input
        id="setup-url"
        type="url"
        placeholder="https://jellyfin.example.com"
        class="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
        bind:value={url}
      />
    </div>

    <div>
      <label class="block text-sm font-medium text-white/80" for="setup-internal-url">
        Internal URL <span class="font-normal text-white/30">(optional)</span>
      </label>
      <p class="mt-0.5 text-xs text-white/40">
        Used for server-to-server API calls — e.g. a k8s cluster-local address. Falls back to the
        URL above if not set. The connection test uses this URL if provided.
      </p>
      <input
        id="setup-internal-url"
        type="url"
        placeholder="http://jellyfin.media.svc.cluster.local:8096"
        class="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
        bind:value={internalUrl}
      />
    </div>

    <div>
      <label class="block text-sm font-medium text-white/80" for="setup-api-key">API Key</label>
      <p class="mt-0.5 text-xs text-white/40">Create one in Jellyfin → Dashboard → API Keys.</p>
      <input
        id="setup-api-key"
        type="password"
        autocomplete="off"
        placeholder="••••••••••••••••••••"
        class="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
        bind:value={apiKey}
      />
    </div>

    <div>
      <label class="block text-sm font-medium text-white/80" for="setup-token">Setup Token</label>
      <p class="mt-0.5 text-xs text-white/40">
        Printed to the server log on startup. Required to prevent unauthorised first-run takeover.
      </p>
      <input
        id="setup-token"
        type="text"
        autocomplete="off"
        spellcheck="false"
        placeholder="e.g. a3b4c5d6e7f890123456789abcdef12"
        class="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 font-mono text-sm text-white placeholder-white/30 outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
        bind:value={setupToken}
      />
    </div>
  </div>

  <div class="space-y-2">
    <button
      onclick={testConnection}
      disabled={testing || !formReady}
      class="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
    >
      {testing ? 'Testing…' : 'Test Connection'}
    </button>

    {#if testResult}
      {#if testResult.ok}
        <p class="text-sm text-green-400">
          Connected — {testResult.serverName}{testResult.version ? ` (${testResult.version})` : ''}
        </p>
      {:else}
        <p class="text-sm text-red-400">{testResult.error ?? 'Connection failed'}</p>
      {/if}
    {/if}
  </div>

  <div class="border-t border-white/10 pt-4">
    <button
      onclick={save}
      disabled={saving || !formReady}
      class="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
    >
      {saving ? 'Saving…' : 'Save & Continue →'}
    </button>
  </div>
</div>
