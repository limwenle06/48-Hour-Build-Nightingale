begin;

create function private.require_staff_user(
  p_auth_user_id uuid,
  p_clinic_id uuid,
  p_allowed_roles text[]
)
returns public.staff_users
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  staff_row public.staff_users%rowtype;
begin
  select staff_user.*
    into staff_row
    from public.users as app_user
    join public.staff_users as staff_user on staff_user.user_id = app_user.user_id
    join auth.users as auth_user on auth_user.id = app_user.auth_user_id
   where app_user.auth_user_id = p_auth_user_id
     and app_user.role = staff_user.role
     and staff_user.clinic_id = p_clinic_id
     and staff_user.role = any(p_allowed_roles)
     and auth_user.email_confirmed_at is not null;

  if staff_row.staff_user_id is null then
    raise exception 'clinic role is not permitted'
      using errcode = '42501';
  end if;

  return staff_row;
end;
$$;

create function public.resolve_staff_identity(
  p_auth_user_id uuid,
  p_clinic_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  staff_row public.staff_users%rowtype;
begin
  staff_row := private.require_staff_user(
    p_auth_user_id,
    p_clinic_id,
    array['staff', 'nurse', 'clinician']
  );
  return to_jsonb(staff_row);
end;
$$;

create function public.load_escalation_context(
  p_auth_user_id uuid,
  p_clinic_id uuid,
  p_patient_session_id uuid,
  p_trigger_message_id uuid,
  p_risk_assessment_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  patient_row public.patients%rowtype;
  patient_session_row public.patient_sessions%rowtype;
  trigger_message_row public.messages%rowtype;
  risk_row public.risk_assessments%rowtype;
  current_consent_status text;
  profile_payload jsonb;
  attribution_payload jsonb;
begin
  select patient.*
    into patient_row
    from public.users as app_user
    join public.patients as patient on patient.user_id = app_user.user_id
    join public.patient_sessions as patient_session
      on patient_session.patient_id = patient.patient_id
     and patient_session.clinic_id = patient.clinic_id
   where app_user.auth_user_id = p_auth_user_id
     and app_user.role = 'patient'
     and patient.clinic_id = p_clinic_id
     and patient_session.patient_session_id = p_patient_session_id
     and patient_session.ended_at is null;

  if patient_row.patient_id is null then
    raise exception 'patient session is unavailable'
      using errcode = '42501';
  end if;

  select consent.status
    into current_consent_status
    from public.consents as consent
   where consent.patient_id = patient_row.patient_id
     and consent.clinic_id = p_clinic_id
     and consent.consent_type = 'health_data_sharing'
   order by consent.created_at desc, consent.consent_id desc
   limit 1;

  if current_consent_status is distinct from 'granted' then
    raise exception 'current healthcare consent is required'
      using errcode = 'NHC01';
  end if;

  select message.*
    into trigger_message_row
    from public.messages as message
   where message.message_id = p_trigger_message_id
     and message.clinic_id = p_clinic_id
     and message.session_type = 'patient'
     and message.session_id = p_patient_session_id
     and message.sender_type = 'patient';

  select risk.*
    into risk_row
    from public.risk_assessments as risk
   where risk.risk_assessment_id = p_risk_assessment_id
     and risk.patient_id = patient_row.patient_id
     and risk.patient_session_id = p_patient_session_id
     and risk.message_id = p_trigger_message_id
     and risk.escalation_required is true;

  if trigger_message_row.message_id is null or risk_row.risk_assessment_id is null then
    raise exception 'required escalation context was not found'
      using errcode = '23503';
  end if;

  select patient_session.*
    into patient_session_row
    from public.patient_sessions as patient_session
   where patient_session.patient_session_id = p_patient_session_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'memory_item_id', item.memory_item_id,
        'type', item.type,
        'value', item.value,
        'status', item.status,
        'provenance_pointer', item.provenance_pointer
      ) order by item.created_at, item.memory_item_id
    ),
    '[]'::jsonb
  )
    into profile_payload
    from public.memory_items as item
   where item.patient_id = patient_row.patient_id
     and not exists (
       select 1 from public.memory_items as later_item
        where later_item.supersedes_memory_item_id = item.memory_item_id
     );

  attribution_payload := jsonb_build_object(
    'clinic_id', patient_session_row.clinic_id,
    'source_channel', patient_session_row.source_channel,
    'source_platform', patient_session_row.source_platform,
    'campaign_id', patient_session_row.campaign_id,
    'creative', patient_session_row.creative,
    'identity_level', patient_session_row.identity_level,
    'landing_timestamp', patient_session_row.landing_timestamp
  );

  return jsonb_build_object(
    'patient_id', patient_row.patient_id,
    'patient_session_id', p_patient_session_id,
    'trigger_message_id', p_trigger_message_id,
    'raw_content', trigger_message_row.content,
    'risk', jsonb_build_object(
      'patient_id', risk_row.patient_id,
      'patient_session_id', risk_row.patient_session_id,
      'message_id', risk_row.message_id,
      'risk_level', risk_row.risk_level,
      'risk_reason', risk_row.risk_reason,
      'confidence', risk_row.confidence,
      'risk_provenance', risk_row.risk_provenance,
      'matched_rule_ids', risk_row.matched_rule_ids,
      'escalation_required', risk_row.escalation_required
    ),
    'current_profile', profile_payload,
    'attribution', attribution_payload
  );
