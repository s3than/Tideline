<script lang="ts">
  import { untrack } from 'svelte';
  import { toErrorMessage } from '../../lib/response';
  import AdminError from './AdminError.svelte';
  import AdminSaveButton from './AdminSaveButton.svelte';

  let { maxSessions: initial }: { maxSessions: number } = $props();

  let maxSessions: number = $state(untrack(() => initial));
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
        body: JSON.stringify({ max_sessions_per_user: maxSessions }),
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

<div class="rounded-xl border border-white/10 p-5 space-y-5">
  <AdminError {error} />

  <div class="max-w-xs">
    <label class="block text-sm font-medium text-white/80" for="max-sessions">
      Max sessions per user
    </label>
    <p class="mt-1 text-xs text-white/40">
      When a user logs in and exceeds this limit, their oldest session is signed out automatically.
    </p>
    <div class="mt-3 flex items-center gap-3">
      <input
        id="max-sessions"
        type="number"
        min="1"
        max="20"
        class="w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
        bind:value={maxSessions}
      />
      <span class="text-sm text-white/40">sessions</span>
    </div>
  </div>

  <div class="flex items-center gap-3 border-t border-white/10 pt-4">
    <AdminSaveButton {saving} {saved} onsave={save} />
  </div>
</div>
