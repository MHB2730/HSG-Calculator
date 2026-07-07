/*
 * Copyright (c) 2026 HSG Attorneys Incorporated. All rights reserved.
 * Part of HSG Calculator. Unauthorised copying, modification or distribution is prohibited.
 */
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

// ---- Two-factor (TOTP authenticator app) ----
// AAL = Authenticator Assurance Level. aal1 = password only; aal2 = password + a
// verified 2FA code this session. The database (is_staff_aal2) only releases
// matter data at aal2, so 2FA is enforced at the backend, not just the screen.
export async function getAAL() {
  if (!sb) return { currentLevel: 'aal1', nextLevel: 'aal1' };
  const { data, error } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return { currentLevel: 'aal1', nextLevel: 'aal1' };
  return data;
}

export async function listTotpFactors() {
  const { data, error } = await sb.auth.mfa.listFactors();
  if (error || !data) return [];
  return data.totp || [];
}

// Best-effort: remove stray UNVERIFIED factors so a fresh enrol starts clean.
export async function unenrollUnverified() {
  try {
    const { data } = await sb.auth.mfa.listFactors();
    const all = (data && data.all) || [];
    for (const f of all) {
      if (f.status !== 'verified') { try { await sb.auth.mfa.unenroll({ factorId: f.id }); } catch { /* ignore */ } }
    }
  } catch { /* ignore */ }
}

// Start enrolment → returns a QR (svg data-url) + manual secret for the app.
export async function enrollTotp() {
  const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp' });
  if (error || !data) return { error: error || { message: 'Could not start 2FA setup.' } };
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri };
}

// Verify a code against a specific factor (used to finish enrolment → steps to aal2).
export async function verifyTotp(factorId, code) {
  const ch = await sb.auth.mfa.challenge({ factorId });
  if (ch.error) return { error: ch.error };
  const { error } = await sb.auth.mfa.verify({ factorId, challengeId: ch.data.id, code: String(code || '').trim() });
  return { error: error || null };
}

// Verify against the existing verified factor (returning user, each login → aal2).
export async function challengeExisting(code) {
  const factors = await listTotpFactors();
  const f = factors[0];
  if (!f) return { error: { message: 'No authenticator is set up for this account.' } };
  return verifyTotp(f.id, code);
}
