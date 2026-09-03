begin;

create function public.recover_lead_session(
  p_clinic_id uuid,
  p_recovery_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  lead_row public.lead_sessions%rowtype;
  clinic_timezone text;
  recovered_messages jsonb;
begin
  if char_length(p_recovery_token_hash) <> 64
     or p_recovery_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid recovery credential'
      using errcode = '22023';
  end if;

  select clinic.timezone
    into clinic_timezone
    from public.clinics as clinic
   where clinic.clinic_id = p_clinic_id;

  if clinic_timezone is null then
    raise exception 'clinic was not found'
      using errcode = '23503';
  end if;

  update public.lead_sessions as lead
     set recovery_expires_at = now() + interval '7 days'
   where lead.clinic_id = p_clinic_id
     and lead.recovery_token_hash = p_recovery_token_hash
     and lead.status in ('active', 'auth_started')
     and lead.recovery_expires_at > now()
  returning * into lead_row;

  if lead_row.lead_session_id is null then
    return null;
  end if;

  select coalesce(
    jsonb_agg(to_jsonb(message) order by message.created_at, message.message_id),
    '[]'::jsonb
  )
    into recovered_messages
    from public.messages as message
   where message.session_type = 'lead'
     and message.session_id = lead_row.lead_session_id;

  return jsonb_build_object(
    'lead_session_id', lead_row.lead_session_id,
    'source_channel', lead_row.source_channel,
    'source_platform', lead_row.source_platform,
    'identity_level', lead_row.identity_level,
    'recovery_expires_at', lead_row.recovery_expires_at,
    'clinic_timezone', clinic_timezone,
    'recovered_messages', recovered_messages
  );
end;
$$;

create function public.create_lead_session(
  p_clinic_id uuid,
  p_source_channel text,
  p_source_platform text,
  p_campaign_id text,
  p_creative text,
  p_social_handle text,
  p_referral_token_hash text,
  p_recovery_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  lead_row public.lead_sessions%rowtype;
  referral_row public.staff_referrals%rowtype;
  clinic_timezone text;
  initial_identity_level text;
begin
  if char_length(p_recovery_token_hash) <> 64
     or p_recovery_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid recovery credential'
      using errcode = '22023';
  end if;

  select clinic.timezone
    into clinic_timezone
    from public.clinics as clinic
   where clinic.clinic_id = p_clinic_id;

  if clinic_timezone is null then
    raise exception 'clinic was not found'
      using errcode = '23503';
  end if;

  if p_referral_token_hash is not null then
    if char_length(p_referral_token_hash) <> 64
       or p_referral_token_hash !~ '^[0-9a-f]{64}$' then
      raise exception 'invalid referral credential'
        using errcode = '22023';
    end if;

    select *
      into referral_row
      from public.staff_referrals as referral
     where referral.clinic_id = p_clinic_id
       and referral.token_hash = p_referral_token_hash
       and referral.status = 'active'
       and referral.expires_at > now()
     for update;

    if referral_row.staff_referral_id is null then
      raise exception 'referral credential is unavailable'
        using errcode = '42501';
    end if;
  end if;

  if (p_source_channel = 'staff_referral') <> (p_referral_token_hash is not null) then
    raise exception 'staff referral channel and credential must match'
      using errcode = '23514';
  end if;

  initial_identity_level := case
    when p_social_handle is not null then 'social_handle'
    else 'anonymous'
  end;

  insert into public.lead_sessions (
    clinic_id,
    source_channel,
    source_platform,
    campaign_id,
    creative,
    identity_level,
    attribution_identity_level,
    landing_timestamp,
    social_handle,
    staff_referral_id,
    status,
    recovery_token_hash,
    recovery_expires_at
  ) values (
    p_clinic_id,
    p_source_channel,
    p_source_platform,
    p_campaign_id,
    p_creative,
    initial_identity_level,
    initial_identity_level,
    now(),
    p_social_handle,
    referral_row.staff_referral_id,
    'active',
    p_recovery_token_hash,
    now() + interval '7 days'
  )
  returning * into lead_row;

  insert into public.funnel_events (
    clinic_id,
    event_name,
    lead_session_id,
    source_channel,
    campaign_id,
    metadata
  ) values (
    lead_row.clinic_id,
    'visitor',
    lead_row.lead_session_id,
    lead_row.source_channel,
    lead_row.campaign_id,
    '{}'::jsonb
  );

  return jsonb_build_object(
    'lead_session_id', lead_row.lead_session_id,
    'source_channel', lead_row.source_channel,
    'source_platform', lead_row.source_platform,
    'identity_level', lead_row.identity_level,
    'recovery_expires_at', lead_row.recovery_expires_at,
    'clinic_timezone', clinic_timezone,
    'recovered_messages', '[]'::jsonb
  );
end;
$$;

create function public.append_guest_exchange(
  p_lead_session_id uuid,
  p_recovery_token_hash text,
  p_guest_content text,
  p_assistant_content text,
  p_value_type text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  lead_row public.lead_sessions%rowtype;
  guest_message public.messages%rowtype;
  assistant_message public.messages%rowtype;
  value_event public.funnel_events%rowtype;
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
     and lead.status in ('active', 'auth_started')
     and lead.recovery_expires_at > now()
   for update;

  if lead_row.lead_session_id is null then
    raise exception 'guest session is unavailable'
      using errcode = '42501';
  end if;

  insert into public.messages (
    clinic_id,
    session_type,
    session_id,
    sender_type,
    message_kind,
    content
  ) values (
    lead_row.clinic_id,
    'lead',
    lead_row.lead_session_id,
    'guest',
    'text',
    p_guest_content
  )
  returning * into guest_message;

  insert into public.messages (
    clinic_id,
    session_type,
    session_id,
    sender_type,
    message_kind,
    content
  ) values (
    lead_row.clinic_id,
    'lead',
    lead_row.lead_session_id,
    'ai',
    'text',
    p_assistant_content
  )
  returning * into assistant_message;

  insert into public.funnel_events (
    clinic_id,
    event_name,
    lead_session_id,
    source_channel,
    campaign_id,
    metadata
  ) values (
    lead_row.clinic_id,
    'conversation_started',
    lead_row.lead_session_id,
    lead_row.source_channel,
    lead_row.campaign_id,
    '{}'::jsonb
  )
  on conflict do nothing;

  if p_value_type is not null then
    insert into public.funnel_events (
      clinic_id,
      event_name,
      lead_session_id,
      source_channel,
      campaign_id,
      metadata
    ) values (
      lead_row.clinic_id,
      'value_event',
      lead_row.lead_session_id,
      lead_row.source_channel,
      lead_row.campaign_id,
      jsonb_build_object('value_type', p_value_type)
    )
    returning * into value_event;
  end if;

  update public.lead_sessions
     set recovery_expires_at = now() + interval '7 days'
   where lead_session_id = lead_row.lead_session_id;

  return jsonb_build_object(
    'guest_message', to_jsonb(guest_message),
    'assistant_message', to_jsonb(assistant_message),
    'value_event', case
      when value_event.funnel_event_id is null then null
      else to_jsonb(value_event)
    end
  );
end;
$$;

create function public.record_guest_funnel_event(
  p_lead_session_id uuid,
  p_recovery_token_hash text,
  p_event_name text,
  p_metadata jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  lead_row public.lead_sessions%rowtype;
  event_row public.funnel_events%rowtype;
begin
  if p_event_name not in ('value_event', 'auth_started') then
    raise exception 'event is server-authoritative'
      using errcode = '23514';
  end if;

  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'funnel metadata must be an object'
      using errcode = '22023';
  end if;

  select *
    into lead_row
    from public.lead_sessions as lead
   where lead.lead_session_id = p_lead_session_id
     and lead.recovery_token_hash = p_recovery_token_hash
     and lead.status in ('active', 'auth_started')
     and lead.recovery_expires_at > now()
   for update;

  if lead_row.lead_session_id is null then
    raise exception 'guest session is unavailable'
      using errcode = '42501';
  end if;

  if p_event_name = 'auth_started' then
    update public.lead_sessions
       set status = 'auth_started',
           recovery_expires_at = now() + interval '7 days'
     where lead_session_id = lead_row.lead_session_id;
  else
    update public.lead_sessions
       set recovery_expires_at = now() + interval '7 days'
     where lead_session_id = lead_row.lead_session_id;
  end if;

  insert into public.funnel_events (
    clinic_id,
    event_name,
    lead_session_id,
    source_channel,
    campaign_id,
    metadata
  ) values (
    lead_row.clinic_id,
    p_event_name,
    lead_row.lead_session_id,
    lead_row.source_channel,
    lead_row.campaign_id,
    p_metadata
  )
  on conflict do nothing
  returning * into event_row;

  if event_row.funnel_event_id is null then
    select *
      into event_row
      from public.funnel_events as funnel_event
     where funnel_event.lead_session_id = lead_row.lead_session_id
       and funnel_event.event_name = p_event_name
     order by funnel_event.occurred_at, funnel_event.funnel_event_id
     limit 1;
  end if;

  return to_jsonb(event_row);
end;
$$;

create function public.record_patient_consent_with_recovery(
  p_auth_user_id uuid,
  p_clinic_id uuid,
  p_consent_type text,
  p_status text,
  p_policy_version text,
  p_recovery_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  consent_payload jsonb;
  consent_patient_id uuid;
  lead_row public.lead_sessions%rowtype;
begin
  consent_payload := public.record_patient_consent(
    p_auth_user_id,
    p_clinic_id,
    p_consent_type,
    p_status,
    p_policy_version
  );

  if p_consent_type = 'health_data_sharing'
     and p_status = 'granted'
     and p_recovery_token_hash is not null then
    if char_length(p_recovery_token_hash) <> 64
       or p_recovery_token_hash !~ '^[0-9a-f]{64}$' then
      raise exception 'invalid recovery credential'
        using errcode = '42501';
    end if;

    select *
      into lead_row
      from public.lead_sessions as lead
     where lead.clinic_id = p_clinic_id
       and lead.recovery_token_hash = p_recovery_token_hash
       and lead.status in ('active', 'auth_started')
       and lead.recovery_expires_at > now()
     for update;

    if lead_row.lead_session_id is null then
      raise exception 'guest session is unavailable'
        using errcode = '42501';
    end if;

    consent_patient_id := (consent_payload -> 'consent' ->> 'patient_id')::uuid;

    insert into public.funnel_events (
      clinic_id,
      event_name,
      lead_session_id,
      patient_id,
      source_channel,
      campaign_id,
      metadata
    ) values (
      lead_row.clinic_id,
      'consented',
      lead_row.lead_session_id,
      consent_patient_id,
      lead_row.source_channel,
      lead_row.campaign_id,
      jsonb_build_object('consent_type', 'health_data_sharing')
    )
    on conflict do nothing;

    update public.lead_sessions
       set recovery_expires_at = now() + interval '7 days'
     where lead_session_id = lead_row.lead_session_id;
  end if;

  return consent_payload;
end;
$$;

revoke all on function public.recover_lead_session(uuid, text)
from public, anon, authenticated;
revoke all on function public.create_lead_session(uuid, text, text, text, text, text, text, text)
from public, anon, authenticated;
revoke all on function public.append_guest_exchange(uuid, text, text, text, text)
from public, anon, authenticated;
revoke all on function public.record_guest_funnel_event(uuid, text, text, jsonb)
from public, anon, authenticated;
revoke all on function public.record_patient_consent_with_recovery(uuid, uuid, text, text, text, text)
from public, anon, authenticated;

grant execute on function public.recover_lead_session(uuid, text)
to service_role;
grant execute on function public.create_lead_session(uuid, text, text, text, text, text, text, text)
to service_role;
grant execute on function public.append_guest_exchange(uuid, text, text, text, text)
to service_role;
grant execute on function public.record_guest_funnel_event(uuid, text, text, jsonb)
to service_role;
grant execute on function public.record_patient_consent_with_recovery(uuid, uuid, text, text, text, text)
to service_role;

comment on function public.recover_lead_session(uuid, text) is
  'Service-only guest recovery with a sliding seven-day expiry.';
comment on function public.create_lead_session(uuid, text, text, text, text, text, text, text) is
  'Service-only LeadSession creation with hashed recovery/referral credentials and visitor attribution.';
comment on function public.append_guest_exchange(uuid, text, text, text, text) is
  'Service-only atomic guest/assistant message persistence with conversation and value events.';
comment on function public.record_guest_funnel_event(uuid, text, text, jsonb) is
  'Service-only UI-observed guest funnel event persistence.';
comment on function public.record_patient_consent_with_recovery(uuid, uuid, text, text, text, text) is
  'Service-only atomic consent persistence with recovered LeadSession attribution.';

commit;
