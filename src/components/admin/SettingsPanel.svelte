<script lang="ts">
  import { untrack } from 'svelte';
  import { toErrorMessage } from '../../lib/response';

  type RateLimitSource = 'client_address' | 'x_forwarded_for' | 'disabled';

  type Settings = {
    leaving_soon_days_fallback: string;
    max_sessions_per_user: string;
    login_rate_limit_source: string;
    rate_limit_max_attempts: string;
    rate_limit_window_minutes: string;
    rate_limit_lockout_minutes: string;
  };

  type EnvLocked = {
    rate_limit_max_attempts: boolean;
    rate_limit_window_minutes: boolean;
    rate_limit_lockout_minutes: boolean;
  };

  const RATE_LIMIT_OPTIONS: Array<{
    value: RateLimitSource;
    label: string;
    description: string;
    warning?: string;
  }> = [
    {
      value: 'client_address',
      label: 'Connecting socket address',
      description:
        'Default. Uses the raw TCP connection address — correct when this app is reachable directly, with nothing in front of it.',
      warning: `If this app sits behind a reverse proxy, every request will appear to come from the proxy's own IP, not the real visitor — one user mistyping their password could lock out everyone behind it.`,
    },
    {
      value: 'x_forwarded_for',
      label: 'X-Forwarded-For header',
      description:
        'Uses the client IP reported by a reverse proxy — the last X-Forwarded-For entry, i.e. the one appended by the proxy closest to this app.',
      warning: `Only safe if every request genuinely passes through your reverse proxy. If the app is also reachable directly, a client can send its own X-Forwarded-For header to dodge the lockout entirely or frame another IP.`,
    },
    {
      value: 'disabled',
      label: 'Disabled',
      description: 'No brute-force protection on the login endpoint.',
      warning:
        'Anyone can attempt unlimited password guesses against your Jellyfin accounts through this app.',
    },
  ];

  let {
    settings: initial,
    envLocked = {
      rate_limit_max_attempts: false,
      rate_limit_window_minutes: false,
      rate_limit_lockout_minutes: false,
    },
  }: { settings: Settings; envLocked?: EnvLocked } = $props();

  let daysFallback: number = $state(
    untrack(() => parseInt(initial.leaving_soon_days_fallback, 10)),
  );
  let maxSessionsPerUser: number = $state(
    untrack(() => parseInt(initial.max_sessions_per_user, 10)),
  );
  let rateLimitSource: RateLimitSource = $state(
    untrack(() => initial.login_rate_limit_source as RateLimitSource),
  );
  let rateLimitMaxAttempts: number = $state(
    untrack(() => parseInt(initial.rate_limit_max_attempts, 10)),
  );
  let rateLimitWindowMinutes: number = $state(
    untrack(() => parseInt(initial.rate_limit_window_minutes, 10)),
  );
  let rateLimitLockoutMinutes: number = $state(
    untrack(() => parseInt(initial.rate_limit_lockout_minutes, 10)),
  );
  let selectedRateLimitOption = $derived(
    RATE_LIMIT_OPTIONS.find((o) => o.value === rateLimitSource),
  );

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
          leaving_soon_days_fallback: daysFallback,
          max_sessions_per_user: maxSessionsPerUser,
          login_rate_limit_source: rateLimitSource,
          rate_limit_max_attempts: rateLimitMaxAttempts,
          rate_limit_window_minutes: rateLimitWindowMinutes,
          rate_limit_lockout_minutes: rateLimitLockoutMinutes,
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
  {#if error}
    <div class="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      {error}
    </div>
  {/if}

  <div class="rounded-xl border border-white/10 p-5 space-y-5">
    <div class="max-w-xs">
      <label class="block text-sm font-medium text-white/80" for="days-fallback">
        Default days (no <code class="rounded bg-white/10 px-1 text-xs">lv-N</code> tag)
      </label>
      <p class="mt-1 text-xs text-white/40">
        Used when a leaving-soon item has no <code class="rounded bg-white/10 px-1">lv-N</code> tag to
        specify how many days remain.
      </p>
      <div class="mt-3 flex items-center gap-3">
        <input
          id="days-fallback"
          type="number"
          min="1"
          max="365"
          class="w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
          bind:value={daysFallback}
        />
        <span class="text-sm text-white/40">days</span>
      </div>
    </div>

    <div class="border-t border-white/10 pt-5 max-w-xs">
      <label class="block text-sm font-medium text-white/80" for="max-sessions">
        Max sessions per user
      </label>
      <p class="mt-1 text-xs text-white/40">
        When a user logs in and exceeds this limit, their oldest session is signed out
        automatically.
      </p>
      <div class="mt-3 flex items-center gap-3">
        <input
          id="max-sessions"
          type="number"
          min="1"
          max="20"
          class="w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
          bind:value={maxSessionsPerUser}
        />
        <span class="text-sm text-white/40">sessions</span>
      </div>
    </div>

    <div class="border-t border-white/10 pt-5">
      <label class="block text-sm font-medium text-white/80" for="rate-limit-source">
        Login rate-limit IP source
      </label>
      <p class="mt-1 text-xs text-white/40">
        How to identify a client for login brute-force protection.
      </p>
      <select
        id="rate-limit-source"
        class="mt-3 w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
        bind:value={rateLimitSource}
      >
        {#each RATE_LIMIT_OPTIONS as opt (opt.value)}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>

      {#if selectedRateLimitOption}
        <div class="mt-3 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3">
          <p class="text-xs text-white/50">{selectedRateLimitOption.description}</p>
          {#if selectedRateLimitOption.warning}
            <p class="mt-2 flex items-start gap-1.5 text-xs text-amber-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                class="mt-0.5 h-3.5 w-3.5 flex-shrink-0"
              >
                <path
                  fill-rule="evenodd"
                  d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
                  clip-rule="evenodd"
                />
              </svg>
              <span>{selectedRateLimitOption.warning}</span>
            </p>
          {/if}
        </div>
      {/if}

      {#if rateLimitSource !== 'disabled'}
        <div class="mt-4 grid grid-cols-3 gap-4">
          <div>
            <label class="block text-xs font-medium text-white/60" for="rl-max-attempts"
              >Max attempts</label
            >
            <div class="mt-1.5 flex items-center gap-2">
              <input
                id="rl-max-attempts"
                type="number"
                min="1"
                max="100"
                disabled={envLocked.rate_limit_max_attempts}
                class="w-20 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                bind:value={rateLimitMaxAttempts}
              />
            </div>
            {#if envLocked.rate_limit_max_attempts}
              <p class="mt-1 text-xs text-white/30">Set via env</p>
            {/if}
          </div>
          <div>
            <label class="block text-xs font-medium text-white/60" for="rl-window">Window</label>
            <div class="mt-1.5 flex items-center gap-2">
              <input
                id="rl-window"
                type="number"
                min="1"
                max="1440"
                disabled={envLocked.rate_limit_window_minutes}
                class="w-20 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                bind:value={rateLimitWindowMinutes}
              />
              <span class="text-xs text-white/40">min</span>
            </div>
            {#if envLocked.rate_limit_window_minutes}
              <p class="mt-1 text-xs text-white/30">Set via env</p>
            {/if}
          </div>
          <div>
            <label class="block text-xs font-medium text-white/60" for="rl-lockout">Lockout</label>
            <div class="mt-1.5 flex items-center gap-2">
              <input
                id="rl-lockout"
                type="number"
                min="1"
                max="1440"
                disabled={envLocked.rate_limit_lockout_minutes}
                class="w-20 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                bind:value={rateLimitLockoutMinutes}
              />
              <span class="text-xs text-white/40">min</span>
            </div>
            {#if envLocked.rate_limit_lockout_minutes}
              <p class="mt-1 text-xs text-white/30">Set via env</p>
            {/if}
          </div>
        </div>
      {/if}
    </div>

    <div class="flex items-center gap-3 border-t border-white/10 pt-4">
      <button
        onclick={save}
        disabled={saving}
        class="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save Settings'}
      </button>
      {#if saved}
        <span class="text-sm text-green-400">Saved</span>
      {/if}
    </div>
  </div>
</div>