end;
$$;

create function public.create_patient_escalation(
  p_auth_user_id uuid,
  p_clinic_id uuid,
  p_patient_session_id uuid,
  p_trigger_message_id uuid,
  p_risk_assessment_id uuid,
  p_triage_summary text[],
  p_provenance uuid[],
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  patient_row public.patients%rowtype;
  patient_session_row public.patient_sessions%rowtype;
  risk_row public.risk_assessments%rowtype;
  escalation_row public.escalations%rowtype;
  current_consent_status text;
  profile_payload jsonb;
  attribution_payload jsonb;
  risk_payload jsonb;
begin
  if cardinality(p_triage_summary) not between 1 and 5
     or cardinality(p_provenance) not between 1 and 100
     or not (p_trigger_message_id = any(p_provenance))
     or char_length(btrim(p_request_id)) not between 1 and 200 then
    raise exception 'invalid escalation result'
      using errcode = '22023';
  end if;

  select patient.*
    into patient_row
    from public.users as app_user
    join public.patients as patient on patient.user_id = app_user.user_id
    join public.patient_sessions as patient_session
      on patient_session.patient_id = patient.patient_id
     and patient_session.clinic_id = patient.clinic_id
   where app_user.auth_user_id = p_auth_user_id
     and app_user.role = 'patient'
     and patient.clinic_id = p_clinic_id
     and patient_session.patient_session_id = p_patient_session_id
     and patient_session.ended_at is null;

  if patient_row.patient_id is null then
    raise exception 'patient session is unavailable'
      using errcode = '42501';
  end if;

  select consent.status
    into current_consent_status
    from public.consents as consent
   where consent.patient_id = patient_row.patient_id
     and consent.clinic_id = p_clinic_id
     and consent.consent_type = 'health_data_sharing'
   order by consent.created_at desc, consent.consent_id desc
   limit 1;

  if current_consent_status is distinct from 'granted' then
    raise exception 'current healthcare consent is required'
      using errcode = 'NHC01';
  end if;

  select *
    into escalation_row
    from public.escalations as escalation
   where escalation.trigger_message_id = p_trigger_message_id
     and escalation.patient_id = patient_row.patient_id
     and escalation.patient_session_id = p_patient_session_id
     and escalation.risk_assessment_id = p_risk_assessment_id;

  if escalation_row.escalation_id is not null then
    return to_jsonb(escalation_row);
  end if;

  select patient_session.*
    into patient_session_row
    from public.patient_sessions as patient_session
   where patient_session.patient_session_id = p_patient_session_id
     and patient_session.patient_id = patient_row.patient_id
     and patient_session.clinic_id = p_clinic_id;

  select risk.*
    into risk_row
    from public.risk_assessments as risk
   where risk.risk_assessment_id = p_risk_assessment_id
     and risk.patient_id = patient_row.patient_id
     and risk.patient_session_id = p_patient_session_id
     and risk.message_id = p_trigger_message_id
     and risk.escalation_required is true;

  if risk_row.risk_assessment_id is null then
    raise exception 'required risk assessment was not found'
      using errcode = '23503';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'memory_item_id', item.memory_item_id,
        'type', item.type,
        'value', item.value,
        'status', item.status,
        'provenance_pointer', item.provenance_pointer
      ) order by item.created_at, item.memory_item_id
    ),
    '[]'::jsonb
  )
    into profile_payload
    from public.memory_items as item
   where item.patient_id = patient_row.patient_id
     and not exists (
       select 1 from public.memory_items as later_item
        where later_item.supersedes_memory_item_id = item.memory_item_id
     );

  attribution_payload := jsonb_build_object(
    'clinic_id', patient_session_row.clinic_id,
    'source_channel', patient_session_row.source_channel,
    'source_platform', patient_session_row.source_platform,
    'campaign_id', patient_session_row.campaign_id,
    'creative', patient_session_row.creative,
    'identity_level', patient_session_row.identity_level,
    'landing_timestamp', patient_session_row.landing_timestamp
  );
  risk_payload := jsonb_build_object(
    'risk_level', risk_row.risk_level,
    'risk_reason', risk_row.risk_reason,
    'confidence', risk_row.confidence,
    'risk_provenance', risk_row.risk_provenance,
    'escalation_required', risk_row.escalation_required
  );

  insert into public.escalations (
    clinic_id,
    patient_id,
    patient_session_id,
    trigger_message_id,
    risk_assessment_id,
    triage_summary,
    profile_snapshot,
    provenance,
    attribution,
    risk_context,
    status
  ) values (
    p_clinic_id,
    patient_row.patient_id,
    p_patient_session_id,
    p_trigger_message_id,
    p_risk_assessment_id,
    p_triage_summary,
    profile_payload,
    p_provenance,
    attribution_payload,
    risk_payload,
    'pending'
  )
  returning * into escalation_row;

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
    p_clinic_id,
    'escalation_sent',
    patient_session_row.source_lead_session_id,
    patient_row.patient_id,
    p_patient_session_id,
    patient_session_row.source_channel,
    patient_session_row.campaign_id,
    '{}'::jsonb
  );

  insert into public.audit_logs (
    clinic_id,
    actor_user_id,
    actor_role,
    event_type,
    resource_type,
    resource_id,
    outcome,
    request_id,
    metadata
  ) values (
    p_clinic_id,
    patient_row.user_id,
    'patient',
    'escalation_sent',
    'escalation',
    escalation_row.escalation_id,
    'success',
    p_request_id,
    jsonb_build_object('risk_level', risk_row.risk_level)
  );

  return to_jsonb(escalation_row);
