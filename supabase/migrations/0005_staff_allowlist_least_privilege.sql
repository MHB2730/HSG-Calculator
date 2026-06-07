-- =====================================================================
-- HSG Portal — hardening 0005: allow-listed staff role + least-privilege writes
-- Apply in the HSG Supabase project (gdbdcyqafhobzboumyrf) — NOT Trailtether.
--
-- Why:
--  * 0003 granted 'staff' to ANY @hsgattorneys.co.za / @hsginc.co.za email STRING.
--    With public sign-ups off that is safe today, but it's a latent escalation:
--    the instant sign-ups were ever enabled, anyone could register that domain and
--    become staff. This pins staff to an explicit, admin-controlled allow-list.
--  * The matters/milestones write policy was a single coarse "FOR ALL"; this splits
--    it so only an ADMIN can DELETE a matter (staff can still create/update).
--
-- ONBOARDING A NEW STAFF MEMBER from now on (do these in order):
--   1) insert into public.staff_allowlist (email) values ('newperson@hsginc.co.za');
--   2) Supabase Dashboard > Authentication > Users > Add user (same email).
-- (Existing staff are seeded automatically below, so nobody is locked out.)
-- =====================================================================

-- 1. Admin-controlled allow-list of who may be staff.
create table if not exists public.staff_allowlist (
  email     text primary key,
  added_at  timestamptz not null default now(),
  note      text
);
alter table public.staff_allowlist enable row level security;
drop policy if exists "staff_allowlist staff manage" on public.staff_allowlist;
create policy "staff_allowlist staff manage" on public.staff_allowlist
  for all using (public.is_staff()) with check (public.is_staff());

-- Seed it with the staff who exist today (firm-domain accounts) so none are lost.
insert into public.staff_allowlist (email)
select lower(u.email) from auth.users u
where lower(split_part(coalesce(u.email,''),'@',2)) in ('hsgattorneys.co.za','hsginc.co.za')
on conflict (email) do nothing;

-- 2. New users are 'staff' ONLY if explicitly allow-listed; everyone else 'agent'.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare assigned user_role := 'agent';
begin
  if exists (select 1 from public.staff_allowlist a where a.email = lower(coalesce(new.email,''))) then
    assigned := 'staff';
  end if;
  insert into public.profiles (id, role, full_name)
  values (new.id, assigned, coalesce(new.raw_user_meta_data ->> 'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end; $$;

-- 3. Least privilege: split the coarse FOR ALL write policy; only ADMINS may DELETE.
create or replace function public.is_admin_aal2() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
     and coalesce((auth.jwt() ->> 'aal'), 'aal1') = 'aal2';
$$;

drop policy if exists "matters write" on public.matters;
create policy "matters insert" on public.matters for insert with check (public.is_staff_aal2());
create policy "matters update" on public.matters for update using (public.is_staff_aal2()) with check (public.is_staff_aal2());
create policy "matters delete" on public.matters for delete using (public.is_admin_aal2());

drop policy if exists "milestones write" on public.milestones;
create policy "milestones insert" on public.milestones for insert with check (public.is_staff_aal2());
create policy "milestones update" on public.milestones for update using (public.is_staff_aal2()) with check (public.is_staff_aal2());
create policy "milestones delete" on public.milestones for delete using (public.is_admin_aal2());

-- To let someone delete matters from the app later, make them an admin:
--   update public.profiles set role='admin'
--   where id = (select id from auth.users where lower(email)='you@hsginc.co.za');
