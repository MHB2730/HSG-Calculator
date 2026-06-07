-- =====================================================================
-- HSG Portal — Stage 2b (part 2): enforce staff 2FA (MFA) + auth hardening
-- Apply in the HSG Supabase project (gdbdcyqafhobzboumyrf) — NOT Trailtether.
--
-- ORDER MATTERS: deploy the matching portal code FIRST (it adds the 2FA
-- enrol/verify screens), THEN run this. Otherwise staff sign in but hit empty
-- data instead of being guided to set up their authenticator.
--
-- What this does:
--   1. Gates ALL matter/milestone/lead access on a 2FA-verified session (AAL2),
--      so a stolen staff password returns NOTHING without the authenticator code.
--   2. Blocks privilege escalation: a signed-in user can never change their own
--      role (e.g. agent -> staff/admin).
--   3. Pins search_path on the updated_at trigger function (lint hardening).
-- =====================================================================

-- 1. Staff access now also requires AAL2 (password + a verified 2FA code).
--    aal2 is present in the JWT only after the authenticator code is verified.
create or replace function public.is_staff_aal2() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff()
     and coalesce((auth.jwt() ->> 'aal'), 'aal1') = 'aal2';
$$;

-- 2. Re-point the data policies at the 2FA-gated check.
drop policy if exists "matters read"  on public.matters;
drop policy if exists "matters write" on public.matters;
create policy "matters read"  on public.matters for select using (public.is_staff_aal2() or agent_id = auth.uid());
create policy "matters write" on public.matters for all     using (public.is_staff_aal2()) with check (public.is_staff_aal2());

drop policy if exists "milestones read"  on public.milestones;
drop policy if exists "milestones write" on public.milestones;
create policy "milestones read" on public.milestones for select using (
  exists (select 1 from public.matters m where m.id = matter_id and (public.is_staff_aal2() or m.agent_id = auth.uid())));
create policy "milestones write" on public.milestones for all using (public.is_staff_aal2()) with check (public.is_staff_aal2());

drop policy if exists "leads read"   on public.leads;
drop policy if exists "leads update" on public.leads;
create policy "leads read"   on public.leads for select using (public.is_staff_aal2());
create policy "leads update" on public.leads for update using (public.is_staff_aal2());

-- 3. Prevent role self-escalation. Roles are set only by the signup trigger or an
--    admin via SQL — never by the client. If a signed-in user tries to change
--    their own role in an UPDATE, silently keep the existing value.
create or replace function public.guard_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'authenticated' and new.role is distinct from old.role then
    new.role := old.role;
  end if;
  return new;
end; $$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- 4. Harden the updated_at trigger function (pin search_path).
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end; $$;
