-- =====================================================================
-- HSG Portal — Stage 2b (part 1): staff sign-in support
-- Apply in the HSG Supabase project (gdbdcyqafhobzboumyrf) — NOT Trailtether.
--
-- What this adds:
--   1. On every new auth user, auto-create a `profiles` row. Anyone whose email
--      is on an HSG firm domain becomes 'staff' automatically; everyone else
--      defaults to 'agent' (can sign in but can't see/write matters). This means
--      you create staff simply by adding their firm-email user in the dashboard —
--      no manual role-setting, and no open public sign-ups required.
--   2. Keep matters.updated_at fresh on every edit (so the admin list sorts by
--      most-recently-touched).
--   3. A safe backfill that promotes any EXISTING firm-domain user to staff.
--
-- The matters/milestones WRITE policies (is_staff()) already exist in 0001.
-- =====================================================================

-- ---- 1. Auto-profile on sign-up; firm domains = staff ----
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  domain   text := lower(split_part(coalesce(new.email, ''), '@', 2));
  assigned user_role := 'agent';
begin
  -- HSG firm domains get staff access automatically.
  if domain in ('hsgattorneys.co.za', 'hsginc.co.za') then
    assigned := 'staff';
  end if;
  insert into public.profiles (id, role, full_name)
  values (new.id, assigned, coalesce(new.raw_user_meta_data ->> 'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---- 2. Touch updated_at on matter edits ----
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists matters_touch on public.matters;
create trigger matters_touch
  before update on public.matters
  for each row execute function public.touch_updated_at();

-- ---- 3. Backfill: make sure existing users have a profile; promote firm domains ----
insert into public.profiles (id, role, full_name)
select u.id,
       case when lower(split_part(coalesce(u.email, ''), '@', 2))
                 in ('hsgattorneys.co.za', 'hsginc.co.za')
            then 'staff'::user_role else 'agent'::user_role end,
       coalesce(u.raw_user_meta_data ->> 'full_name', u.email)
from auth.users u
on conflict (id) do nothing;

-- Promote (never demote) any firm-domain account that is still 'agent'.
update public.profiles p set role = 'staff'
from auth.users u
where u.id = p.id
  and p.role = 'agent'
  and lower(split_part(coalesce(u.email, ''), '@', 2)) in ('hsgattorneys.co.za', 'hsginc.co.za');