end;
$$;

create function public.list_warm_leads(
  p_auth_user_id uuid,
  p_clinic_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  staff_row public.staff_users%rowtype;
  result_payload jsonb;
begin
  staff_row := private.require_staff_user(
    p_auth_user_id,
    p_clinic_id,
    array['staff', 'nurse', 'clinician']
  );

  with lead_activity as (
    select
      lead.*,
      referral.topic,
      greatest(
        lead.updated_at,
        coalesce(max(event.occurred_at), lead.updated_at)
      ) as last_activity_at,
      coalesce(max(case event.event_name
        when 'escalation_sent' then 7
        when 'patient_created' then 6
        when 'consented' then 5
        when 'auth_started' then 4
        when 'value_event' then 3
        when 'conversation_started' then 2
        else 1
      end), 1) as stage_rank
      from public.lead_sessions as lead
      left join public.staff_referrals as referral
        on referral.staff_referral_id = lead.staff_referral_id
      left join public.funnel_events as event
        on event.lead_session_id = lead.lead_session_id
     where lead.clinic_id = p_clinic_id
       and lead.created_at >= now() - interval '30 days'
     group by lead.lead_session_id, referral.topic
  ), scored as (
    select
      activity.*,
      least(100,
        case when activity.last_activity_at >= now() - interval '24 hours' then 25 else 10 end
        + case when activity.source_channel = 'staff_referral' then 25 else 10 end
        + case activity.identity_level
            when 'verified' then 20
            when 'contact_provided' then 20
            when 'social_handle' then 10
            else 0
          end
        + case
            when activity.stage_rank >= 4 then 30
            when activity.stage_rank = 3 then 20
            when activity.stage_rank = 2 then 10
            else 0
          end
      )::integer as warm_lead_score
      from lead_activity as activity
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'lead_session_id', scored.lead_session_id,
        'source_channel', scored.source_channel,
        'identity_level', scored.identity_level,
        'funnel_stage', case scored.stage_rank
          when 7 then 'escalation_sent'
          when 6 then 'patient_created'
          when 5 then 'consented'
          when 4 then 'auth_started'
          when 3 then 'value_event'
          when 2 then 'conversation_started'
          else 'visitor'
        end,
        'top_concern', case
          when scored.source_channel = 'staff_referral' then left(scored.topic, 160)
          else null
        end,
        'warm_lead_score', scored.warm_lead_score,
        'score_reasons',
          (case when scored.last_activity_at >= now() - interval '24 hours'
            then jsonb_build_array('Recent activity') else '[]'::jsonb end)
          || (case when scored.source_channel = 'staff_referral'
            then jsonb_build_array('Staff referral') else '[]'::jsonb end)
          || (case when scored.identity_level <> 'anonymous'
            then jsonb_build_array('Known identity level') else '[]'::jsonb end)
          || (case when scored.stage_rank >= 3
            then jsonb_build_array('Reached a value or authentication step') else '[]'::jsonb end),
        'last_activity_at', scored.last_activity_at,
        'contact_suggestion', case
          when scored.identity_level in ('contact_provided', 'verified')
            then 'Follow up using consented clinic contact details'
          else null
        end
      ) order by scored.warm_lead_score desc, scored.last_activity_at desc
    ),
    '[]'::jsonb
  )
    into result_payload
    from (select * from scored order by warm_lead_score desc, last_activity_at desc limit 100) as scored;

  return result_payload;
