<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { LibraryRow as Library } from '../../lib/db';
  import type { Library as JellyfinLibrary } from '../../lib/jellyfin';
  import { toErrorMessage } from '../../lib/response';
  import AdminError from './AdminError.svelte';

  type FormData = {
    label: string;
    jellyfinName: string;
    itemType: 'Movie' | 'Series' | 'Collection';
    displayOrder: number;
    viewInMenu: boolean;
    viewLeavingSoon: boolean;
    isProxy: boolean;
  };

  let {
    libraries: initial,
    syncEnabled: initialSyncEnabled,
  }: { libraries: Library[]; syncEnabled: boolean } = $props();

  let syncEnabled: boolean = $state(untrack(() => initialSyncEnabled));
  let libraries: Library[] = $state(untrack(() => initial));
  let adding: boolean = $state(false);
  let editingSlug: string | null = $state(null);
  let saving: boolean = $state(false);
  let error: string | null = $state(null);

  // Jellyfin library picker state
  let jellyfinLibraries: JellyfinLibrary[] = $state([]);
  let loadingJellyfin: boolean = $state(false);
  let jellyfinError: string | null = $state(null);

  const emptyForm = (): FormData => ({
    label: '',
    jellyfinName: '',
    itemType: 'Movie',
    displayOrder: 0,
    viewInMenu: true,
    viewLeavingSoon: true,
    isProxy: false,
  });
  let form: FormData = $state(emptyForm());
  let editForm: FormData = $state(emptyForm());

  function slugify(s: string) {
    return s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // Other admin islands (SyncPanel) listen for this to refresh their view of
  // the library list after we mutate it.
  function notifyLibrariesChanged() {
    window.dispatchEvent(new CustomEvent('tideline:libraries-changed'));
  }

  function collectionTypeToItemType(ct: string): 'Movie' | 'Series' | 'Collection' {
    if (ct === 'movies') return 'Movie';
    if (ct === 'boxsets') return 'Collection';
    return 'Series';
  }

  function selectJellyfinLibrary(jlib: JellyfinLibrary) {
    form.jellyfinName = jlib.Name;
    form.itemType = collectionTypeToItemType(jlib.CollectionType);
    if (form.itemType === 'Collection') {
      form.viewLeavingSoon = false;
    }
    if (!form.label) form.label = jlib.Name;
  }

  async function openAdd() {
    adding = true;
    error = null;
    form = emptyForm();
    jellyfinLibraries = [];
    jellyfinError = null;
    loadingJellyfin = true;
    try {
      const resp = await fetch('/api/admin/jellyfin/libraries');
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? 'Failed to load Jellyfin libraries');
      jellyfinLibraries = data.libraries;
    } catch (e: unknown) {
      jellyfinError = toErrorMessage(e);
    } finally {
      loadingJellyfin = false;
    }
  }

  function startEdit(lib: Library) {
    editingSlug = lib.slug;
    editForm = {
      label: lib.label,
      jellyfinName: lib.jellyfinName,
      itemType: lib.itemType,
      displayOrder: lib.displayOrder,
      viewInMenu: lib.viewInMenu,
      viewLeavingSoon: lib.viewLeavingSoon,
      isProxy: lib.isProxy,
    };
    error = null;
  }

  function cancelEdit() {
    editingSlug = null;
    error = null;
  }

  function cancelAdd() {
    adding = false;
    form = emptyForm();
    error = null;
  }

  async function addLibrary() {
    saving = true;
    error = null;
    try {
      const resp = await fetch('/api/admin/libraries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: slugify(form.label),
          label: form.label,
          jellyfinName: form.jellyfinName,
          itemType: form.itemType,
          displayOrder: form.displayOrder,
          viewInMenu: form.viewInMenu,
          viewLeavingSoon: form.viewLeavingSoon,
          isProxy: form.isProxy,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? 'Failed to create library');
      libraries = [...libraries, data.library];
      notifyLibrariesChanged();
      openAdd();
    } catch (e: unknown) {
      error = toErrorMessage(e);
    } finally {
      saving = false;
    }
  }

  async function saveEdit(slug: string) {
    saving = true;
    error = null;
    try {
      const resp = await fetch(`/api/admin/libraries/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          isProxy: editForm.isProxy,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? 'Failed to save');
      libraries = libraries.map((l) => (l.slug === slug ? { ...l, ...editForm } : l));
      notifyLibrariesChanged();
      editingSlug = null;
    } catch (e: unknown) {
      error = toErrorMessage(e);
    } finally {
      saving = false;
    }
  }

  async function deleteLibrary(slug: string, label: string) {
    const lib = libraries.find((l) => l.slug === slug);
    const warning =
      lib?.itemType !== 'Collection' ? ' This will also remove its picks history.' : '';
    if (!confirm(`Delete "${label}"?${warning}`)) return;
    error = null;
    try {
      const resp = await fetch(`/api/admin/libraries/${slug}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? 'Failed to delete');
      libraries = libraries.filter((l) => l.slug !== slug);
      notifyLibrariesChanged();
    } catch (e: unknown) {
      error = toErrorMessage(e);
    }
  }

  onMount(() => {
    const handler = (e: Event) => {
      syncEnabled = (e as CustomEvent<{ enabled: boolean }>).detail.enabled;
    };
    window.addEventListener('tideline:sync-changed', handler);
    return () => window.removeEventListener('tideline:sync-changed', handler);
  });

  // First run (no libraries configured yet): open the add form immediately
  // instead of requiring an extra click on an empty page.
  if (untrack(() => initial.length === 0)) {
    openAdd();
  }
