import { NextRequest } from 'next/server';
import { supabaseAdmin } from './supabase-admin';

export async function requireAdmin(req: NextRequest): Promise<string | null> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
    ?? req.cookies.get('sb-access-token')?.value
    ?? extractTokenFromCookies(req);

  if (!token) return null;

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  // Verify they exist in users table with admin role
  const { data } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  return data?.role === 'admin' ? user.id : null;
}

function extractTokenFromCookies(req: NextRequest): string | null {
  // Supabase stores the token in a cookie like sb-<ref>-auth-token
  for (const [name, cookie] of req.cookies) {
    if (name.includes('auth-token') && !name.includes('code-verifier')) {
      try {
        const parsed = JSON.parse(decodeURIComponent(cookie.value));
        return parsed?.access_token ?? (Array.isArray(parsed) ? parsed[0] : null);
      } catch {
        return cookie.value;
      }
    }
  }
  return null;
}
