-- =====================================================================
-- HSG Portal — hardening 0006: rate-limit + audit-log + data-minimise client_lookup
-- Apply in the HSG Supabase project (gdbdcyqafhobzboumyrf) — NOT Trailtether.
--
-- The public client_lookup RPC is the ONLY externally-reachable PII surface.
-- This migration:
--   1. Throttles it per-IP (defence-in-depth against reference brute-forcing).
--   2. Logs every lookup to an append-only audit table (so a breach can be scoped
--      and reported under POPIA s22 — surname is HASHED, never stored raw).
--   3. Stops returning the PRICE to anonymous callers (data minimisation; the
--      client already knows their own price).
-- For go-live with real client data, ALSO add Cloudflare Turnstile in front and/or
-- switch to an unguessable per-matter token (see the security notes).
-- =====================================================================

create extension if not exists pgcrypto;

-- 1. Append-only access log. Only SECURITY DEFINER functions write; staff(AAL2) read.
create table if not exists public.access_log (
  id           bigint generated always as identity primary key,
  at           timestamptz not null default now(),
  actor        uuid,
  action       text not null,
  reference    text,
  surname_hash text,
  found        boolean,
  ip           text
);
alter table public.access_log enable row level security;
create index if not exists access_log_at_idx on public.access_log (at desc);
drop policy if exists "access_log staff read" on public.access_log;
create policy "access_log staff read" on public.access_log for select using (public.is_staff_aal2());

-- 2. Per-IP/per-minute throttle counters (touched only by the definer function).
create table if not exists public.lookup_attempts (
  ip_hash      text not null,
  window_start timestamptz not null,
  count        int not null default 0,
  primary key (ip_hash, window_start)
);
alter table public.lookup_attempts enable row level security;

-- 3. Hardened client_lookup. VOLATILE (it now writes), throttled, audited, minimised.
create or replace function public.client_lookup(p_reference text, p_surname text)
returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  m public.matters%rowtype;
  result jsonb;
  v_found boolean := false;
  v_ip text;
  v_hash text;
  v_window timestamptz := date_trunc('minute', now());
  v_count int;
begin
  -- Enumeration guard: ignore too-short inputs (return nothing, silently).
  if length(trim(coalesce(p_reference,''))) < 6 or length(trim(coalesce(p_surname,''))) < 2 then
    return null;
  end if;

  -- Best-effort per-IP throttle (max 20 lookups/IP/minute). Fully wrapped so ANY
  -- failure here — IP read, digest, insert — silently skips throttling and never
  -- breaks the client's lookup.
  begin
    v_ip := split_part(coalesce(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for',''), ',', 1);
    v_hash := encode(digest(coalesce(nullif(v_ip,''),'unknown') || '|hsg-lookup', 'sha256'), 'hex');
    insert into public.lookup_attempts(ip_hash, window_start, count) values (v_hash, v_window, 1)
      on conflict (ip_hash, window_start) do update set count = lookup_attempts.count + 1
      returning count into v_count;
    if v_count > 20 then
      begin
        insert into public.access_log(actor, action, reference, found, ip)
          values (auth.uid(), 'client_lookup_throttled', trim(p_reference), false, v_ip);
      exception when others then null; end;
      return null;
    end if;
  exception when others then null; end;

  select * into m from public.matters
    where lower(reference) = lower(trim(p_reference))
      and lower(buyer_surname) = lower(trim(p_surname)) limit 1;
  v_found := found;

  -- Audit every attempt; never let a log failure break the lookup. Surname is hashed.
  begin
    insert into public.access_log(actor, action, reference, surname_hash, found, ip)
      values (auth.uid(), 'client_lookup', trim(p_reference),
              encode(digest(lower(trim(p_surname)),'sha256'),'hex'), v_found, v_ip);
  exception when others then null; end;

  if not v_found then return null; end if;

  -- Data minimisation: do NOT disclose the PRICE to an anonymous caller.
  select jsonb_build_object(
    'reference',   m.reference,
    'buyerName',   m.buyer_name,
    'property',    m.property,
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

-- Housekeeping: old throttle windows can be cleared any time, e.g. via pg_cron:
--   delete from public.lookup_attempts where window_start < now() - interval '1 day';
