import { defineMiddleware } from 'astro:middleware';
import { getSessionUser, touchSession } from './lib/db';
import { isJellyfinConfigured } from './lib/jellyfin/client';
import './lib/setupToken';
import { initScheduler } from './lib/scheduler';
import { logDistStructure } from './lib/startup-check';

// Log dist structure once at startup
let startupLogged = false;
if (!startupLogged) {
  logDistStructure();
  startupLogged = true;
}

// Initialize scheduler (runs once)
initScheduler();

const PUBLIC = ['/login', '/api/auth/login', '/api/auth/logout'];

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  "worker-src blob: 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
].join('; ');

function isSetupPath(pathname: string): boolean {
  return pathname === '/setup' || pathname.startsWith('/api/setup/');
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  // Only log API and auth routes to avoid spam
  if (pathname.startsWith('/api/') || pathname === '/login') {
    console.log('[middleware] Request:', context.request.method, pathname);
  }

  if (!isJellyfinConfigured()) {
    if (!isSetupPath(pathname)) return context.redirect('/setup');
    const resp = await next();
    resp.headers.set('Content-Security-Policy', CSP);
    return resp;
  }

  if (pathname === '/setup') return context.redirect('/');

  if (!PUBLIC.includes(pathname)) {
    console.log('[middleware] Protected path, checking auth');
    const token = context.cookies.get('auth')?.value;
    if (!token) {
      console.log('[middleware] No auth token, redirecting to /login');
      return context.redirect('/login');
    }

    const session = getSessionUser(token);
    if (!session) {
      console.log('[middleware] Session not found, clearing cookie and redirecting');
      context.cookies.delete('auth', { path: '/' });
      return context.redirect('/login');
    }

    console.log('[middleware] Auth successful for user:', session.user.name);
    context.locals.user = session.user;
    context.locals.jellyfinToken = session.jellyfinToken;
    touchSession(token);

    if (pathname.startsWith('/admin') && !session.user.isAdministrator) {
      console.log('[middleware] Non-admin accessing /admin, redirecting');
      return context.redirect('/');
    }
  }
  console.log('[middleware] Proceeding to next handler');

  const resp = await next();
  resp.headers.set('Content-Security-Policy', CSP);
  return resp;
});
