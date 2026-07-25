import type { APIRoute } from 'astro';
import { getSetting, setSetting, getLibraries, clearMediaByLibrary } from '../../../lib/db';
import { resolveBlocked, resolveAllowWebhookLocalhost } from '../../../lib/network';
import { WEBHOOK_TYPES } from '../../../lib/notifications';
import { json, requireAdmin } from '../../../lib/response';
import { rescheduleNext } from '../../../lib/scheduler';

const SETTINGS_KEYS = [
  'sync_enabled',
  'sync_schedule_enabled',
  'sync_interval_hours',
  'leaving_soon_days_fallback',
  'login_rate_limit_source',
  'rate_limit_max_attempts',
  'rate_limit_window_minutes',
  'rate_limit_lockout_minutes',
  'max_sessions_per_user',
  'site_url',
  'webhook_url',
  'webhook_type',
  'webhook_username',
  'webhook_avatar_url',
  'webhook_notification_types',
] as const;
type SettingKey = (typeof SETTINGS_KEYS)[number];

const RATE_LIMIT_SOURCES = ['client_address', 'x_forwarded_for', 'disabled'] as const;

const DEFAULTS: Record<SettingKey, string> = {
  sync_enabled: '1',
  sync_schedule_enabled: '0',
  sync_interval_hours: '6',
  leaving_soon_days_fallback: '30',
  login_rate_limit_source: 'client_address',
  rate_limit_max_attempts: '5',
  rate_limit_window_minutes: '15',
  rate_limit_lockout_minutes: '15',
  max_sessions_per_user: '5',
  site_url: '',
  webhook_url: '',
  webhook_type: 'generic',
  webhook_username: '',
  webhook_avatar_url: '',
  webhook_notification_types: 'tagged,untagged,keep_requested,nominated',
};

const ENV_OVERRIDES: Partial<Record<SettingKey, string>> = Object.fromEntries(
  (
    [
      ['rate_limit_max_attempts', process.env.RATE_LIMIT_MAX_ATTEMPTS],
      ['rate_limit_window_minutes', process.env.RATE_LIMIT_WINDOW_MINUTES],
      ['rate_limit_lockout_minutes', process.env.RATE_LIMIT_LOCKOUT_MINUTES],
    ] as [SettingKey, string | undefined][]
  ).filter(([, v]) => v !== undefined),
);

function webhookHostError(url: URL, type: string): string | null {
  if (type === 'discord' && url.hostname !== 'discord.com' && url.hostname !== 'discordapp.com') {
    return 'Discord webhook URLs must use discord.com';
  }
  if (type === 'slack' && url.hostname !== 'hooks.slack.com') {
    return 'Slack webhook URLs must use hooks.slack.com';
  }
  return null;
}

export const GET: APIRoute = ({ locals }) => {
  const deny = requireAdmin(locals);
  if (deny) return deny;

  const settings = Object.fromEntries(
    SETTINGS_KEYS.map((key) => [key, ENV_OVERRIDES[key] ?? getSetting(key, DEFAULTS[key])]),
  );
  const envLocked = Object.fromEntries(SETTINGS_KEYS.map((key) => [key, key in ENV_OVERRIDES]));
  const scheduleStatus = {
    lastSync: getSetting('last_scheduled_sync', '') || null,
    nextSync: getSetting('next_scheduled_sync', '') || null,
  };
  return json({ settings, envLocked, scheduleStatus });
};

