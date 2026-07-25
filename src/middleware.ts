import { defineMiddleware } from 'astro:middleware';
import { getSessionUser } from './lib/db';
import { isJellyfinConfigured } from './lib/jellyfin/client';
import './lib/setupToken';
import { initScheduler } from './lib/scheduler';

initScheduler();

const PUBLIC = ['/login', '/api/auth/login', '/api/auth/logout'];

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
].join('; ');

function isSetupPath(pathname: string): boolean {
  return pathname === '/setup' || pathname.startsWith('/api/setup/');
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  if (!isJellyfinConfigured()) {
    if (!isSetupPath(pathname)) return context.redirect('/setup');
    const resp = await next();
    resp.headers.set('Content-Security-Policy', CSP);
    return resp;
  }

  if (pathname === '/setup') return context.redirect('/');

  if (!PUBLIC.includes(pathname)) {
    const token = context.cookies.get('auth')?.value;
    if (!token) return context.redirect('/login');

    const session = getSessionUser(token);
    if (!session) {
      context.cookies.delete('auth', { path: '/' });
      return context.redirect('/login');
    }

    context.locals.user = session.user;
    context.locals.jellyfinToken = session.jellyfinToken;

    if (pathname.startsWith('/admin') && !session.user.isAdministrator) {
      return context.redirect('/');
    }
  }

  const resp = await next();
  resp.headers.set('Content-Security-Policy', CSP);
  return resp;
});
