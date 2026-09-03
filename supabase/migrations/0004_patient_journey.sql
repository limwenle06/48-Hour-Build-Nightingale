begin;

alter table public.messages
  add column in_reply_to_message_id uuid
  references public.messages(message_id) on delete restrict;

alter table public.messages
  add constraint messages_reply_context_check check (
    in_reply_to_message_id is null
    or (session_type = 'patient' and sender_type = 'ai')
  );

create unique index messages_one_reply_per_patient_message_idx
  on public.messages (in_reply_to_message_id)
  where in_reply_to_message_id is not null;

alter table public.risk_assessments
  add column processing_status text not null default 'success'
  check (processing_status in ('success', 'blocked', 'failed'));

create function private.patient_message_result(p_message_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  patient_message_row public.messages%rowtype;
  assistant_message_row public.messages%rowtype;
  risk_row public.risk_assessments%rowtype;
  profile_changes_payload jsonb;
  citations_payload jsonb;
begin
  select *
    into patient_message_row
    from public.messages as message
   where message.message_id = p_message_id
     and message.session_type = 'patient'
     and message.sender_type = 'patient';

  select *
    into risk_row
    from public.risk_assessments as risk
   where risk.message_id = p_message_id;

  if patient_message_row.message_id is null or risk_row.risk_assessment_id is null then
    return null;
  end if;

  select *
    into assistant_message_row
    from public.messages as message
   where message.in_reply_to_message_id = p_message_id;

  select coalesce(
    jsonb_agg(to_jsonb(item) order by item.created_at, item.memory_item_id),
    '[]'::jsonb
  )
    into profile_changes_payload
    from public.memory_items as item
   where item.provenance_pointer = p_message_id
     and item.source_session_type = 'patient';

  if assistant_message_row.message_id is null then
    citations_payload := '[]'::jsonb;
  else
    select coalesce(
      jsonb_agg(to_jsonb(citation) - 'created_at'
        order by citation.created_at, citation.citation_id),
      '[]'::jsonb
    )
      into citations_payload
      from public.citations as citation
     where citation.message_id = assistant_message_row.message_id;
  end if;

  return jsonb_build_object(
    'patient_message', to_jsonb(patient_message_row) - 'in_reply_to_message_id',
    'risk_assessment', to_jsonb(risk_row) - 'processing_status',
    'assistant_message', case
      when assistant_message_row.message_id is null then null
      else to_jsonb(assistant_message_row) - 'in_reply_to_message_id'
    end,
    'profile_changes', profile_changes_payload,
    'escalation_required', risk_row.escalation_required,
    'send_to_clinic_available', risk_row.escalation_required,
    'citations', citations_payload,
    'processing_status', risk_row.processing_status
  );
end;
$$;

create function public.begin_patient_message(
  p_auth_user_id uuid,
  p_clinic_id uuid,
  p_patient_session_id uuid,
  p_content text,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  patient_row public.patients%rowtype;
  patient_message_row public.messages%rowtype;
  current_consent_status text;
  recent_message_count integer;
  current_profile_payload jsonb;
  recent_messages_payload jsonb;
begin
  if char_length(btrim(p_content)) not between 1 and 20000
     or char_length(btrim(p_request_id)) not between 1 and 200 then
    raise exception 'invalid patient message input'
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

  select count(*)
    into recent_message_count
    from public.messages as message
   where message.session_type = 'patient'
     and message.session_id = p_patient_session_id
     and message.sender_type = 'patient'
     and message.created_at >= now() - interval '1 minute';

  if recent_message_count >= 12 then
    raise exception 'patient message rate limit exceeded'
      using errcode = 'NGR01';
  end if;

  insert into public.messages (
    clinic_id,
    session_type,
    session_id,
    sender_type,
    message_kind,
    content
  ) values (
    p_clinic_id,
    'patient',
    p_patient_session_id,
    'patient',
    'text',
    btrim(p_content)
  )
  returning * into patient_message_row;

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
    into current_profile_payload
    from public.memory_items as item
   where item.patient_id = patient_row.patient_id
     and not exists (
       select 1
         from public.memory_items as later_item
        where later_item.supersedes_memory_item_id = item.memory_item_id
     );

  select coalesce(
    jsonb_agg(recent.payload order by recent.created_at, recent.message_id),
    '[]'::jsonb
  )
    into recent_messages_payload
    from (
      select
        message.created_at,
        message.message_id,
        jsonb_build_object(
          'message_id', message.message_id,
          'sender_type', message.sender_type,
          'content', message.content,
          'created_at', message.created_at
        ) as payload
        from public.messages as message
       where message.session_type = 'patient'
         and message.session_id = p_patient_session_id
         and message.message_id <> patient_message_row.message_id
       order by message.created_at desc, message.message_id desc
       limit 20
    ) as recent;

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
    'patient_message_saved',
    'message',
    patient_message_row.message_id,
    'success',
    p_request_id,
    '{}'::jsonb
  );

  return jsonb_build_object(
    'patient_message', to_jsonb(patient_message_row) - 'in_reply_to_message_id',
    'patient_id', patient_row.patient_id,
    'clinic_id', p_clinic_id,
    'current_profile', current_profile_payload,
    'recent_messages', recent_messages_payload
  );
end;
$$;

create function public.finalize_patient_message(
  p_auth_user_id uuid,
  p_clinic_id uuid,
  p_patient_session_id uuid,
  p_message_id uuid,
  p_risk jsonb,
  p_assistant_response jsonb,
  p_memory_mutations jsonb,
  p_citations jsonb,
  p_processing_status text,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  patient_row public.patients%rowtype;
  current_consent_status text;
  patient_message_row public.messages%rowtype;
  risk_row public.risk_assessments%rowtype;
  assistant_message_row public.messages%rowtype;
  mutation jsonb;
  citation_proposal jsonb;
begin
  if jsonb_typeof(p_risk) <> 'object'
     or jsonb_typeof(coalesce(p_memory_mutations, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_citations, '[]'::jsonb)) <> 'array'
     or p_processing_status not in ('success', 'blocked', 'failed')
     or char_length(btrim(p_request_id)) not between 1 and 200 then
    raise exception 'invalid patient processing result'
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
    into patient_message_row
    from public.messages as message
   where message.message_id = p_message_id
     and message.clinic_id = p_clinic_id
     and message.session_type = 'patient'
     and message.session_id = p_patient_session_id
     and message.sender_type = 'patient'
   for update;

  if patient_message_row.message_id is null then
    raise exception 'patient message was not found'
      using errcode = '23503';
  end if;

  select *
    into risk_row
    from public.risk_assessments as risk
   where risk.message_id = p_message_id;

  if risk_row.risk_assessment_id is not null then
    return private.patient_message_result(p_message_id);
  end if;

  if (p_risk ->> 'patient_id')::uuid <> patient_row.patient_id
     or (p_risk ->> 'patient_session_id')::uuid <> p_patient_session_id
     or (p_risk ->> 'message_id')::uuid <> p_message_id then
    raise exception 'risk result does not match its patient message'
      using errcode = '23514';
  end if;

  insert into public.risk_assessments (
    patient_id,
    patient_session_id,
    message_id,
    risk_level,
    risk_reason,
    confidence,
    risk_provenance,
    matched_rule_ids,
    escalation_required,
    processing_status
  ) values (
    patient_row.patient_id,
    p_patient_session_id,
    p_message_id,
    p_risk ->> 'risk_level',
    p_risk ->> 'risk_reason',
    p_risk ->> 'confidence',
    p_risk ->> 'risk_provenance',
    array(
      select jsonb_array_elements_text(
        coalesce(p_risk -> 'matched_rule_ids', '[]'::jsonb)
      )
    ),
    (p_risk ->> 'escalation_required')::boolean,
    p_processing_status
  )
  returning * into risk_row;

  if p_assistant_response is not null then
    if jsonb_typeof(p_assistant_response) <> 'object' then
      raise exception 'assistant response must be an object'
        using errcode = '22023';
    end if;

    insert into public.messages (
      clinic_id,
      session_type,
      session_id,
      sender_type,
      message_kind,
      content,
      in_reply_to_message_id
    ) values (
      p_clinic_id,
      'patient',
      p_patient_session_id,
      'ai',
      'text',
      p_assistant_response ->> 'content',
      p_message_id
    )
    returning * into assistant_message_row;
  end if;

  for mutation in
    select value from jsonb_array_elements(coalesce(p_memory_mutations, '[]'::jsonb))
  loop
    if (mutation ->> 'provenance_pointer')::uuid <> p_message_id then
      raise exception 'memory result does not match its patient message'
        using errcode = '23514';
    end if;

    insert into public.memory_items (
      patient_id,
      type,
      value,
      normalized_value,
      status,
      provenance_pointer,
      source_session_type,
      supersedes_memory_item_id,
      confidence
    ) values (
      patient_row.patient_id,
      mutation ->> 'type',
      mutation ->> 'value',
      mutation ->> 'normalized_value',
      mutation ->> 'status',
      p_message_id,
      'patient',
      (mutation ->> 'supersedes_memory_item_id')::uuid,
      mutation ->> 'confidence'
    );
  end loop;

  if jsonb_array_length(coalesce(p_citations, '[]'::jsonb)) > 0
     and assistant_message_row.message_id is null then
    raise exception 'citations require an assistant message'
      using errcode = '23514';
  end if;

  for citation_proposal in
    select value from jsonb_array_elements(coalesce(p_citations, '[]'::jsonb))
  loop
    insert into public.citations (
      message_id,
      title,
      source_url,
      publisher,
      retrieved_at
    ) values (
      assistant_message_row.message_id,
      citation_proposal ->> 'title',
      citation_proposal ->> 'source_url',
      citation_proposal ->> 'publisher',
      (citation_proposal ->> 'retrieved_at')::timestamptz
    );
  end loop;

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
    'patient_message_processed',
    'message',
    p_message_id,
    case when p_processing_status = 'success' then 'success' else 'failed' end,
    p_request_id,
    jsonb_build_object(
      'processing_status', p_processing_status,
      'risk_level', risk_row.risk_level,
      'escalation_required', risk_row.escalation_required
    )
  );

  return private.patient_message_result(p_message_id);
end;
$$;

create function public.get_patient_profile(
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
  patient_row public.patients%rowtype;
  current_consent_status text;
  profile_payload jsonb;
begin
  select patient.*
    into patient_row
    from public.users as app_user
    join public.patients as patient on patient.user_id = app_user.user_id
   where app_user.auth_user_id = p_auth_user_id
     and app_user.role = 'patient'
     and patient.clinic_id = p_clinic_id;

  if patient_row.patient_id is null then
    raise exception 'patient record is unavailable'
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

  select coalesce(
    jsonb_agg(to_jsonb(item) order by item.created_at, item.memory_item_id),
    '[]'::jsonb
  )
    into profile_payload
    from public.memory_items as item
   where item.patient_id = patient_row.patient_id
     and not exists (
       select 1
         from public.memory_items as later_item
        where later_item.supersedes_memory_item_id = item.memory_item_id
     );

  return jsonb_build_object(
    'patient_id', patient_row.patient_id,
    'items', profile_payload
  );
end;
$$;

revoke all on function private.patient_message_result(uuid)
from public, anon, authenticated;
revoke all on function public.begin_patient_message(uuid, uuid, uuid, text, text)
from public, anon, authenticated;
revoke all on function public.finalize_patient_message(uuid, uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, text, text)
from public, anon, authenticated;
revoke all on function public.get_patient_profile(uuid, uuid)
from public, anon, authenticated;

grant execute on function private.patient_message_result(uuid)
to service_role;
grant execute on function public.begin_patient_message(uuid, uuid, uuid, text, text)
to service_role;
grant execute on function public.finalize_patient_message(uuid, uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, text, text)
to service_role;
grant execute on function public.get_patient_profile(uuid, uuid)
to service_role;

comment on function public.begin_patient_message(uuid, uuid, uuid, text, text) is
  'Service-only ownership, consent, rate-limit, message persistence, and safe AI context load.';
comment on function public.finalize_patient_message(uuid, uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb, text, text) is
  'Service-only idempotent persistence of one validated patient-message processing result.';
comment on function public.get_patient_profile(uuid, uuid) is
  'Service-only current non-superseded Living Profile for an authenticated consented patient.';

commit;
