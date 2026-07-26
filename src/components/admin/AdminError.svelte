<script lang="ts">
  let { error }: { error: string | null } = $props();
</script>

{#if error}
  <div class="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
    {error}
  </div>
{/if}