export const PATCH: APIRoute = async ({ request, locals }) => {
  const deny = requireAdmin(locals);
  if (deny) return deny;

  let body: Partial<Record<SettingKey, unknown>>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid body' }, 400);
  }

  for (const key of SETTINGS_KEYS) {
    if (key in body && !(key in ENV_OVERRIDES)) {
      const val = body[key];
      if (key === 'sync_enabled') {
        if (val !== '0' && val !== '1')
          return json({ error: 'sync_enabled must be "0" or "1"' }, 400);
        setSetting(key, val);
        if (val === '0') {
          for (const lib of getLibraries()) clearMediaByLibrary(lib.slug);
        }
      }
      if (key === 'sync_schedule_enabled') {
        if (val !== '0' && val !== '1')
          return json({ error: 'sync_schedule_enabled must be "0" or "1"' }, 400);
        setSetting(key, val);
        if (val === '1') rescheduleNext();
      }
      if (key === 'sync_interval_hours') {
        const n = Number(val);
        if (!Number.isInteger(n) || n < 1 || n > 168) {
          return json({ error: 'sync_interval_hours must be an integer 1–168' }, 400);
        }
        setSetting(key, String(n));
        rescheduleNext();
      }
      if (key === 'leaving_soon_days_fallback') {
        const n = Number(val);
        if (!Number.isInteger(n) || n < 1 || n > 365) {
          return json({ error: `${key} must be an integer 1–365` }, 400);
        }
        setSetting(key, String(n));
      }
      if (key === 'login_rate_limit_source') {
        if (!RATE_LIMIT_SOURCES.includes(val as (typeof RATE_LIMIT_SOURCES)[number])) {
          return json({ error: `${key} must be one of ${RATE_LIMIT_SOURCES.join(', ')}` }, 400);
        }
        setSetting(key, val as string);
      }
      if (key === 'rate_limit_max_attempts') {
        const n = Number(val);
        if (!Number.isInteger(n) || n < 1 || n > 100) {
          return json({ error: `${key} must be an integer 1–100` }, 400);
        }
        setSetting(key, String(n));
      }
      if (key === 'rate_limit_window_minutes') {
        const n = Number(val);
        if (!Number.isInteger(n) || n < 1 || n > 1440) {
          return json({ error: `${key} must be an integer 1–1440` }, 400);
        }
        setSetting(key, String(n));
      }
      if (key === 'rate_limit_lockout_minutes') {
        const n = Number(val);
        if (!Number.isInteger(n) || n < 1 || n > 1440) {
          return json({ error: `${key} must be an integer 1–1440` }, 400);
        }
        setSetting(key, String(n));
      }
      if (key === 'max_sessions_per_user') {
        const n = Number(val);
        if (!Number.isInteger(n) || n < 1 || n > 20) {
          return json({ error: `${key} must be an integer 1–20` }, 400);
        }
        setSetting(key, String(n));
      }
      if (key === 'site_url') {
        if (val !== '' && typeof val === 'string') {
          try {
            new URL(val);
          } catch {
            return json({ error: 'site_url must be a valid URL' }, 400);
          }
        }
        setSetting(key, typeof val === 'string' ? val.replace(/\/$/, '') : '');
      }
      if (key === 'webhook_url') {
        if (val !== '' && typeof val === 'string') {
          let parsed: URL;
          try {
            parsed = new URL(val);
          } catch {
            return json({ error: 'webhook_url must be a valid URL' }, 400);
          }
          const allowLocalhost = resolveAllowWebhookLocalhost();
          const blocked = await resolveBlocked(parsed.hostname, allowLocalhost).catch(() => null);
          if (blocked)
            return json({ error: `Webhook requests to ${blocked} are not permitted` }, 400);
          // For service types with fixed domains, enforce the expected host
          const effectiveType =
            (typeof body['webhook_type'] === 'string' ? body['webhook_type'] : null) ??
            getSetting('webhook_type', 'generic');
          const hostErr = webhookHostError(parsed, effectiveType);
          if (hostErr) return json({ error: hostErr }, 400);
        }
        setSetting(key, typeof val === 'string' ? val : '');
      }
      if (key === 'webhook_type') {
        if (!(WEBHOOK_TYPES as readonly string[]).includes(val as string)) {
          return json({ error: `webhook_type must be one of: ${WEBHOOK_TYPES.join(', ')}` }, 400);
        }
        const effectiveUrl =
          (typeof body['webhook_url'] === 'string' ? body['webhook_url'] : null) ??
          getSetting('webhook_url', '');
        if (effectiveUrl) {
          let parsed: URL;
          try {
            parsed = new URL(effectiveUrl);
          } catch {
            return json({ error: 'Existing webhook URL is invalid' }, 400);
          }
          const hostErr = webhookHostError(parsed, val as string);
          if (hostErr) return json({ error: hostErr }, 400);
        }
        setSetting(key, val as string);
      }
      if (key === 'webhook_username') {
        setSetting(key, typeof val === 'string' ? val.slice(0, 80) : '');
      }
      if (key === 'webhook_avatar_url') {
        if (val !== '' && typeof val === 'string') {
          try {
            new URL(val);
          } catch {
            return json({ error: 'webhook_avatar_url must be a valid URL' }, 400);
          }
        }
        setSetting(key, typeof val === 'string' ? val : '');
      }
      if (key === 'webhook_notification_types') {
        const VALID = ['tagged', 'untagged', 'keep_requested', 'nominated'] as const;
        const types = Array.isArray(val) ? val : [];
        if (!types.every((t): t is string => VALID.includes(t as (typeof VALID)[number]))) {
          return json({ error: 'webhook_notification_types contains invalid event type' }, 400);
        }
        setSetting(key, types.join(','));
      }
    }
  }

  return json({ ok: true });
};
