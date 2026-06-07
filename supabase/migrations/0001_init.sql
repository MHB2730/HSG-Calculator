-- =====================================================================
-- HSG Portal — Stage 2a core schema
-- Apply in the NEW, SEPARATE HSG Supabase project (NOT the Trailtether one).
-- Covers: profiles (agents/staff), matters, milestones, leads, RLS, and the
-- public client_lookup RPC (reference + surname). Documents / OTP / push come
-- in a later migration (Stage 2b).
-- =====================================================================

create type matter_status   as enum ('active','registered','cancelled');
create type milestone_state as enum ('done','current','upcoming');
create type user_role       as enum ('agent','staff','admin');

-- ---- profiles: agents + staff. (Clients have NO account.) ----
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       user_role not null default 'agent',
  full_name  text,
  agency     text,
  phone      text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Is the current user staff/admin?
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.role in ('staff','admin'));
$$;

create policy "profile self read"   on public.profiles for select using (id = auth.uid() or public.is_staff());
create policy "profile self insert" on public.profiles for insert with check (id = auth.uid());
create policy "profile self update" on public.profiles for update using (id = auth.uid());

-- ---- matters ----
create table public.matters (
  id             uuid primary key default gen_random_uuid(),
  reference      text unique not null,
  buyer_name     text,
  buyer_surname  text not null,
  seller_surname text,
  property       text,
  price          numeric,
  conveyancer    text,
  agent_id       uuid references public.profiles(id),
  current_note   text,
  status         matter_status not null default 'active',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table public.matters enable row level security;
create index matters_agent_idx on public.matters (agent_id);
create unique index matters_reference_lower_idx on public.matters (lower(reference));

create policy "matters read"  on public.matters for select using (public.is_staff() or agent_id = auth.uid());
create policy "matters write" on public.matters for all     using (public.is_staff()) with check (public.is_staff());

-- ---- milestones (one row per stage, per matter) ----
create table public.milestones (
  id            uuid primary key default gen_random_uuid(),
  matter_id     uuid not null references public.matters(id) on delete cascade,
  stage_key     text not null,            -- matches STAGES keys in portal/data.js
  ord           int  not null,
  state         milestone_state not null default 'upcoming',
  date_done     date,
  expected_date text,
  note          text,
  unique (matter_id, stage_key)
);
alter table public.milestones enable row level security;
create index milestones_matter_idx on public.milestones (matter_id);

create policy "milestones read" on public.milestones for select using (
  exists (select 1 from public.matters m where m.id = matter_id and (public.is_staff() or m.agent_id = auth.uid())));
create policy "milestones write" on public.milestones for all using (public.is_staff()) with check (public.is_staff());

-- ---- leads (from the Stage-1 quote form) ----
create table public.leads (
  id         uuid primary key default gen_random_uuid(),
  name       text,
  phone      text,
  email      text,
  scenario   text,
  figure     numeric,
  status     text not null default 'new',
  created_at timestamptz not null default now()
);
alter table public.leads enable row level security;
create policy "leads read"   on public.leads for select using (public.is_staff());
create policy "leads update" on public.leads for update using (public.is_staff());
-- (inserts are done by the lead-intake edge function using the service role)

-- ---- CLIENT LOOKUP: reference + surname -> progress (no login) ----
-- SECURITY DEFINER so anon can call it, but it returns ONLY the one matching
-- matter. It never exposes the tables directly and never returns documents.
create or replace function public.client_lookup(p_reference text, p_surname text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare m public.matters%rowtype; result jsonb;
begin
  -- Enumeration guard: ignore too-short inputs and return nothing silently.
  -- (For hard protection, put edge rate-limiting / a CAPTCHA in front of this RPC.)
  if length(trim(coalesce(p_reference, ''))) < 6 or length(trim(coalesce(p_surname, ''))) < 2 then
    return null;
  end if;
  select * into m from public.matters
   where lower(reference)     = lower(trim(p_reference))
     and lower(buyer_surname) = lower(trim(p_surname))
   limit 1;
  if not found then return null; end if;

  select jsonb_build_object(
    'reference',   m.reference,
    'buyerName',   m.buyer_name,
    'property',    m.property,
    'price',       m.price,
    'conveyancer', m.conveyancer,
    'currentNote', m.current_note,
    'milestones',  coalesce((
      select jsonb_agg(jsonb_build_object(
               'key',   ms.stage_key,
               'state', ms.state,
               'date',  coalesce(to_char(ms.date_done,'YYYY-MM-DD'), ms.expected_date),
               'note',  ms.note
             ) order by ms.ord)
      from public.milestones ms where ms.matter_id = m.id), '[]'::jsonb)
  ) into result;
  return result;
end; $$;

grant execute on function public.client_lookup(text, text) to anon, authenticated;
