/*
 * portal/supabase.js — the Supabase client for the live portal.
 *
 * The anon key is PUBLIC by design (it ships inside the app); the database's
 * Row-Level Security rules do the real protecting. The secret service_role key
 * is NEVER placed here. `@supabase/supabase-js` is self-hosted (js/lib/supabase.js,
 * loaded as a classic <script>) so it works under the strict CSP and offline.
 */
const SUPABASE_URL = 'https://gdbdcyqafhobzboumyrf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkYmRjeXFhZmhvYnpib3VteXJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3OTQzNTYsImV4cCI6MjA5NjM3MDM1Nn0.i8jHdPWJ9FjYdk9r3LODQfP9PROalPwqCgL7bB3Kw8g';

export const sb = (typeof window !== 'undefined' && window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
