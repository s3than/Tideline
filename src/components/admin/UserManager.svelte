<script lang="ts">
  import { untrack } from 'svelte';
  import { formatDateTime } from '../../lib/format';
  import { toErrorMessage } from '../../lib/response';

  type UserWithSessions = {
    jellyfinId: string;
    name: string;
    isAdministrator: boolean;
    lastSeen: string;
    activeSessions: number;
  };

  let { users: initial }: { users: UserWithSessions[] } = $props();

  let users: UserWithSessions[] = $state(untrack(() => initial));
  let evictingId: string | null = $state(null);
  let error: string | null = $state(null);

  async function evictSessions(user: UserWithSessions) {
    if (!confirm(`Sign "${user.name}" out of all sessions?`)) return;
    evictingId = user.jellyfinId;
    error = null;
    try {
      const resp = await fetch(`/api/admin/users/${user.jellyfinId}/sessions`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? 'Failed to evict sessions');
      users = users.map((u) =>
        u.jellyfinId === user.jellyfinId ? { ...u, activeSessions: 0 } : u,
      );
    } catch (e: unknown) {
      error = toErrorMessage(e);
    } finally {
      evictingId = null;
    }
  }
</script>

<div class="space-y-4">
  {#if error}
    <div class="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      {error}
    </div>
  {/if}

  <div class="overflow-hidden rounded-xl border border-white/10">
    {#if users.length === 0}
      <div class="px-6 py-8 text-center text-sm text-white/40">No users have signed in yet.</div>
    {:else}
      <table class="w-full text-sm">
        <thead>
          <tr
            class="border-b border-white/10 bg-white/5 text-left text-xs font-medium uppercase tracking-widest text-white/40"
          >
            <th class="px-4 py-3">Name</th>
            <th class="px-4 py-3 hidden md:table-cell">Last seen</th>
            <th class="px-4 py-3 hidden sm:table-cell">Sessions</th>
            <th class="px-4 py-3 w-36"></th>
          </tr>
        </thead>
        <tbody>
          {#each users as user (user.jellyfinId)}
            <tr class="border-b border-white/10 transition-colors hover:bg-white/5 last:border-0">
              <td class="px-4 py-3 font-medium">
                {user.name}
                {#if user.isAdministrator}
                  <span
                    class="ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-accent/20 text-accent"
                  >
                    Admin
                  </span>
                {/if}
              </td>
              <td class="px-4 py-3 hidden md:table-cell text-white/60"
                >{formatDateTime(user.lastSeen)}</td
              >
              <td class="px-4 py-3 hidden sm:table-cell text-white/60">{user.activeSessions}</td>
              <td class="px-4 py-3">
                <div class="flex items-center justify-end">
                  <button
                    onclick={() => evictSessions(user)}
                    disabled={evictingId === user.jellyfinId || user.activeSessions === 0}
                    class="rounded-lg px-2.5 py-1 text-xs text-red-400/70 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {evictingId === user.jellyfinId ? 'Signing out…' : 'Evict sessions'}
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</div>
