import type { APIRoute } from 'astro';
import {
  upsertUser,
  createSession,
  enforceSessionLimit,
  SESSION_TTL_MS,
  isLoginLocked,
  recordFailedLogin,
  clearLoginAttempts,
  getSetting,
} from '../../../lib/db';
import { jellyfinBase } from '../../../lib/jellyfin/client';
import { json } from '../../../lib/response';

interface JellyfinAuthResponse {
  AccessToken: string;
  User: {
    Id: string;
    Name: string;
    PrimaryImageTag?: string;
    Policy?: {
      IsAdministrator: boolean;
      EnableMediaPlayback: boolean;
    };
  };
}

// 'x_forwarded_for' uses the *last* entry: proxies append the address they saw
// to any inbound header, so the rightmost entry is the one written by our own
// proxy while earlier entries are client-controlled. Only safe if the app is
// reachable exclusively through that proxy. Configurable in Admin → Settings;
// defaults to the raw connecting socket address.
function resolveClientIp(request: Request, clientAddress: string): string | null {
  const source = getSetting('login_rate_limit_source', 'client_address');
  if (source === 'disabled') return null;
  if (source === 'x_forwarded_for') {
    const entries = request.headers.get('x-forwarded-for')?.split(',');
    const last = entries?.at(-1)?.trim();
    return last || clientAddress;
  }
  return clientAddress;
}

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  console.log('[auth/login] POST request received');
  const ip = resolveClientIp(request, clientAddress);
  console.log('[auth/login] Client IP resolved:', ip);

  if (ip && isLoginLocked(ip)) {
    console.warn('[auth/login] IP locked due to rate limiting:', ip);
    return json({ error: 'Too many failed attempts. Try again later.' }, 429);
  }

  let username: string, password: string;
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    username = body.username ?? '';
    password = body.password ?? '';
    console.log('[auth/login] Credentials parsed, username:', username ? '***' : '(empty)');
  } catch (e) {
    console.error('[auth/login] Failed to parse request body:', e);
    return json({ error: 'Invalid request body' }, 400);
  }

  if (!username || !password) {
    console.warn('[auth/login] Missing username or password');
    return json({ error: 'Username and password are required' }, 400);
  }

  const jellyfinUrl = jellyfinBase();
  console.log('[auth/login] Attempting Jellyfin auth at:', jellyfinUrl);
  let resp: Response;
  try {
    resp = await fetch(`${jellyfinUrl}/Users/AuthenticateByName`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Emby-Authorization':
          'MediaBrowser Client="Tideline", Device="Server", DeviceId="tideline-server", Version="1.0.0"',
      },
      body: JSON.stringify({ Username: username, Pw: password }),
    });
    console.log('[auth/login] Jellyfin response status:', resp.status);
  } catch (e) {
    console.error(
      '[auth/login] Jellyfin request failed:',
      e instanceof Error ? e.message : String(e),
    );
    return json({ error: 'Could not reach Jellyfin server' }, 502);
  }

  if (!resp.ok) {
    console.warn('[auth/login] Jellyfin auth rejected (status ' + resp.status + ')');
    if (ip) recordFailedLogin(ip);
    return json({ error: 'Invalid username or password' }, 401);
  }

  let auth: JellyfinAuthResponse;
  try {
    auth = (await resp.json()) as JellyfinAuthResponse;
    console.log('[auth/login] Jellyfin auth successful for user:', auth.User.Name);
  } catch (e) {
    console.error('[auth/login] Failed to parse Jellyfin response:', e);
    return json({ error: 'Invalid Jellyfin response' }, 502);
  }

  if (ip) clearLoginAttempts(ip);

  upsertUser({
    jellyfinId: auth.User.Id,
    name: auth.User.Name,
    primaryImageTag: auth.User.PrimaryImageTag ?? null,
    isAdministrator: auth.User.Policy?.IsAdministrator ?? false,
    enableMediaPlayback: auth.User.Policy?.EnableMediaPlayback ?? true,
  });
  console.log('[auth/login] User upserted:', auth.User.Name);

  const userAgent = request.headers.get('user-agent');
  const { token } = createSession(auth.User.Id, auth.AccessToken, ip, userAgent);
  console.log('[auth/login] Session created for user:', auth.User.Name);

  const maxSessions = parseInt(getSetting('max_sessions_per_user', '5'), 10);
  enforceSessionLimit(auth.User.Id, maxSessions);
  console.log('[auth/login] Session limit enforced (max:', maxSessions + ')');

  cookies.set('auth', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });
  console.log('[auth/login] Auth cookie set, login successful');

  return json({ ok: true }, 200);
};
