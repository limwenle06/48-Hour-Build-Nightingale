begin;

alter table public.lead_sessions
  add column attribution_identity_level text;

update public.lead_sessions
   set attribution_identity_level = identity_level;

alter table public.lead_sessions
  alter column attribution_identity_level set not null;

alter table public.lead_sessions
  add constraint lead_sessions_attribution_identity_level_check
  check (
    attribution_identity_level in (
      'anonymous',
      'social_handle',
      'contact_provided',
      'verified'
    )
  );

create unique index funnel_events_single_stage_per_lead_idx
  on public.funnel_events (lead_session_id, event_name)
  where lead_session_id is not null
    and event_name in (
      'visitor',
      'conversation_started',
      'auth_started',
      'consented',
      'patient_created'
    );

create function public.ensure_patient_identity(
  p_auth_user_id uuid,
  p_verified_email text,
  p_phone text,
  p_clinic_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  authenticated_email text;
  authenticated_email_confirmed_at timestamptz;
  app_user public.users%rowtype;
  patient_row public.patients%rowtype;
begin
  select auth_user.email, auth_user.email_confirmed_at
    into authenticated_email, authenticated_email_confirmed_at
    from auth.users as auth_user
   where auth_user.id = p_auth_user_id;

  if authenticated_email is null
     or authenticated_email_confirmed_at is null
     or lower(authenticated_email) <> lower(btrim(p_verified_email)) then
    raise exception 'verified Supabase identity is required'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.clinics as clinic where clinic.clinic_id = p_clinic_id
  ) then
    raise exception 'clinic was not found'
      using errcode = '23503';
  end if;

  select *
    into app_user
    from public.users as existing_user
   where existing_user.auth_user_id = p_auth_user_id
   for update;

  if app_user.user_id is not null and app_user.role <> 'patient' then
    raise exception 'staff accounts cannot be converted into patient accounts'
      using errcode = '42501';
  end if;

  if app_user.user_id is null then
    insert into public.users (
      auth_user_id,
      role,
      verified_email,
      phone
    ) values (
      p_auth_user_id,
      'patient',
      authenticated_email,
      nullif(btrim(p_phone), '')
    )
    returning * into app_user;
  else
    update public.users
       set verified_email = authenticated_email,
           phone = coalesce(nullif(btrim(p_phone), ''), phone)
     where user_id = app_user.user_id
    returning * into app_user;
  end if;

  insert into public.patients (user_id, clinic_id)
  values (app_user.user_id, p_clinic_id)
  on conflict (user_id, clinic_id) do nothing;

  select *
    into patient_row
    from public.patients as patient
   where patient.user_id = app_user.user_id
     and patient.clinic_id = p_clinic_id;

  return jsonb_build_object(
    'user', to_jsonb(app_user),
    'patient', to_jsonb(patient_row)
  );
end;
$$;

