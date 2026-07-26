<script lang="ts">
  import { untrack } from 'svelte';
  import { toErrorMessage } from '../../lib/response';
  import AdminError from './AdminError.svelte';
  import AdminSaveButton from './AdminSaveButton.svelte';
  import ScheduleTaskRow from './ScheduleTaskRow.svelte';

  type Props = {
    fullSyncEnabled: boolean;
    fullSyncIntervalHours: number;
    lastFullSync: string | null;
    nextFullSync: string | null;
    partialSyncEnabled: boolean;
    partialSyncIntervalHours: number;
    lastPartialSync: string | null;
    nextPartialSync: string | null;
  };

  let {
    fullSyncEnabled: initialFullEnabled,
    fullSyncIntervalHours: initialFullHours,
    lastFullSync: initialLastFull,
    nextFullSync: initialNextFull,
    partialSyncEnabled: initialPartialEnabled,
    partialSyncIntervalHours: initialPartialHours,
    lastPartialSync: initialLastPartial,
    nextPartialSync: initialNextPartial,
  }: Props = $props();

  let fullSyncEnabled: boolean = $state(untrack(() => initialFullEnabled));
  let fullSyncIntervalHours: number = $state(untrack(() => initialFullHours));
  let lastFullSync: string | null = $state(untrack(() => initialLastFull));
  let nextFullSync: string | null = $state(untrack(() => initialNextFull));

  let partialSyncEnabled: boolean = $state(untrack(() => initialPartialEnabled));
  let partialSyncIntervalHours: number = $state(untrack(() => initialPartialHours));
  let lastPartialSync: string | null = $state(untrack(() => initialLastPartial));
  let nextPartialSync: string | null = $state(untrack(() => initialNextPartial));

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
          sync_schedule_enabled: fullSyncEnabled ? '1' : '0',
          sync_interval_hours: fullSyncIntervalHours,
          partial_sync_enabled: partialSyncEnabled ? '1' : '0',
          partial_sync_interval_hours: partialSyncIntervalHours,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? 'Failed to save');

      const statusResp = await fetch('/api/admin/settings');
      if (statusResp.ok) {
        const { scheduleStatus } = await statusResp.json();
        lastFullSync = scheduleStatus.lastSync;
        nextFullSync = scheduleStatus.nextSync;
        lastPartialSync = scheduleStatus.lastPartialSync;
        nextPartialSync = scheduleStatus.nextPartialSync;
      }

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

<div class="space-y-3">
  <AdminError {error} />

  <div class="overflow-hidden rounded-xl border border-white/10 divide-y divide-white/10">
    <ScheduleTaskRow
      title="Full Sync"
      description="Wipes and rebuilds all library data from Jellyfin."
      enabled={fullSyncEnabled}
      intervalHours={fullSyncIntervalHours}
      lastRun={lastFullSync}
      nextRun={nextFullSync}
      ontoggle={() => {
        fullSyncEnabled = !fullSyncEnabled;
      }}
      onpickinterval={(v) => {
        fullSyncIntervalHours = v;
      }}
    />
    <ScheduleTaskRow
      title="Partial Sync"
      description="Fetches only new and changed items, removes deleted ones."
      enabled={partialSyncEnabled}
      intervalHours={partialSyncIntervalHours}
      lastRun={lastPartialSync}
      nextRun={nextPartialSync}
      ontoggle={() => {
        partialSyncEnabled = !partialSyncEnabled;
      }}
      onpickinterval={(v) => {
        partialSyncIntervalHours = v;
      }}
    />
  </div>

  <div class="flex items-center gap-3">
    <AdminSaveButton {saving} {saved} onsave={save} />
  </div>
</div>
