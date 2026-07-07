-- =====================================================================
-- HSG Portal — hardening 0009: close three residual PII / privilege gaps
-- Apply in the HSG Supabase project (gdbdcyqafhobzboumyrf) — NOT Trailtether.
--
-- Found in the 2026-07 adversarial audit. Each is a defence-in-depth gap that
-- only bites once real client data (and more than one staff account) is live:
--
--   1. staff_allowlist was writable by ANY staff (is_staff, not even AAL2) — a
--      lateral self-service path to seed new staff accounts. Lock writes to
--      admins at AAL2; keep read at staff-AAL2.
--   2. "profile self read" exposed the WHOLE staff/agent roster (names, phones,
--      roles) to any staff session at aal1 (stolen password, no 2FA). Gate the
--      staff branch on AAL2 so it matches the rest of the model.
--   3. Role self-escalation: profiles allowed a client INSERT with no restriction
--      on `role`, and the escalation guard was UPDATE-only. Add an INSERT guard
--      that pins client-inserted rows to 'agent'. The signup trigger (which runs
--      as a definer, not as 'authenticated') is unaffected, so allow-listed staff
--      are still provisioned correctly.
--   4. POPIA erasure (0007) deleted the matter + leads but left the reference and
--      a reversible surname_hash in access_log. Scrub those on erasure so a
--      "delete my data" request is actually complete.
--
-- Nothing in the portal app reads staff_allowlist / access_log / erase_data_subject
-- directly (onboarding + erasure are SQL/Dashboard operations), so tightening
-- these policies does not change any app behaviour.
-- =====================================================================

-- 1. staff_allowlist: admin(AAL2) may write; staff(AAL2) may read. --------------
drop policy if exists "staff_allowlist staff manage" on public.staff_allowlist;
drop policy if exists "staff_allowlist admin write"  on public.staff_allowlist;
drop policy if exists "staff_allowlist staff read"   on public.staff_allowlist;
create policy "staff_allowlist staff read" on public.staff_allowlist
  for select using (public.is_staff_aal2());
create policy "staff_allowlist admin write" on public.staff_allowlist
  for all using (public.is_admin_aal2()) with check (public.is_admin_aal2());

-- 2. profiles: staff may read the roster only with a 2FA-verified session. -------
drop policy if exists "profile self read" on public.profiles;
create policy "profile self read" on public.profiles
  for select using (id = auth.uid() or public.is_staff_aal2());

-- 3. Block role self-assignment on INSERT (the UPDATE path is already guarded by
--    guard_profile_role in 0004). A client session (auth.role() = 'authenticated')
--    can only ever create its own row as 'agent'; the signup trigger, which runs
--    under a definer/service context, is not 'authenticated' and so is untouched.
create or replace function public.guard_profile_insert_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'authenticated' then
    new.role := 'agent';
  end if;
  return new;
end; $$;

drop trigger if exists profiles_guard_insert_role on public.profiles;
create trigger profiles_guard_insert_role
  before insert on public.profiles
  for each row execute function public.guard_profile_insert_role();

-- 4. Make POPIA erasure also scrub the audit log for the erased reference. --------
create or replace function public.erase_data_subject(p_reference text default null, p_email text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_matter uuid; v_leads int; v_logs int := 0;
begin
  if not public.is_staff_aal2() then raise exception 'not authorised'; end if;
  if coalesce(p_reference,'') = '' and coalesce(p_email,'') = '' then
    raise exception 'reference or email required';
  end if;
  select id into v_matter from public.matters where lower(reference) = lower(trim(p_reference)) limit 1;
  if v_matter is not null then delete from public.matters where id = v_matter; end if;  -- milestones cascade
  v_leads := (select count(*) from public.leads where p_email is not null and lower(email) = lower(trim(p_email)));
  delete from public.leads where p_email is not null and lower(email) = lower(trim(p_email));

  -- Scrub the reversible identifiers (plaintext reference, low-entropy surname hash)
  -- from the append-only access log so the erasure leaves no recoverable PII trail.
  if coalesce(p_reference,'') <> '' then
    with scrubbed as (
      update public.access_log
         set reference = null, surname_hash = null
       where reference is not null and lower(reference) = lower(trim(p_reference))
       returning 1)
    select count(*) into v_logs from scrubbed;
  end if;

  insert into public.erasure_log(subject_ref, subject_email, detail)
    values (p_reference, p_email, jsonb_build_object(
      'matter_deleted', v_matter is not null, 'leads_deleted', v_leads, 'access_log_scrubbed', v_logs));
  return jsonb_build_object(
    'matter_deleted', v_matter is not null, 'leads_deleted', v_leads, 'access_log_scrubbed', v_logs);
end; $$;

-- Re-assert the 0008 grant lockdown (CREATE OR REPLACE keeps ACLs, but be explicit).
revoke all on function public.erase_data_subject(text, text) from public, anon, authenticated;
grant execute on function public.erase_data_subject(text, text) to authenticated;
