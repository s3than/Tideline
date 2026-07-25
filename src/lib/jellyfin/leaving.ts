import type { JellyfinItem } from './types';
import { getLeavingSoonEntry, upsertLeavingSoon, getSetting } from '../db';
import { todayStr } from '../format';

function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysUntil(dateStr: string): number {
  const ms = new Date(dateStr).getTime() - new Date(todayStr()).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

function daysBetween(from: string, to: string): number {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * For each item, look up its stored expiry date (set on first sight from the
 * lv-N tag) and attach resolvedDays so the countdown decreases day-by-day
 * rather than always showing the static tag value.
 */
export function enrichLeavingSoon(items: JellyfinItem[]): JellyfinItem[] {
  if (items.length === 0) return items;

  const today = todayStr();

  return items.map((item) => {
    const tagDays = daysFromTags(item.Tags ?? []);
    const stored = getLeavingSoonEntry(item.Id);

    if (stored) {
      const storedDuration = daysBetween(stored.firstSeen, stored.expiresOn);
      if (storedDuration !== tagDays) {
        const updated = {
          firstSeen: stored.firstSeen,
          expiresOn: addDaysToDate(stored.firstSeen, tagDays),
        };
        upsertLeavingSoon(item.Id, updated);
        return { ...item, resolvedDays: daysUntil(updated.expiresOn) };
      }
      return { ...item, resolvedDays: daysUntil(stored.expiresOn) };
    }

    upsertLeavingSoon(item.Id, {
      firstSeen: today,
      expiresOn: addDaysToDate(today, tagDays),
    });
    return { ...item, resolvedDays: tagDays };
  });
}

export function daysFromTags(tags: string[]): number {
  const lvTag = tags.find((t) => /^lv-\d+$/.test(t));
  if (lvTag) return parseInt(lvTag.slice(3), 10);
  const n = parseInt(getSetting('leaving_soon_days_fallback', '30'), 10);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

export function itemDays(item: JellyfinItem): number {
  return item.resolvedDays ?? daysFromTags(item.Tags ?? []);
}

export function sortByDays(items: JellyfinItem[]): JellyfinItem[] {
  return [...items].sort((a, b) => itemDays(a) - itemDays(b));
}
