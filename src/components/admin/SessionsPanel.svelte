<script lang="ts">
  import { untrack } from 'svelte';
  import { formatDateTime } from '../../lib/format';
  import { toErrorMessage } from '../../lib/response';

  type SessionRow = {
    token: string;
    jellyfinId: string;
    userName: string;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: string;
    lastActiveAt: string;
    expiresAt: string;
  };

  let { sessions: initial }: { sessions: SessionRow[] } = $props();

  let sessions: SessionRow[] = $state(untrack(() => initial));
  let revokingToken: string | null = $state(null);
  let error: string | null = $state(null);

  function parseUserAgent(ua: string | null): string {
    if (!ua) return 'Unknown';
    let browser = 'Unknown';
    if (ua.includes('Edg/')) browser = 'Edge';
    else if (ua.includes('Chrome/')) browser = 'Chrome';
    else if (ua.includes('Firefox/')) browser = 'Firefox';
    else if (ua.includes('Safari/')) browser = 'Safari';

    let os = '';
    if (ua.includes('iPhone')) os = 'iPhone';
    else if (ua.includes('iPad')) os = 'iPad';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac OS')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';

    return os ? `${browser} · ${os}` : browser;
  }

  async function revoke(token: string) {
    if (!confirm('Revoke this session?')) return;
    revokingToken = token;
    error = null;
    try {
      const resp = await fetch(`/api/admin/sessions/${token}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? 'Failed to revoke session');
      sessions = sessions.filter((s) => s.token !== token);
    } catch (e: unknown) {
      error = toErrorMessage(e);
    } finally {
      revokingToken = null;
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
    {#if sessions.length === 0}
      <div class="px-6 py-8 text-center text-sm text-white/40">No active sessions.</div>
    {:else}
      <table class="w-full text-sm">
        <thead>
          <tr
            class="border-b border-white/10 bg-white/5 text-left text-xs font-medium uppercase tracking-widest text-white/40"
          >
            <th class="px-4 py-3">User</th>
            <th class="px-4 py-3 hidden lg:table-cell">Client</th>
            <th class="px-4 py-3 hidden md:table-cell">IP</th>
            <th class="px-4 py-3 hidden sm:table-cell">Last active</th>
            <th class="px-4 py-3 w-24"></th>
          </tr>
        </thead>
        <tbody>
          {#each sessions as session (session.token)}
            <tr class="border-b border-white/10 transition-colors hover:bg-white/5 last:border-0">
              <td class="px-4 py-3 font-medium">{session.userName}</td>
              <td class="px-4 py-3 hidden lg:table-cell text-white/60">
                {parseUserAgent(session.userAgent)}
              </td>
              <td class="px-4 py-3 hidden md:table-cell text-white/60 font-mono text-xs">
                {session.ipAddress ?? '—'}
              </td>
              <td class="px-4 py-3 hidden sm:table-cell text-white/60">
                {formatDateTime(session.lastActiveAt)}
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center justify-end">
                  <button
                    onclick={() => revoke(session.token)}
                    disabled={revokingToken === session.token}
                    class="rounded-lg px-2.5 py-1 text-xs text-red-400/70 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {revokingToken === session.token ? 'Revoking…' : 'Revoke'}
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
