function normalizeIso(iso: string): string {
  return iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`;
}

export function formatDate(iso: string): string {
  return new Date(normalizeIso(iso)).toLocaleDateString('en-GB', { dateStyle: 'medium' });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(normalizeIso(iso)).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function formatRuntime(ticks: number): string {
  const totalMinutes = Math.round(ticks / 10_000_000 / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function leavingBadgeClass(days: number): string {
  if (days <= 7) return 'bg-red-600 text-white';
  if (days <= 14) return 'bg-orange-500 text-white';
  if (days <= 21) return 'bg-yellow-500 text-black';
  return 'bg-white/20 text-white';
}

export function leavingTextClass(days: number): string {
  if (days <= 7) return 'text-red-400';
  if (days <= 14) return 'text-orange-400';
  if (days <= 21) return 'text-yellow-400';
  return 'text-white/50';
}
