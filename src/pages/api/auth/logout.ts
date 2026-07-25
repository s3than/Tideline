import type { APIRoute } from 'astro';
import { deleteSession } from '../../../lib/db';

export const POST: APIRoute = ({ cookies }) => {
  const token = cookies.get('auth')?.value;
  if (token) deleteSession(token);
  cookies.delete('auth', { path: '/' });
  return new Response(null, { status: 204 });
};
