-- =====================================================================
-- HSG Portal — hardening 0008: lock maintenance/erasure functions to the right callers
-- Apply in the HSG Supabase project (gdbdcyqafhobzboumyrf) — NOT Trailtether.
--
-- Postgres grants EXECUTE on new functions to PUBLIC by default, and `anon` is a
-- member of PUBLIC — so revoking from anon/authenticated alone isn't enough.
-- This revokes the PUBLIC grant so:
--   * purge_stale_leads()  -> callable only by the scheduled job (pg_cron/owner), not the API.
--   * erase_data_subject() -> callable only by signed-in (authenticated) staff; the
--                             is_staff_aal2() check inside still gates the actual erase.
-- =====================================================================

revoke all on function public.purge_stale_leads() from public, anon, authenticated;

revoke all on function public.erase_data_subject(text, text) from public, anon, authenticated;
grant execute on function public.erase_data_subject(text, text) to authenticated;
