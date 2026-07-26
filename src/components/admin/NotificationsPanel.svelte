<script lang="ts">
  import { untrack } from 'svelte';
  import { toErrorMessage } from '../../lib/response';
  import AdminError from './AdminError.svelte';
  import AdminSaveButton from './AdminSaveButton.svelte';

  type Settings = {
    site_url: string;
    webhook_url: string;
    webhook_type: string;
    webhook_username: string;
    webhook_avatar_url: string;
    webhook_notification_types: string;
  };

  let { settings: initial }: { settings: Settings } = $props();

  let siteUrl: string = $state(untrack(() => initial.site_url));
  let webhookUrl: string = $state(untrack(() => initial.webhook_url));
  let webhookType: string = $state(untrack(() => initial.webhook_type));
  let webhookUsername: string = $state(untrack(() => initial.webhook_username));
  let webhookAvatarUrl: string = $state(untrack(() => initial.webhook_avatar_url));

  const ALL_NOTIFICATION_TYPES = [
    {
      value: 'tagged',
      label: 'Item Tagged Leaving Soon',
      description: 'Send a notification when an admin tags an item as leaving soon.',
    },
    {
      value: 'untagged',
      label: 'Item Removed from Leaving Soon',
      description: 'Send a notification when an admin removes the leaving-soon tag from an item.',
    },
    {
      value: 'keep_requested',
      label: 'Keep Request',
      description: 'Send a notification when a user requests that an item be kept.',
    },
    {
      value: 'nominated',
      label: 'Nominated for Leaving Soon',
      description: 'Send a notification when a user nominates an item for leaving soon.',
    },
  ] as const;
  let enabledNotificationTypes: Set<string> = $state(
    untrack(
      () =>
        new Set(
          initial.webhook_notification_types
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        ),
    ),
  );

  let testingWebhook: boolean = $state(false);
  let testResult: { ok: boolean; message: string } | null = $state(null);
  let saving: boolean = $state(false);
  let saved: boolean = $state(false);
  let error: string | null = $state(null);

  async function testWebhook() {
    testingWebhook = true;
    testResult = null;
    try {
      const resp = await fetch('/api/admin/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhook_url: webhookUrl, webhook_type: webhookType }),
      });
      const data = await resp.json();
      testResult = resp.ok
        ? { ok: true, message: 'Test notification sent.' }
        : { ok: false, message: data.error ?? 'Test failed.' };
    } catch {
      testResult = { ok: false, message: 'Request failed.' };
    } finally {
      testingWebhook = false;
    }
  }

  async function save() {
    saving = true;
    saved = false;
    error = null;
    try {
      const resp = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site_url: siteUrl,
          webhook_url: webhookUrl,
          webhook_type: webhookType,
          webhook_username: webhookUsername,
          webhook_avatar_url: webhookAvatarUrl,
          webhook_notification_types: [...enabledNotificationTypes],
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? 'Failed to save');
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

<div class="space-y-6">
  <AdminError {error} />

  <div class="rounded-xl border border-white/10 p-5 space-y-5">
    <div>
      <label class="block text-sm font-medium text-white/80" for="site-url">Site URL</label>
      <p class="mt-1 text-xs text-white/40">
        The externally reachable base URL of this Tideline instance (e.g. <code
          class="rounded bg-white/10 px-1">https://tideline.example.com</code
        >). Used to include a link to the nominations page in webhook notifications. Leave empty to
        omit the link.
      </p>
      <input
        id="site-url"
        type="url"
        placeholder="https://tideline.example.com"
        class="mt-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/25 focus:border-accent focus:outline-none"
        bind:value={siteUrl}
      />
    </div>

    <div class="border-t border-white/10 pt-5">
      <label class="block text-sm font-medium text-white/80" for="webhook-url">Webhook URL</label>
      <p class="mt-1 text-xs text-white/40">
        POST notifications to this URL when items are tagged leaving-soon or a keep request is
        received. Leave empty to disable.
      </p>
      <input
        id="webhook-url"
        type="url"
        placeholder="https://…"
        class="mt-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/25 focus:border-accent focus:outline-none"
        bind:value={webhookUrl}
      />
    </div>

    <div class="grid grid-cols-2 gap-4 items-end">
      <div>
        <label class="block text-xs font-medium text-white/60" for="webhook-type"
          >Service type</label
        >
        <select
          id="webhook-type"
          class="mt-1.5 w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
          bind:value={webhookType}
        >
          <option value="discord">Discord</option>
          <option value="slack">Slack</option>
          <option value="ntfy">Ntfy</option>
          <option value="gotify">Gotify</option>
          <option value="generic">Generic JSON</option>
        </select>
      </div>

      <div class="flex flex-col gap-1.5">
        <button
          type="button"
          onclick={testWebhook}
          disabled={testingWebhook || !webhookUrl}
          class="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {testingWebhook ? 'Sending…' : 'Send test'}
        </button>
        {#if testResult}
          <p class="text-xs {testResult.ok ? 'text-green-400' : 'text-red-400'}">
            {testResult.message}
          </p>
        {/if}
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4 border-t border-white/10 pt-5">
      <div>
        <label class="block text-xs font-medium text-white/60" for="webhook-username"
          >Bot username</label
        >
        <p class="mt-1 text-xs text-white/30">
          Overrides the default webhook display name. Leave empty to use the webhook default.
        </p>
        <input
          id="webhook-username"
          type="text"
          placeholder="Tideline"
          maxlength="80"
          class="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/25 focus:border-accent focus:outline-none"
          bind:value={webhookUsername}
        />
      </div>
      <div>
        <label class="block text-xs font-medium text-white/60" for="webhook-avatar"
          >Bot avatar URL</label
        >
        <p class="mt-1 text-xs text-white/30">
          URL of an image to use as the bot avatar. Leave empty to use the webhook default.
        </p>
        <input
          id="webhook-avatar"
          type="url"
          placeholder="https://…"
          class="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/25 focus:border-accent focus:outline-none"
          bind:value={webhookAvatarUrl}
        />
      </div>
    </div>

    <div class="border-t border-white/10 pt-5">
      <p class="text-xs font-medium text-white/60">Notification types</p>
      <p class="mt-1 text-xs text-white/30">Choose which events trigger a notification.</p>
      <div class="mt-3 space-y-3">
        {#each ALL_NOTIFICATION_TYPES as nt (nt.value)}
          <label class="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              class="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-white/20 bg-white/5 text-accent focus:ring-accent"
              checked={enabledNotificationTypes.has(nt.value)}
              onchange={(e) => {
                const next = new Set(enabledNotificationTypes);
                if ((e.target as HTMLInputElement).checked) next.add(nt.value);
                else next.delete(nt.value);
                enabledNotificationTypes = next;
              }}
            />
            <span>
              <span class="block text-sm text-white/80">{nt.label}</span>
              <span class="block text-xs text-white/40">{nt.description}</span>
            </span>
          </label>
        {/each}
      </div>
    </div>

    <div class="flex items-center gap-3 border-t border-white/10 pt-4">
      <AdminSaveButton {saving} {saved} onsave={save} />
    </div>
  </div>
</div>
