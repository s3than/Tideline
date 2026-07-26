<script lang="ts">
  import { formatDateTime } from '../../lib/format';

  type Props = {
    title: string;
    description: string;
    enabled: boolean;
    intervalHours: number;
    lastRun: string | null;
    nextRun: string | null;
    ontoggle: () => void;
    onpickinterval: (v: number) => void;
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
    title,
    description,
    enabled,
    intervalHours,
    lastRun,
    nextRun,
    ontoggle,
    onpickinterval,
  }: Props = $props();
</script>

<div class="bg-white/5 px-5 py-4">
  <div class="flex items-start justify-between gap-4">
    <div class="min-w-0">
      <p class="text-sm font-medium">{title}</p>
      <p class="mt-0.5 text-xs text-white/40">{description}</p>

      {#if enabled}
        <div class="mt-3 flex flex-wrap gap-1.5">
          {#each INTERVAL_OPTIONS as opt (opt.value)}
            <button
              type="button"
              onclick={() => onpickinterval(opt.value)}
              class="rounded border px-2.5 py-1 text-xs transition-colors
                {intervalHours === opt.value
                ? 'border-accent bg-accent/10 text-white'
                : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white'}"
              >{opt.label}</button
            >
          {/each}
        </div>
      {/if}

      {#if enabled && (lastRun || nextRun)}
        <div class="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-white/40">
          {#if lastRun}
            <span>Last run: <span class="text-white/60">{formatDateTime(lastRun)}</span></span>
          {/if}
          {#if nextRun}
            <span>Next: <span class="text-white/60">{formatDateTime(nextRun)}</span></span>
          {/if}
        </div>
      {/if}
    </div>

    <button
      onclick={ontoggle}
      aria-pressed={enabled}
      aria-label="{enabled ? 'Disable' : 'Enable'} {title}"
      class="relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none
        {enabled ? 'bg-accent' : 'bg-white/20'}"
    >
      <span
        class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
          {enabled ? 'translate-x-5' : 'translate-x-0'}"
      ></span>
    </button>
  </div>
</div>
