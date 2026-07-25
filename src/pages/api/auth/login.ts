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
  const ip = resolveClientIp(request, clientAddress);

  if (ip && isLoginLocked(ip)) {
    return json({ error: 'Too many failed attempts. Try again later.' }, 429);
  }

  let username: string, password: string;
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    username = body.username ?? '';
    password = body.password ?? '';
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  if (!username || !password) {
    return json({ error: 'Username and password are required' }, 400);
  }

  let resp: Response;
  try {
    resp = await fetch(`${jellyfinBase()}/Users/AuthenticateByName`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Emby-Authorization':
          'MediaBrowser Client="Tideline", Device="Server", DeviceId="tideline-server", Version="1.0.0"',
      },
      body: JSON.stringify({ Username: username, Pw: password }),
    });
  } catch {
    return json({ error: 'Could not reach Jellyfin server' }, 502);
  }

  if (!resp.ok) {
    if (ip) recordFailedLogin(ip);
    return json({ error: 'Invalid username or password' }, 401);
  }

  const auth = (await resp.json()) as JellyfinAuthResponse;
  if (ip) clearLoginAttempts(ip);

  upsertUser({
    jellyfinId: auth.User.Id,
    name: auth.User.Name,
    primaryImageTag: auth.User.PrimaryImageTag ?? null,
    isAdministrator: auth.User.Policy?.IsAdministrator ?? false,
    enableMediaPlayback: auth.User.Policy?.EnableMediaPlayback ?? true,
  });

  const userAgent = request.headers.get('user-agent');
  const { token } = createSession(auth.User.Id, auth.AccessToken, ip, userAgent);

  const maxSessions = parseInt(getSetting('max_sessions_per_user', '5'), 10);
  enforceSessionLimit(auth.User.Id, maxSessions);

  cookies.set('auth', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });

  return json({ ok: true }, 200);
};
