-- Synthetic local/demo clinic only. Do not put real patient data in this file.
insert into public.clinics (clinic_id, name, timezone)
values (
  '11111111-1111-4111-8111-111111111111'::uuid,
  'Demo Women''s Clinic',
  'Asia/Kuala_Lumpur'
)
on conflict (clinic_id) do update
set name = excluded.name,
    timezone = excluded.timezone;
