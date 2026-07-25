export const ITEM_ID_RE = /^[a-f0-9-]{8,40}$/i;

export function json(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function requireAdmin(locals: App.Locals): Response | null {
  if (!locals.user) return json({ error: 'Unauthorized' }, 401);
  if (!locals.user.isAdministrator) return json({ error: 'Forbidden' }, 403);
  return null;
}

export function validHttpUrl(raw: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(raw).protocol);
  } catch {
    return false;
  }
}

export function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function absolutePosterUrl(request: Request, id: string, tag: string, w = 300): string {
  return `${new URL(request.url).origin}/api/image/Primary/${id}?tag=${encodeURIComponent(tag)}&w=${w}`;
}
