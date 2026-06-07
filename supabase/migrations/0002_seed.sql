-- HSG Portal — demo seed: 3 matters + their milestones, so the LIVE tracker has
-- data to show immediately. Safe to re-run (existing references are skipped).
do $$
declare
  stages text[] := array['offer','appointed','bond','fica','clearance','signed','duty','lodged','registered'];
  mid uuid;
  i int;
  s record;
begin
  for s in
    select * from (values
      ('HSG-2026-0042','Naidoo','A. Naidoo','12 Oak Avenue, Ballito',          2450000::numeric, 'Karl Hoffman', 'We are awaiting the rates clearance figures from the municipality — expected by ~14 June.', 5),
      ('HSG-2026-0108','Botha', 'J & R Botha','Unit 4, The Vines, Stellenbosch',1875000::numeric, 'Tess Coetzee', 'Lodged at the Deeds Office — registration usually follows within 7–10 working days.', 8),
      ('HSG-2026-0151','Khumalo','S. Khumalo','8 Marine Drive, Umhlanga',       3200000::numeric, 'Warda Jones',  'Your offer is accepted — we are being appointed as the transferring attorneys and will contact you shortly.', 2)
    ) as t(ref, surname, buyer, prop, price, conv, note, cur)
  loop
    mid := null;
    insert into public.matters (reference, buyer_surname, buyer_name, property, price, conveyancer, current_note, status)
    values (s.ref, s.surname, s.buyer, s.prop, s.price, s.conv, s.note, 'active')
    on conflict (reference) do nothing
    returning id into mid;

    if mid is not null then
      for i in 1..9 loop
        insert into public.milestones (matter_id, stage_key, ord, state)
        values (mid, stages[i], i,
          (case when i < s.cur then 'done' when i = s.cur then 'current' else 'upcoming' end)::milestone_state);
      end loop;
    end if;
  end loop;
end $$;
