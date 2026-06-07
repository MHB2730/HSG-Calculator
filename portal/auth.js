/*
 * portal/auth.js — staff authentication via Supabase Auth (email + password).
 *
 * Clients NEVER use this (they look up by reference + surname). This is only for
 * HSG staff using the admin screen. Staff accounts are created in the Supabase
 * dashboard (Authentication → Users → Add user) with a firm email; the
 * handle_new_user trigger (migration 0003) then grants them the 'staff' role.
 */
import { sb } from './supabase.js';

export function hasAuth() { return !!sb; }

export async function getUser() {
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return (data && data.user) || null;
}

export async function signIn(email, password) {
  if (!sb) return { error: { message: 'The live database is not reachable right now.' } };
  return sb.auth.signInWithPassword({ email: (email || '').trim(), password: password || '' });
}

export async function signOut() { if (sb) await sb.auth.signOut(); }

/* True only if the signed-in user has the staff/admin role (own profile row). */
export async function isStaff() {
  const user = await getUser();
  if (!user) return false;
  const { data, error } = await sb.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (error || !data) return false;
  return data.role === 'staff' || data.role === 'admin';
}