end;
$$;

create function public.list_staff_escalations(
  p_auth_user_id uuid,
  p_clinic_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  staff_row public.staff_users%rowtype;
  result_payload jsonb;
begin
  staff_row := private.require_staff_user(
    p_auth_user_id,
    p_clinic_id,
    array['nurse', 'clinician']
  );

  select coalesce(
    jsonb_agg(to_jsonb(escalation) order by escalation.created_at desc),
    '[]'::jsonb
  )
    into result_payload
    from public.escalations as escalation
   where escalation.clinic_id = p_clinic_id
     and private.has_current_health_consent(
       escalation.patient_id,
       escalation.clinic_id
     );

  return result_payload;
end;
$$;

create function public.create_staff_referral(
  p_auth_user_id uuid,
  p_clinic_id uuid,
  p_topic text,
  p_token_hash text,
  p_expires_in_hours integer,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  staff_row public.staff_users%rowtype;
  referral_row public.staff_referrals%rowtype;
begin
  staff_row := private.require_staff_user(
    p_auth_user_id,
    p_clinic_id,
    array['staff', 'nurse', 'clinician']
  );

  if char_length(btrim(p_topic)) not between 1 and 500
     or char_length(p_token_hash) <> 64
     or p_token_hash !~ '^[0-9a-f]{64}$'
     or p_expires_in_hours not between 1 and 168
     or char_length(btrim(p_request_id)) not between 1 and 200 then
    raise exception 'invalid staff referral input'
      using errcode = '22023';
  end if;

  insert into public.staff_referrals (
    clinic_id,
    created_by_staff_user_id,
    topic,
    token_hash,
    status,
    expires_at
  ) values (
    p_clinic_id,
    staff_row.staff_user_id,
    btrim(p_topic),
    p_token_hash,
    'active',
    now() + make_interval(hours => p_expires_in_hours)
  )
  returning * into referral_row;

  insert into public.audit_logs (
    clinic_id,
    actor_user_id,
    actor_role,
    event_type,
    resource_type,
    resource_id,
    outcome,
    request_id,
    metadata
  ) values (
    p_clinic_id,
    staff_row.user_id,
    staff_row.role,
    'staff_referral_created',
    'staff_referral',
    referral_row.staff_referral_id,
    'success',
    p_request_id,
    jsonb_build_object('expires_in_hours', p_expires_in_hours)
  );

  return to_jsonb(referral_row) - 'token_hash';
end;
$$;

create function public.get_staff_funnel_metrics(
  p_auth_user_id uuid,
  p_clinic_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  staff_row public.staff_users%rowtype;
  window_from timestamptz := now() - interval '30 days';
  window_to timestamptz := now();
  metrics_payload jsonb;
begin
  staff_row := private.require_staff_user(
    p_auth_user_id,
    p_clinic_id,
    array['staff', 'nurse', 'clinician']
  );

  with channels(source_channel) as (
    select unnest(array[
      'staff_referral',
      'social_comment',
      'instagram_ad_click',
      'website_widget'
    ]::text[])
  ), channel_counts as (
    select
      channel.source_channel,
      count(event.*) filter (where event.event_name = 'visitor') as visitors,
      count(event.*) filter (where event.event_name = 'value_event') as value_events,
      count(event.*) filter (where event.event_name = 'patient_created') as patient_conversions,
      count(event.*) filter (where event.event_name = 'escalation_sent') as escalations
      from channels as channel
      left join public.funnel_events as event
        on event.clinic_id = p_clinic_id
       and event.source_channel = channel.source_channel
       and event.occurred_at >= window_from
       and event.occurred_at <= window_to
     group by channel.source_channel
  )
  select jsonb_agg(
    jsonb_build_object(
      'source_channel', channel_count.source_channel,
      'visitors', channel_count.visitors,
      'value_events', channel_count.value_events,
      'patient_conversions', channel_count.patient_conversions,
      'escalations', channel_count.escalations
    ) order by channel_count.source_channel
  )
    into metrics_payload
    from channel_counts as channel_count;

  return jsonb_build_object(
    'metrics', metrics_payload,
    'window', jsonb_build_object('from', window_from, 'to', window_to)
  );
end;
$$;

revoke all on function private.require_staff_user(uuid, uuid, text[])
from public, anon, authenticated;
revoke all on function public.resolve_staff_identity(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.load_escalation_context(uuid, uuid, uuid, uuid, uuid)
from public, anon, authenticated;
revoke all on function public.create_patient_escalation(uuid, uuid, uuid, uuid, uuid, text[], uuid[], text)
from public, anon, authenticated;
revoke all on function public.list_warm_leads(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.list_staff_escalations(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.create_staff_referral(uuid, uuid, text, text, integer, text)
from public, anon, authenticated;
revoke all on function public.get_staff_funnel_metrics(uuid, uuid)
from public, anon, authenticated;

grant execute on function private.require_staff_user(uuid, uuid, text[])
to service_role;
grant execute on function public.resolve_staff_identity(uuid, uuid)
to service_role;
grant execute on function public.load_escalation_context(uuid, uuid, uuid, uuid, uuid)
to service_role;
grant execute on function public.create_patient_escalation(uuid, uuid, uuid, uuid, uuid, text[], uuid[], text)
to service_role;
grant execute on function public.list_warm_leads(uuid, uuid)
to service_role;
grant execute on function public.list_staff_escalations(uuid, uuid)
to service_role;
grant execute on function public.create_staff_referral(uuid, uuid, text, text, integer, text)
to service_role;
grant execute on function public.get_staff_funnel_metrics(uuid, uuid)
to service_role;

comment on function public.resolve_staff_identity(uuid, uuid) is
  'Service-only role resolution for a clinic-provisioned authenticated staff account.';
comment on function public.create_patient_escalation(uuid, uuid, uuid, uuid, uuid, text[], uuid[], text) is
  'Service-only idempotent escalation and authoritative funnel-event persistence.';
comment on function public.list_warm_leads(uuid, uuid) is
  'Service-only non-clinical lead scoring using source, identity, stage, and recency.';
comment on function public.list_staff_escalations(uuid, uuid) is
  'Service-only consent-filtered clinical queue for nurse and clinician roles.';
comment on function public.create_staff_referral(uuid, uuid, text, text, integer, text) is
  'Service-only staff referral persistence using only a hashed opaque token.';
comment on function public.get_staff_funnel_metrics(uuid, uuid) is
  'Service-only query-backed thirty-day acquisition metrics for one clinic.';

commit;