</script>

<div class="space-y-4">
  <AdminError {error} />

  <!-- Library rows -->
  <div class="overflow-hidden rounded-xl border border-white/10">
    {#if libraries.length === 0}
      <div class="px-6 py-8 text-center text-sm text-white/40">No libraries configured.</div>
    {:else}
      <table class="w-full text-sm">
        <thead>
          <tr
            class="border-b border-white/10 bg-white/5 text-left text-xs font-medium uppercase tracking-widest text-white/40"
          >
            <th class="px-4 py-3">Label</th>
            <th class="px-4 py-3 hidden sm:table-cell">Jellyfin Name</th>
            <th class="px-4 py-3 hidden md:table-cell">Type</th>
            <th class="px-4 py-3 hidden md:table-cell">Order</th>
            <th class="px-4 py-3 w-28"></th>
          </tr>
        </thead>
        <tbody>
          {#each libraries as lib (lib.slug)}
            {#if editingSlug === lib.slug}
              <tr class="border-b border-white/10 bg-white/5">
                <td class="px-4 py-2" colspan="5">
                  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label for="edit-{lib.slug}-label" class="mb-1 block text-xs text-white/50"
                        >Label</label
                      >
                      <input
                        id="edit-{lib.slug}-label"
                        class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-white/30 focus:border-accent focus:outline-none"
                        bind:value={editForm.label}
                        placeholder="Movies"
                      />
                    </div>
                    <div>
                      <label for="edit-{lib.slug}-jellyfin" class="mb-1 block text-xs text-white/50"
                        >Jellyfin Library Name</label
                      >
                      <input
                        id="edit-{lib.slug}-jellyfin"
                        class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-white/30 focus:border-accent focus:outline-none"
                        bind:value={editForm.jellyfinName}
                        placeholder="Movies"
                      />
                    </div>
                    <div>
                      <label for="edit-{lib.slug}-type" class="mb-1 block text-xs text-white/50"
                        >Type</label
                      >
                      <select
                        id="edit-{lib.slug}-type"
                        class="w-full rounded-lg border border-white/10 bg-surface px-3 py-1.5 text-sm text-white focus:border-accent focus:outline-none"
                        bind:value={editForm.itemType}
                      >
                        <option value="Movie">Movie</option>
                        <option value="Series">Series</option>
                        <option value="Collection">Collection</option>
                      </select>
                    </div>
                    <div>
                      <label for="edit-{lib.slug}-order" class="mb-1 block text-xs text-white/50"
                        >Display Order</label
                      >
                      <input
                        id="edit-{lib.slug}-order"
                        type="number"
                        class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-accent focus:outline-none"
                        bind:value={editForm.displayOrder}
                        min="0"
                      />
                    </div>
                  </div>
                  <div class="mt-3 flex flex-wrap gap-6">
                    <label class="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
                      <input
                        type="checkbox"
                        bind:checked={editForm.viewInMenu}
                        class="accent-accent"
                      />
                      View in menu
                    </label>
                    {#if editForm.itemType !== 'Collection'}
                      <label class="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
                        <input
                          type="checkbox"
                          bind:checked={editForm.viewLeavingSoon}
                          disabled={editForm.isProxy}
                          class="accent-accent disabled:opacity-40"
                        />
                        View leaving soon
                      </label>
                    {/if}
                    <label
                      class="flex items-center gap-2 text-xs {syncEnabled
                        ? 'text-white/60 cursor-pointer'
                        : 'text-white/30 cursor-not-allowed'}"
                    >
                      <input
                        type="checkbox"
                        checked={!syncEnabled || editForm.isProxy}
                        disabled={!syncEnabled}
                        onchange={(e) => {
                          editForm.isProxy = (e.target as HTMLInputElement).checked;
                        }}
                        class="accent-accent disabled:opacity-40"
                      />
                      Proxy <span class="text-white/30">(live from Jellyfin, no local sync)</span>
                      {#if !syncEnabled}<span class="text-amber-400/70"
                          >(sync disabled — all libraries proxy)</span
                        >{/if}
                    </label>
                  </div>
                  <div class="mt-3 flex gap-2">
                    <button
                      onclick={() => saveEdit(lib.slug)}
                      disabled={saving}
                      class="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onclick={cancelEdit}
                      class="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 transition-colors hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </td>
              </tr>
            {:else}
              <tr class="border-b border-white/10 transition-colors hover:bg-white/5 last:border-0">
                <td class="px-4 py-3 font-medium">{lib.label}</td>
                <td class="px-4 py-3 hidden sm:table-cell text-white/60">{lib.jellyfinName}</td>
                <td class="px-4 py-3 hidden md:table-cell">
                  <span
                    class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide {lib.itemType ===
                    'Movie'
                      ? 'bg-blue-500/20 text-blue-300'
                      : lib.itemType === 'Collection'
                        ? 'bg-green-500/20 text-green-300'
                        : 'bg-purple-500/20 text-purple-300'}"
                  >
                    {lib.itemType}
                  </span>
                </td>
                <td class="px-4 py-3 hidden md:table-cell text-white/40">{lib.displayOrder}</td>
                <td class="px-4 py-3">
                  <div class="flex items-center justify-end gap-2">
                    <button
                      onclick={() => startEdit(lib)}
                      class="rounded-lg px-2.5 py-1 text-xs text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                      >Edit</button
                    >
                    <button
                      onclick={() => deleteLibrary(lib.slug, lib.label)}
                      class="rounded-lg px-2.5 py-1 text-xs text-red-400/70 transition-colors hover:bg-red-500/10 hover:text-red-300"
                      >Delete</button
                    >
                  </div>
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
    {/if}
  </div>

  <!-- Add form -->
  {#if adding}
    <div class="rounded-xl border border-white/10 bg-white/5 p-5">
      <h4 class="mb-4 text-sm font-semibold">Add Library</h4>

      <!-- Jellyfin library picker -->
      <div class="mb-5">
        <p class="mb-2 text-xs text-white/50">Select a Jellyfin library</p>
        {#if loadingJellyfin}
          <p class="text-xs text-white/40">Loading Jellyfin libraries…</p>
        {:else if jellyfinError}
          <p class="text-xs text-red-400">{jellyfinError}</p>
        {:else if jellyfinLibraries.length === 0}
          <p class="text-xs text-white/40">No libraries found in Jellyfin.</p>
        {:else}
          <div class="flex flex-wrap gap-2">
            {#each jellyfinLibraries as jlib (jlib.ItemId)}
              {@const alreadyUsed = libraries.find((l) => l.jellyfinName === jlib.Name)}
              {@const isSelected = form.jellyfinName === jlib.Name}
              <button
                type="button"
                onclick={() => !alreadyUsed && selectJellyfinLibrary(jlib)}
                disabled={!!alreadyUsed}
                title={alreadyUsed ? `Already configured as "${alreadyUsed.label}"` : undefined}
                class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors
                  {alreadyUsed
                  ? 'cursor-not-allowed border-white/5 text-white/20'
                  : isSelected
                    ? 'border-accent bg-accent/10 text-white'
                    : 'border-white/10 text-white/60 hover:border-white/20 hover:text-white'}"
              >
                <span>{jlib.Name}</span>
                {#if alreadyUsed}
                  <span
                    class="rounded px-1 py-0.5 text-[10px] font-medium uppercase bg-white/5 text-white/25"
                  >
                    {alreadyUsed.label}
                  </span>
                {:else}
                  <span
                    class="rounded px-1 py-0.5 text-[10px] font-medium uppercase {jlib.CollectionType ===
                    'movies'
                      ? 'bg-blue-500/20 text-blue-300'
                      : jlib.CollectionType === 'boxsets'
                        ? 'bg-green-500/20 text-green-300'
                        : 'bg-purple-500/20 text-purple-300'}"
                  >
                    {jlib.CollectionType === 'movies'
                      ? 'Movie'
                      : jlib.CollectionType === 'boxsets'
                        ? 'Collection'
                        : 'Series'}
                  </span>
                {/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Form fields -->
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label for="add-label" class="mb-1 block text-xs text-white/50"
            >Label <span class="text-white/30">(display name)</span></label
          >
          <input
            id="add-label"
            class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-accent focus:outline-none"
            bind:value={form.label}
            placeholder="Anime"
          />
          {#if form.label}
            <p class="mt-1 text-[10px] text-white/30">slug: {slugify(form.label)}</p>
          {/if}
        </div>
        <div>
          <label for="add-type" class="mb-1 block text-xs text-white/50">Type</label>
          <select
            id="add-type"
            class="w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
            bind:value={form.itemType}
          >
            <option value="Movie">Movie</option>
            <option value="Series">Series</option>
            <option value="Collection">Collection</option>
          </select>
        </div>
        <div>
          <label for="add-order" class="mb-1 block text-xs text-white/50">Display Order</label>
          <input
            id="add-order"
            type="number"
            class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
            bind:value={form.displayOrder}
            min="0"
          />
        </div>
      </div>

      <div class="mt-4 flex flex-wrap gap-6">
        <label class="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
          <input type="checkbox" bind:checked={form.viewInMenu} class="accent-accent" />
          View in menu
        </label>
        {#if form.itemType !== 'Collection'}
          <label class="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={form.viewLeavingSoon}
              disabled={form.isProxy}
              class="accent-accent disabled:opacity-40"
            />
            View leaving soon
          </label>
        {/if}
        <label
          class="flex items-center gap-2 text-xs {syncEnabled
            ? 'text-white/60 cursor-pointer'
            : 'text-white/30 cursor-not-allowed'}"
        >
          <input
            type="checkbox"
            checked={!syncEnabled || form.isProxy}
            disabled={!syncEnabled}
            onchange={(e) => {
              form.isProxy = (e.target as HTMLInputElement).checked;
            }}
            class="accent-accent disabled:opacity-40"
          />
          Proxy <span class="text-white/30">(live from Jellyfin, no local sync)</span>
          {#if !syncEnabled}<span class="text-amber-400/70"
              >(sync disabled — all libraries proxy)</span
            >{/if}
        </label>
      </div>

      <div class="mt-4 flex gap-2">
        <button
          onclick={addLibrary}
          disabled={saving || !form.label.trim() || !form.jellyfinName.trim()}
          class="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {saving ? 'Adding…' : 'Add Library'}
        </button>
        <button
          onclick={cancelAdd}
          class="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 transition-colors hover:text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  {:else}
    <button
      onclick={openAdd}
      class="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm text-white/60 transition-colors hover:border-white/20 hover:text-white"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        class="h-4 w-4"
      >
        <path
          d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z"
        />
      </svg>
      Add Library
    </button>
  {/if}
</div>
