import type { APIRoute } from 'astro';
import { getSetting } from '../../../../lib/db';
import { dispatchWebhook, WEBHOOK_TYPES } from '../../../../lib/notifications';
import type { WebhookType } from '../../../../lib/notifications';
import { json, requireAdmin, toErrorMessage } from '../../../../lib/response';

export const POST: APIRoute = async ({ request, locals }) => {
  const deny = requireAdmin(locals);
  if (deny) return deny;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const url =
    typeof body.webhook_url === 'string' && body.webhook_url
      ? body.webhook_url
      : getSetting('webhook_url', '');

  if (!url) return json({ error: 'No webhook URL configured' }, 400);

  const rawType =
    typeof body.webhook_type === 'string'
      ? body.webhook_type
      : getSetting('webhook_type', 'generic');
  const type: WebhookType = (WEBHOOK_TYPES as readonly string[]).includes(rawType)
    ? (rawType as WebhookType)
    : 'generic';

  try {
    await dispatchWebhook(url, type, {
      type: 'tagged',
      itemName: 'Test Item',
      libraryLabel: 'Movies',
      days: 7,
    });
    return json({ ok: true });
  } catch (e: unknown) {
    return json({ error: toErrorMessage(e) }, 502);
  }
};
