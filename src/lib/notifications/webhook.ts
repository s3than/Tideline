import { getSetting } from '../db';
import { resolveBlocked, resolveAllowWebhookLocalhost } from '../network';
import { WEBHOOK_TYPES } from './types';
import type { WebhookType, NotificationEvent } from './types';

const NTFY_TITLES: Record<NotificationEvent['type'], string> = {
  tagged: 'Leaving Soon',
  untagged: 'No Longer Leaving',
  keep_requested: 'Keep Request',
  nominated: 'Leaving Soon Nomination',
};

const EVENT_PALETTE: Record<NotificationEvent['type'], { discord: number; slack: string }> = {
  tagged: { discord: 0xf97316, slack: '#F97316' }, // orange
  untagged: { discord: 0x22c55e, slack: '#22C55E' }, // green
  keep_requested: { discord: 0xe94560, slack: '#E94560' }, // accent red
  nominated: { discord: 0xfbbf24, slack: '#FBBF24' }, // amber
};

function withYear(name: string, year?: number): string {
  return year ? `${name} (${year})` : name;
}

function buildTitle(event: NotificationEvent): string {
  switch (event.type) {
    case 'tagged':
      return `Leaving Soon: ${withYear(event.itemName, event.year)}`;
    case 'untagged':
      return `Removed from Leaving Soon: ${withYear(event.itemName, event.year)}`;
    case 'keep_requested':
      return `Keep Request: ${withYear(event.itemName, event.year)}`;
    case 'nominated':
      return `Nominated for Leaving Soon: ${withYear(event.itemName, event.year)}`;
  }
}

type EmbedField = { name: string; value: string; inline: boolean };

function buildFields(event: NotificationEvent): EmbedField[] {
  switch (event.type) {
    case 'tagged':
      return [
        { name: 'Library', value: event.libraryLabel, inline: true },
        { name: 'Days Remaining', value: String(event.days), inline: true },
      ];
    case 'untagged':
      return [{ name: 'Library', value: event.libraryLabel, inline: true }];
    case 'keep_requested':
      return [{ name: 'Requested By', value: event.requestedBy, inline: true }];
    case 'nominated':
      return [
        { name: 'Nominated By', value: event.nominatedBy, inline: true },
        { name: 'Library', value: event.libraryLabel, inline: true },
      ];
  }
}

function formatMessage(event: NotificationEvent): string {
  switch (event.type) {
    case 'tagged':
      return `${event.itemName} is leaving ${event.libraryLabel} in ${event.days} day${event.days === 1 ? '' : 's'}.`;
    case 'untagged':
      return `${event.itemName} has been removed from Leaving Soon in ${event.libraryLabel}.`;
    case 'keep_requested':
      return `${event.requestedBy} requested to keep ${event.itemName}.`;
    case 'nominated':
      return `${event.nominatedBy} nominated ${event.itemName} for leaving soon in ${event.libraryLabel}.`;
  }
}

function buildBody(
  type: WebhookType,
  event: NotificationEvent,
  message: string,
  siteUrl: string,
  username: string,
  avatarUrl: string,
): string {
  const nominationsUrl = siteUrl ? `${siteUrl}/admin/leaving-soon` : undefined;
  switch (type) {
    case 'discord': {
      const embed: Record<string, unknown> = {
        title: buildTitle(event),
        color: EVENT_PALETTE[event.type].discord,
        fields: buildFields(event),
        timestamp: new Date().toISOString(),
      };
      if (event.overview) embed.description = event.overview;
      if (event.posterUrl) embed.thumbnail = { url: event.posterUrl };
      if (nominationsUrl) embed.url = nominationsUrl;
      const payload: Record<string, unknown> = { embeds: [embed] };
      if (username) payload.username = username;
      if (avatarUrl) payload.avatar_url = avatarUrl;
      return JSON.stringify(payload);
    }
    case 'slack': {
      const attachment: Record<string, unknown> = {
        color: EVENT_PALETTE[event.type].slack,
        title: buildTitle(event),
        fields: buildFields(event).map((f) => ({ title: f.name, value: f.value, short: f.inline })),
        footer: 'Tideline',
        ts: Math.floor(Date.now() / 1000),
      };
      if (event.overview) attachment.text = event.overview;
      if (event.posterUrl) attachment.thumb_url = event.posterUrl;
      if (nominationsUrl) attachment.title_link = nominationsUrl;
      const payload: Record<string, unknown> = { attachments: [attachment] };
      if (username) payload.username = username;
      if (avatarUrl) payload.icon_url = avatarUrl;
      return JSON.stringify(payload);
    }
    case 'ntfy': {
      const body: Record<string, unknown> = { title: NTFY_TITLES[event.type], message };
      if (nominationsUrl) body.click = nominationsUrl;
      return JSON.stringify(body);
    }
    case 'gotify':
      return JSON.stringify({ title: 'Tideline', message, priority: 5 });
    case 'generic':
      return JSON.stringify({
        ...event,
        title: buildTitle(event),
        message,
        ...(nominationsUrl ? { siteUrl: nominationsUrl } : {}),
      });
  }
}

export async function dispatchWebhook(
  url: string,
  type: WebhookType,
  event: NotificationEvent,
): Promise<void> {
  const allowLocalhost = resolveAllowWebhookLocalhost();
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error('Invalid webhook URL');
  }
  const blocked = await resolveBlocked(hostname, allowLocalhost).catch(() => null);
  if (blocked) throw new Error(`Webhook requests to ${blocked} are not permitted`);

  const message = formatMessage(event);
  const siteUrl = getSetting('site_url', '');
  const username = getSetting('webhook_username', '');
  const avatarUrl = getSetting('webhook_avatar_url', '');
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: buildBody(type, event, message, siteUrl, username, avatarUrl),
  });
  if (!resp.ok) throw new Error(`Webhook returned ${resp.status} ${resp.statusText}`);
}

export function sendNotification(event: NotificationEvent): void {
  const url = getSetting('webhook_url', '');
  if (!url) return;

  const enabledTypes = getSetting(
    'webhook_notification_types',
    'tagged,untagged,keep_requested,nominated',
  )
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  if (!enabledTypes.includes(event.type)) return;

  const raw = getSetting('webhook_type', 'generic');
  const type: WebhookType = (WEBHOOK_TYPES as readonly string[]).includes(raw)
    ? (raw as WebhookType)
    : 'generic';

  dispatchWebhook(url, type, event).catch(() => {});
}