create function public.record_patient_consent(
  p_auth_user_id uuid,
  p_clinic_id uuid,
  p_consent_type text,
  p_status text,
  p_policy_version text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  patient_row public.patients%rowtype;
  consent_row public.consents%rowtype;
begin
  select patient.*
    into patient_row
    from public.users as app_user
    join public.patients as patient on patient.user_id = app_user.user_id
    join auth.users as auth_user on auth_user.id = app_user.auth_user_id
   where app_user.auth_user_id = p_auth_user_id
     and app_user.role = 'patient'
     and patient.clinic_id = p_clinic_id
     and auth_user.email_confirmed_at is not null;

  if patient_row.patient_id is null then
    raise exception 'verified clinic-scoped patient identity is required'
      using errcode = '42501';
  end if;

  insert into public.consents (
    patient_id,
    clinic_id,
    consent_type,
    status,
    policy_version,
    granted_at,
    revoked_at
  ) values (
    patient_row.patient_id,
    patient_row.clinic_id,
    p_consent_type,
    p_status,
    p_policy_version,
    case when p_status = 'granted' then now() else null end,
    case when p_status = 'revoked' then now() else null end
  )
  returning * into consent_row;

  return jsonb_build_object('consent', to_jsonb(consent_row));
end;
$$;

create function public.convert_lead_session(
  p_auth_user_id uuid,
  p_lead_session_id uuid,
  p_health_consent_id uuid,
  p_recovery_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  lead_row public.lead_sessions%rowtype;
  patient_row public.patients%rowtype;
  patient_session_row public.patient_sessions%rowtype;
  consent_row public.consents%rowtype;
  source_message_ids uuid[];
  attribution_snapshot jsonb;
  patient_session_payload jsonb;
begin
  if char_length(p_recovery_token_hash) <> 64
     or p_recovery_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid recovery credential'
      using errcode = '42501';
  end if;

  select *
    into lead_row
    from public.lead_sessions as lead
   where lead.lead_session_id = p_lead_session_id
     and lead.recovery_token_hash = p_recovery_token_hash
   for update;

  if lead_row.lead_session_id is null
     or lead_row.recovery_expires_at <= now()
     or lead_row.status = 'expired' then
    raise exception 'guest recovery credential is unavailable'
      using errcode = '42501';
  end if;

  select patient.*
    into patient_row
    from public.users as app_user
    join public.patients as patient on patient.user_id = app_user.user_id
    join auth.users as auth_user on auth_user.id = app_user.auth_user_id
   where app_user.auth_user_id = p_auth_user_id
     and app_user.role = 'patient'
     and patient.clinic_id = lead_row.clinic_id
     and auth_user.email_confirmed_at is not null;

  if patient_row.patient_id is null then
    raise exception 'patient identity does not match the guest clinic'
      using errcode = '42501';
  end if;

  select *
    into consent_row
    from public.consents as consent
   where consent.patient_id = patient_row.patient_id
     and consent.clinic_id = lead_row.clinic_id
     and consent.consent_type = 'health_data_sharing'
   order by consent.created_at desc, consent.consent_id desc
   limit 1;

  if consent_row.consent_id is null
     or consent_row.consent_id <> p_health_consent_id
     or consent_row.status <> 'granted' then
    raise exception 'current healthcare consent is required'
      using errcode = '42501';
  end if;

  if lead_row.status = 'converted' then
    if lead_row.converted_patient_id <> patient_row.patient_id then
      raise exception 'guest session was converted by a different patient'
        using errcode = '42501';
    end if;

    select *
      into patient_session_row
      from public.patient_sessions as patient_session
     where patient_session.patient_session_id = lead_row.converted_patient_session_id;
  elsif lead_row.status in ('active', 'auth_started') then
    insert into public.patient_sessions (
      patient_id,
      clinic_id,
      source_lead_session_id,
      source_channel,
      source_platform,
      campaign_id,
      creative,
      identity_level,
      landing_timestamp
    ) values (
      patient_row.patient_id,
      lead_row.clinic_id,
      lead_row.lead_session_id,
      lead_row.source_channel,
      lead_row.source_platform,
      lead_row.campaign_id,
      lead_row.creative,
      lead_row.attribution_identity_level,
      lead_row.landing_timestamp
    )
    returning * into patient_session_row;

    update public.lead_sessions
       set status = 'converted',
           identity_level = 'verified',
           converted_patient_id = patient_row.patient_id,
           converted_patient_session_id = patient_session_row.patient_session_id
     where lead_session_id = lead_row.lead_session_id;

    if lead_row.staff_referral_id is not null then
      update public.staff_referrals
         set status = 'converted'
       where staff_referral_id = lead_row.staff_referral_id
         and status = 'active';
    end if;

    insert into public.funnel_events (
      clinic_id,
      event_name,
      lead_session_id,
      patient_id,
      patient_session_id,
      source_channel,
      campaign_id,
      metadata
    ) values (
      lead_row.clinic_id,
      'patient_created',
      lead_row.lead_session_id,
      patient_row.patient_id,
      patient_session_row.patient_session_id,
      lead_row.source_channel,
      lead_row.campaign_id,
      '{}'::jsonb
    );
  else
    raise exception 'guest session cannot be converted from its current state'
      using errcode = '23514';
  end if;

  select coalesce(
    array_agg(message.message_id order by message.created_at, message.message_id),
    array[]::uuid[]
  )
    into source_message_ids
    from public.messages as message
   where message.session_type = 'lead'
     and message.session_id = lead_row.lead_session_id
     and message.sender_type = 'guest';

  attribution_snapshot := jsonb_build_object(
    'clinic_id', lead_row.clinic_id,
    'source_channel', lead_row.source_channel,
    'source_platform', lead_row.source_platform,
    'campaign_id', lead_row.campaign_id,
    'creative', lead_row.creative,
    'identity_level', lead_row.attribution_identity_level,
    'landing_timestamp', lead_row.landing_timestamp
  );

  patient_session_payload := jsonb_build_object(
    'patient_session_id', patient_session_row.patient_session_id,
    'patient_id', patient_session_row.patient_id,
    'clinic_id', patient_session_row.clinic_id,
    'source_lead_session_id', patient_session_row.source_lead_session_id,
    'attribution', attribution_snapshot,
    'started_at', patient_session_row.started_at,
    'ended_at', patient_session_row.ended_at,
    'created_at', patient_session_row.created_at,
    'updated_at', patient_session_row.updated_at
  );

  return jsonb_build_object(
    'patient', to_jsonb(patient_row),
    'patient_session', patient_session_payload,
    'source_message_ids', to_jsonb(source_message_ids),
    'attribution', attribution_snapshot
  );
end;
$$;

revoke all on function public.ensure_patient_identity(uuid, text, text, uuid)
from public, anon, authenticated;
revoke all on function public.record_patient_consent(uuid, uuid, text, text, text)
from public, anon, authenticated;
revoke all on function public.convert_lead_session(uuid, uuid, uuid, text)
from public, anon, authenticated;

grant execute on function public.ensure_patient_identity(uuid, text, text, uuid)
to service_role;
grant execute on function public.record_patient_consent(uuid, uuid, text, text, text)
to service_role;
grant execute on function public.convert_lead_session(uuid, uuid, uuid, text)
to service_role;

comment on function public.ensure_patient_identity(uuid, text, text, uuid) is
  'Service-only verified-auth identity shell creation. Never callable by browser roles.';
comment on function public.record_patient_consent(uuid, uuid, text, text, text) is
  'Service-only append-only consent recording for a verified clinic-scoped patient.';
comment on function public.convert_lead_session(uuid, uuid, uuid, text) is
  'Service-only atomic and idempotent lead conversion with recovery, ownership, and consent checks.';

commit;
