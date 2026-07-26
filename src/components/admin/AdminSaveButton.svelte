<script lang="ts">
  type Props = {
    saving: boolean;
    saved?: boolean;
    label?: string;
    disabled?: boolean;
    onsave: () => void;
  };

  let { saving, saved = false, label = 'Save', disabled = false, onsave }: Props = $props();
</script>

<button
  type="button"
  onclick={onsave}
  disabled={saving || disabled}
  class="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
>
  {saving ? 'Saving…' : label}
</button>
{#if saved}
  <span class="text-sm text-green-400">Saved</span>
{/if}
