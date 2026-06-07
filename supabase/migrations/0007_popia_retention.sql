-- =====================================================================
-- HSG Portal — hardening 0007: POPIA right-to-erasure + retention purge
-- Apply in the HSG Supabase project (gdbdcyqafhobzboumyrf) — NOT Trailtether.
-- (Go-live readiness: lets the firm honour a "delete my data" request and not keep
--  unconverted leads forever. Run before holding real client data.)
-- =====================================================================

-- Audit trail of erasures (who erased what, when) — POPIA accountability.
create table if not exists public.erasure_log (
  id            uuid primary key default gen_random_uuid(),
  subject_ref   text,
  subject_email text,
  actor         uuid default auth.uid(),
  erased_at     timestamptz not null default now(),
  detail        jsonb
);
alter table public.erasure_log enable row level security;
drop policy if exists "erasure_log staff read" on public.erasure_log;
create policy "erasure_log staff read" on public.erasure_log for select using (public.is_staff_aal2());

-- Erase a data subject by matter reference and/or lead email. Staff(AAL2) only.
create or replace function public.erase_data_subject(p_reference text default null, p_email text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_matter uuid; v_leads int;
begin
  if not public.is_staff_aal2() then raise exception 'not authorised'; end if;
  if coalesce(p_reference,'') = '' and coalesce(p_email,'') = '' then
    raise exception 'reference or email required';
  end if;
  select id into v_matter from public.matters where lower(reference) = lower(trim(p_reference)) limit 1;
  if v_matter is not null then delete from public.matters where id = v_matter; end if;  -- milestones cascade
  v_leads := (select count(*) from public.leads where p_email is not null and lower(email) = lower(trim(p_email)));
  delete from public.leads where p_email is not null and lower(email) = lower(trim(p_email));
  insert into public.erasure_log(subject_ref, subject_email, detail)
    values (p_reference, p_email, jsonb_build_object('matter_deleted', v_matter is not null, 'leads_deleted', v_leads));
  return jsonb_build_object('matter_deleted', v_matter is not null, 'leads_deleted', v_leads);
end; $$;
revoke all on function public.erase_data_subject(text, text) from anon, authenticated;
grant execute on function public.erase_data_subject(text, text) to authenticated;

-- Retention: purge unconverted leads after 12 months. (Do NOT auto-purge matters —
-- conveyancing files carry a statutory retention obligation; keep those.)
create or replace function public.purge_stale_leads()
returns void language sql security definer set search_path = public as $$
  delete from public.leads where status = 'new' and created_at < now() - interval '12 months';
$$;

-- Schedule the purge (Dashboard > Database > Extensions: enable pg_cron, then):
--   select cron.schedule('purge-stale-leads', '0 3 * * 0', $$select public.purge_stale_leads()$$);
