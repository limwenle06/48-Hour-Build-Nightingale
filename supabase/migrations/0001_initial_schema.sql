begin;

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;

create table public.clinics (
  clinic_id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  timezone text not null check (char_length(btrim(timezone)) between 1 and 100),
  created_at timestamptz not null default now()
);

create table public.users (
  user_id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null check (role in ('patient', 'staff', 'nurse', 'clinician')),
  verified_email text not null check (char_length(btrim(verified_email)) between 3 and 320),
  phone text check (phone is null or char_length(btrim(phone)) between 5 and 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.patients (
  patient_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete restrict,
  clinic_id uuid not null references public.clinics(clinic_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, clinic_id),
  unique (patient_id, clinic_id)
);

create table public.staff_users (
  staff_user_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete restrict,
  clinic_id uuid not null references public.clinics(clinic_id) on delete restrict,
  role text not null check (role in ('staff', 'nurse', 'clinician')),
  created_at timestamptz not null default now(),
  unique (user_id, clinic_id),
  unique (staff_user_id, clinic_id)
);

create table public.staff_referrals (
  staff_referral_id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(clinic_id) on delete restrict,
  created_by_staff_user_id uuid not null,
  topic text not null check (char_length(btrim(topic)) between 1 and 500),
  token_hash text not null unique check (
    char_length(token_hash) = 64 and token_hash ~ '^[0-9a-f]{64}$'
  ),
  status text not null default 'active' check (
    status in ('active', 'converted', 'expired', 'revoked')
  ),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (staff_referral_id, clinic_id),
  constraint staff_referrals_creator_fk
    foreign key (created_by_staff_user_id, clinic_id)
    references public.staff_users(staff_user_id, clinic_id)
    on delete restrict,
  check (expires_at > created_at)
);

create table public.lead_sessions (
  lead_session_id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(clinic_id) on delete restrict,
  source_channel text not null check (
    source_channel in (
      'staff_referral',
      'social_comment',
      'instagram_ad_click',
      'website_widget'
    )
  ),
  source_platform text not null check (
    source_platform in ('clinic', 'instagram', 'tiktok', 'facebook', 'website', 'other')
  ),
  campaign_id text check (campaign_id is null or char_length(campaign_id) <= 200),
  creative text check (creative is null or char_length(creative) <= 500),
  identity_level text not null check (
    identity_level in ('anonymous', 'social_handle', 'contact_provided', 'verified')
  ),
  landing_timestamp timestamptz not null,
  social_handle text check (
    social_handle is null or char_length(btrim(social_handle)) between 1 and 200
  ),
  staff_referral_id uuid,
  status text not null default 'active' check (
    status in ('active', 'auth_started', 'converted', 'expired')
  ),
  recovery_token_hash text not null unique check (
    char_length(recovery_token_hash) = 64
    and recovery_token_hash ~ '^[0-9a-f]{64}$'
  ),
  recovery_expires_at timestamptz not null,
  converted_patient_id uuid,
  converted_patient_session_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_session_id, clinic_id),
  constraint lead_sessions_referral_fk
    foreign key (staff_referral_id, clinic_id)
    references public.staff_referrals(staff_referral_id, clinic_id)
    on delete restrict,
  check (recovery_expires_at > created_at),
  check (
    (
      status = 'converted'
      and converted_patient_id is not null
      and converted_patient_session_id is not null
    )
    or (
      status <> 'converted'
      and converted_patient_id is null
      and converted_patient_session_id is null
    )
  )
);

create table public.patient_sessions (
  patient_session_id uuid primary key default gen_random_uuid(),
  patient_id uuid not null,
  clinic_id uuid not null,
  source_lead_session_id uuid unique,
  source_channel text not null check (
    source_channel in (
      'staff_referral',
      'social_comment',
      'instagram_ad_click',
      'website_widget'
    )
  ),
  source_platform text not null check (
    source_platform in ('clinic', 'instagram', 'tiktok', 'facebook', 'website', 'other')
  ),
  campaign_id text check (campaign_id is null or char_length(campaign_id) <= 200),
  creative text check (creative is null or char_length(creative) <= 500),
  identity_level text not null check (
    identity_level in ('anonymous', 'social_handle', 'contact_provided', 'verified')
  ),
  landing_timestamp timestamptz not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_session_id, patient_id),
  unique (patient_session_id, patient_id, clinic_id),
  constraint patient_sessions_patient_fk
    foreign key (patient_id, clinic_id)
    references public.patients(patient_id, clinic_id)
    on delete restrict,
  constraint patient_sessions_source_lead_fk
    foreign key (source_lead_session_id, clinic_id)
    references public.lead_sessions(lead_session_id, clinic_id)
    on delete restrict,
  check (ended_at is null or ended_at >= started_at)
);

alter table public.lead_sessions
  add constraint lead_sessions_conversion_fk
  foreign key (converted_patient_session_id, converted_patient_id, clinic_id)
  references public.patient_sessions(patient_session_id, patient_id, clinic_id)
  on delete restrict;

create table public.messages (
  message_id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(clinic_id) on delete restrict,
  session_type text not null check (session_type in ('lead', 'patient')),
  session_id uuid not null,
  sender_type text not null check (
    sender_type in ('guest', 'patient', 'ai', 'staff', 'nurse', 'clinician')
  ),
  message_kind text not null default 'text' check (message_kind in ('text', 'system')),
  content text not null check (char_length(btrim(content)) between 1 and 20000),
  migrated_from_message_id uuid references public.messages(message_id) on delete restrict,
  audio_asset_id uuid,
  transcript_id uuid,
  transcription_status text not null default 'not_applicable' check (
    transcription_status in ('not_applicable', 'pending', 'completed', 'failed')
  ),
  created_at timestamptz not null default now(),
  check (
    (session_type = 'lead' and sender_type in ('guest', 'ai'))
    or
    (
      session_type = 'patient'
      and sender_type in ('patient', 'ai', 'staff', 'nurse', 'clinician')
    )
  ),
  check (migrated_from_message_id is null or migrated_from_message_id <> message_id)
);

create table public.consents (
  consent_id uuid primary key default gen_random_uuid(),
  patient_id uuid not null,
  clinic_id uuid not null,
  consent_type text not null check (consent_type in ('health_data_sharing', 'marketing')),
  status text not null check (status in ('granted', 'revoked')),
  policy_version text not null check (char_length(btrim(policy_version)) between 1 and 100),
  granted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint consents_patient_fk
    foreign key (patient_id, clinic_id)
    references public.patients(patient_id, clinic_id)
    on delete restrict,
  check (
    (status = 'granted' and granted_at is not null and revoked_at is null)
    or
    (status = 'revoked' and granted_at is null and revoked_at is not null)
  )
);

create table public.risk_assessments (
  risk_assessment_id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(patient_id) on delete restrict,
  patient_session_id uuid not null,
  message_id uuid not null unique references public.messages(message_id) on delete restrict,
  risk_level text not null check (risk_level in ('low', 'medium', 'high')),
  risk_reason text not null check (char_length(btrim(risk_reason)) between 1 and 500),
  confidence text not null check (confidence in ('low', 'med', 'high')),
  risk_provenance text not null check (
    risk_provenance in ('deterministic', 'model', 'combined', 'system_fallback')
  ),
  matched_rule_ids text[] not null default array[]::text[],
  escalation_required boolean not null,
  created_at timestamptz not null default now(),
  constraint risk_assessments_patient_session_fk
    foreign key (patient_session_id, patient_id)
    references public.patient_sessions(patient_session_id, patient_id)
    on delete restrict,
  check (
    escalation_required = (
      risk_level in ('medium', 'high') or confidence = 'low'
    )
  )
);

create table public.memory_items (
  memory_item_id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(patient_id) on delete restrict,
  type text not null check (
    type in ('chief_complaint', 'symptom', 'symptom_timeline', 'medication', 'allergy')
  ),
  value text not null check (char_length(btrim(value)) between 1 and 1000),
  normalized_value text not null check (
    char_length(btrim(normalized_value)) between 1 and 1000
  ),
  status text not null check (
    status in ('active', 'stopped', 'resolved', 'historical', 'unknown')
  ),
  provenance_pointer uuid not null references public.messages(message_id) on delete restrict,
  source_session_type text not null check (source_session_type in ('lead', 'patient')),
  supersedes_memory_item_id uuid unique references public.memory_items(memory_item_id) on delete restrict,
  confidence text not null check (confidence in ('low', 'med', 'high')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    supersedes_memory_item_id is null
    or supersedes_memory_item_id <> memory_item_id
  )
);

create table public.citations (
  citation_id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(message_id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 500),
  source_url text not null check (char_length(btrim(source_url)) between 1 and 2000),
  publisher text not null check (char_length(btrim(publisher)) between 1 and 500),
  retrieved_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.escalations (
  escalation_id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(clinic_id) on delete restrict,
  patient_id uuid not null references public.patients(patient_id) on delete restrict,
  patient_session_id uuid not null,
  trigger_message_id uuid not null unique references public.messages(message_id) on delete restrict,
  risk_assessment_id uuid not null unique references public.risk_assessments(risk_assessment_id) on delete restrict,
  triage_summary text[] not null check (cardinality(triage_summary) between 1 and 5),
  profile_snapshot jsonb not null check (jsonb_typeof(profile_snapshot) = 'array'),
  provenance uuid[] not null check (cardinality(provenance) between 1 and 100),
  attribution jsonb not null check (jsonb_typeof(attribution) = 'object'),
  risk_context jsonb not null check (jsonb_typeof(risk_context) = 'object'),
  status text not null default 'pending' check (
    status in ('pending', 'in_review', 'responded', 'closed')
  ),
  clinician_response jsonb check (
    clinician_response is null or jsonb_typeof(clinician_response) = 'object'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint escalations_patient_session_fk
    foreign key (patient_session_id, patient_id, clinic_id)
    references public.patient_sessions(patient_session_id, patient_id, clinic_id)
    on delete restrict
);

create table public.funnel_events (
  funnel_event_id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(clinic_id) on delete restrict,
  event_name text not null check (
    event_name in (
      'visitor',
      'conversation_started',
      'value_event',
      'auth_started',
      'consented',
      'patient_created',
      'escalation_sent'
    )
  ),
  lead_session_id uuid references public.lead_sessions(lead_session_id) on delete restrict,
  patient_id uuid references public.patients(patient_id) on delete restrict,
  patient_session_id uuid references public.patient_sessions(patient_session_id) on delete restrict,
  source_channel text not null check (
    source_channel in (
      'staff_referral',
      'social_comment',
      'instagram_ad_click',
      'website_widget'
    )
  ),
  campaign_id text check (campaign_id is null or char_length(campaign_id) <= 200),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default now(),
  check (
    lead_session_id is not null
    or patient_id is not null
    or patient_session_id is not null
  )
);

create table public.audit_logs (
  audit_log_id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics(clinic_id) on delete restrict,
  actor_user_id uuid references public.users(user_id) on delete set null,
  actor_role text not null check (
    actor_role in ('guest', 'patient', 'staff', 'nurse', 'clinician')
  ),
  event_type text not null check (char_length(btrim(event_type)) between 1 and 200),
  resource_type text not null check (char_length(btrim(resource_type)) between 1 and 200),
  resource_id uuid,
  outcome text not null check (outcome in ('success', 'denied', 'failed')),
  request_id text not null check (char_length(btrim(request_id)) between 1 and 200),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index patients_clinic_idx
  on public.patients (clinic_id, patient_id);
create index staff_users_clinic_role_idx
  on public.staff_users (clinic_id, role, staff_user_id);
create index staff_referrals_clinic_status_idx
  on public.staff_referrals (clinic_id, status, expires_at desc);
create index lead_sessions_clinic_status_idx
  on public.lead_sessions (clinic_id, status, updated_at desc);
create index lead_sessions_source_idx
  on public.lead_sessions (clinic_id, source_channel, campaign_id, created_at desc);
create index messages_session_created_idx
  on public.messages (session_type, session_id, created_at, message_id);
create index messages_migrated_from_idx
  on public.messages (migrated_from_message_id)
  where migrated_from_message_id is not null;
create index patient_sessions_patient_created_idx
  on public.patient_sessions (patient_id, created_at desc);
create index consents_current_lookup_idx
  on public.consents (patient_id, clinic_id, consent_type, created_at desc);
create index risk_assessments_patient_created_idx
  on public.risk_assessments (patient_id, created_at desc);
create index memory_items_patient_created_idx
  on public.memory_items (patient_id, created_at desc);
create index memory_items_provenance_idx
  on public.memory_items (provenance_pointer);
create index citations_message_idx
  on public.citations (message_id);
create index escalations_clinic_queue_idx
  on public.escalations (clinic_id, status, created_at desc);
create index escalations_patient_idx
  on public.escalations (patient_id, created_at desc);
create index funnel_events_clinic_source_idx
  on public.funnel_events (clinic_id, source_channel, event_name, occurred_at desc);
create index funnel_events_lead_idx
  on public.funnel_events (lead_session_id, event_name)
  where lead_session_id is not null;
create index audit_logs_clinic_created_idx
  on public.audit_logs (clinic_id, created_at desc);
create index audit_logs_request_idx
  on public.audit_logs (request_id);

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function private.reject_row_update()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception '% rows are append-only', tg_table_name
    using errcode = '55000';
end;
$$;

create function private.validate_message_session()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  expected_clinic_id uuid;
begin
  if new.session_type = 'lead' then
    select lead.clinic_id
      into expected_clinic_id
      from public.lead_sessions as lead
     where lead.lead_session_id = new.session_id;
  else
    select patient_session.clinic_id
      into expected_clinic_id
      from public.patient_sessions as patient_session
     where patient_session.patient_session_id = new.session_id;
  end if;

  if expected_clinic_id is null or expected_clinic_id <> new.clinic_id then
    raise exception 'message session does not belong to the supplied clinic'
      using errcode = '23503';
  end if;

  return new;
end;
$$;

create function private.validate_risk_context()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  message_session_id uuid;
  message_session_type text;
  message_sender_type text;
begin
  select message.session_id, message.session_type, message.sender_type
    into message_session_id, message_session_type, message_sender_type
    from public.messages as message
   where message.message_id = new.message_id;

  if message_session_type <> 'patient'
     or message_sender_type <> 'patient'
     or message_session_id <> new.patient_session_id then
    raise exception 'risk assessment must reference its patient-authored message'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create function private.validate_memory_provenance()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  provenance_session_id uuid;
  provenance_session_type text;
  provenance_sender_type text;
  provenance_patient_id uuid;
  previous_item public.memory_items%rowtype;
begin
  select message.session_id, message.session_type, message.sender_type
    into provenance_session_id, provenance_session_type, provenance_sender_type
    from public.messages as message
   where message.message_id = new.provenance_pointer;

  if provenance_session_type = 'patient' then
    select patient_session.patient_id
      into provenance_patient_id
      from public.patient_sessions as patient_session
     where patient_session.patient_session_id = provenance_session_id;

    if provenance_sender_type <> 'patient'
       or provenance_patient_id is distinct from new.patient_id then
      raise exception 'patient memory provenance does not belong to the patient'
        using errcode = '23514';
    end if;
  elsif provenance_session_type = 'lead' then
    select lead.converted_patient_id
      into provenance_patient_id
      from public.lead_sessions as lead
     where lead.lead_session_id = provenance_session_id
       and lead.status = 'converted';

    if provenance_sender_type <> 'guest'
       or provenance_patient_id is distinct from new.patient_id then
      raise exception 'guest memory provenance is not a converted lead for the patient'
        using errcode = '23514';
    end if;
  else
    raise exception 'memory provenance message was not found'
      using errcode = '23503';
  end if;

  if new.source_session_type <> provenance_session_type then
    raise exception 'memory source_session_type must match its provenance message'
      using errcode = '23514';
  end if;

  if new.supersedes_memory_item_id is not null then
    select *
      into previous_item
      from public.memory_items as item
     where item.memory_item_id = new.supersedes_memory_item_id;

    if previous_item.memory_item_id is null
       or previous_item.patient_id <> new.patient_id
       or previous_item.type <> new.type
       or previous_item.normalized_value <> new.normalized_value then
      raise exception 'superseded memory must be compatible and belong to the same patient'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create function private.validate_escalation_context()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  risk_row public.risk_assessments%rowtype;
begin
  select *
    into risk_row
    from public.risk_assessments as risk
   where risk.risk_assessment_id = new.risk_assessment_id;

  if risk_row.risk_assessment_id is null
     or risk_row.patient_id <> new.patient_id
     or risk_row.patient_session_id <> new.patient_session_id
     or risk_row.message_id <> new.trigger_message_id
     or risk_row.escalation_required is not true then
    raise exception 'escalation context does not match its required risk assessment'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger users_set_updated_at
before update on public.users
for each row execute function private.set_updated_at();

create trigger patients_set_updated_at
before update on public.patients
for each row execute function private.set_updated_at();

create trigger lead_sessions_set_updated_at
before update on public.lead_sessions
for each row execute function private.set_updated_at();

create trigger patient_sessions_set_updated_at
before update on public.patient_sessions
for each row execute function private.set_updated_at();

create trigger escalations_set_updated_at
before update on public.escalations
for each row execute function private.set_updated_at();

create trigger messages_validate_session
before insert on public.messages
for each row execute function private.validate_message_session();

create trigger risk_assessments_validate_context
before insert on public.risk_assessments
for each row execute function private.validate_risk_context();

create trigger memory_items_validate_provenance
before insert on public.memory_items
for each row execute function private.validate_memory_provenance();

create trigger escalations_validate_context
before insert on public.escalations
for each row execute function private.validate_escalation_context();

create trigger messages_reject_update
before update on public.messages
for each row execute function private.reject_row_update();

create trigger consents_reject_update
before update on public.consents
for each row execute function private.reject_row_update();

create trigger risk_assessments_reject_update
before update on public.risk_assessments
for each row execute function private.reject_row_update();

create trigger memory_items_reject_update
before update on public.memory_items
for each row execute function private.reject_row_update();

create trigger citations_reject_update
before update on public.citations
for each row execute function private.reject_row_update();

create trigger funnel_events_reject_update
before update on public.funnel_events
for each row execute function private.reject_row_update();

create trigger audit_logs_reject_update
before update on public.audit_logs
for each row execute function private.reject_row_update();

create function private.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select app_user.user_id
    from public.users as app_user
   where app_user.auth_user_id = auth.uid()
   limit 1
$$;

create function private.is_current_patient(
  target_patient_id uuid,
  target_clinic_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
      from public.patients as patient
     where patient.patient_id = target_patient_id
       and patient.clinic_id = target_clinic_id
       and patient.user_id = private.current_user_id()
  )
$$;

create function private.has_staff_role(
  target_clinic_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
      from public.staff_users as staff_user
     where staff_user.clinic_id = target_clinic_id
       and staff_user.user_id = private.current_user_id()
       and staff_user.role = any(allowed_roles)
  )
$$;

create function private.has_current_health_consent(
  target_patient_id uuid,
  target_clinic_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select coalesce((
    select consent.status = 'granted'
      from public.consents as consent
     where consent.patient_id = target_patient_id
       and consent.clinic_id = target_clinic_id
       and consent.consent_type = 'health_data_sharing'
     order by consent.created_at desc, consent.consent_id desc
     limit 1
  ), false)
$$;

create function private.can_read_patient(
  target_patient_id uuid,
  target_clinic_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select
    private.is_current_patient(target_patient_id, target_clinic_id)
    or (
      private.has_staff_role(target_clinic_id, array['nurse', 'clinician'])
      and private.has_current_health_consent(target_patient_id, target_clinic_id)
    )
$$;

create function private.has_clinic_membership(target_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select
    exists (
      select 1
        from public.patients as patient
       where patient.clinic_id = target_clinic_id
         and patient.user_id = private.current_user_id()
    )
    or private.has_staff_role(
      target_clinic_id,
      array['staff', 'nurse', 'clinician']
    )
$$;

create function private.can_read_message(target_message_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  message_row public.messages%rowtype;
  target_patient_id uuid;
  target_clinic_id uuid;
begin
  select *
    into message_row
    from public.messages as message
   where message.message_id = target_message_id;

  if message_row.message_id is null then
    return false;
  end if;

  if message_row.session_type = 'patient' then
    select patient_session.patient_id, patient_session.clinic_id
      into target_patient_id, target_clinic_id
      from public.patient_sessions as patient_session
     where patient_session.patient_session_id = message_row.session_id;
  else
    select lead.converted_patient_id, lead.clinic_id
      into target_patient_id, target_clinic_id
      from public.lead_sessions as lead
     where lead.lead_session_id = message_row.session_id
       and lead.status = 'converted';
  end if;

  if target_patient_id is null then
    return false;
  end if;

  return private.can_read_patient(target_patient_id, target_clinic_id);
end;
$$;

alter table public.clinics enable row level security;
alter table public.clinics force row level security;
alter table public.users enable row level security;
alter table public.users force row level security;
alter table public.patients enable row level security;
alter table public.patients force row level security;
alter table public.staff_users enable row level security;
alter table public.staff_users force row level security;
alter table public.staff_referrals enable row level security;
alter table public.staff_referrals force row level security;
alter table public.lead_sessions enable row level security;
alter table public.lead_sessions force row level security;
alter table public.patient_sessions enable row level security;
alter table public.patient_sessions force row level security;
alter table public.messages enable row level security;
alter table public.messages force row level security;
alter table public.consents enable row level security;
alter table public.consents force row level security;
alter table public.risk_assessments enable row level security;
alter table public.risk_assessments force row level security;
alter table public.memory_items enable row level security;
alter table public.memory_items force row level security;
alter table public.citations enable row level security;
alter table public.citations force row level security;
alter table public.escalations enable row level security;
alter table public.escalations force row level security;
alter table public.funnel_events enable row level security;
alter table public.funnel_events force row level security;
alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;

create policy clinics_select_member
on public.clinics
for select
to authenticated
using (private.has_clinic_membership(clinic_id));

create policy users_select_self
on public.users
for select
to authenticated
using (user_id = private.current_user_id());

create policy patients_select_authorized
on public.patients
for select
to authenticated
using (private.can_read_patient(patient_id, clinic_id));

create policy staff_users_select_self
on public.staff_users
for select
to authenticated
using (user_id = private.current_user_id());

create policy patient_sessions_select_authorized
on public.patient_sessions
for select
to authenticated
using (private.can_read_patient(patient_id, clinic_id));

create policy messages_select_authorized
on public.messages
for select
to authenticated
using (private.can_read_message(message_id));

create policy consents_select_authorized
on public.consents
for select
to authenticated
using (private.can_read_patient(patient_id, clinic_id));

create policy risk_assessments_select_authorized
on public.risk_assessments
for select
to authenticated
using (
  exists (
    select 1
      from public.patient_sessions as patient_session
     where patient_session.patient_session_id = risk_assessments.patient_session_id
       and private.can_read_patient(
         risk_assessments.patient_id,
         patient_session.clinic_id
       )
  )
);

create policy memory_items_select_authorized
on public.memory_items
for select
to authenticated
using (
  exists (
    select 1
      from public.patients as patient
     where patient.patient_id = memory_items.patient_id
       and private.can_read_patient(patient.patient_id, patient.clinic_id)
  )
);

create policy citations_select_authorized
on public.citations
for select
to authenticated
using (private.can_read_message(message_id));

create policy escalations_select_authorized
on public.escalations
for select
to authenticated
using (private.can_read_patient(patient_id, clinic_id));

revoke all on table
  public.clinics,
  public.users,
  public.patients,
  public.staff_users,
  public.staff_referrals,
  public.lead_sessions,
  public.patient_sessions,
  public.messages,
  public.consents,
  public.risk_assessments,
  public.memory_items,
  public.citations,
  public.escalations,
  public.funnel_events,
  public.audit_logs
from anon, authenticated;

grant select on table
  public.clinics,
  public.users,
  public.patients,
  public.staff_users,
  public.patient_sessions,
  public.messages,
  public.consents,
  public.risk_assessments,
  public.memory_items,
  public.citations,
  public.escalations
to authenticated;

grant all on table
  public.clinics,
  public.users,
  public.patients,
  public.staff_users,
  public.staff_referrals,
  public.lead_sessions,
  public.patient_sessions,
  public.messages,
  public.consents,
  public.risk_assessments,
  public.memory_items,
  public.citations,
  public.escalations,
  public.funnel_events,
  public.audit_logs
to service_role;

grant usage on schema private to authenticated, service_role;
revoke all on all functions in schema private from public;
grant execute on function private.current_user_id() to authenticated, service_role;
grant execute on function private.is_current_patient(uuid, uuid) to authenticated, service_role;
grant execute on function private.has_staff_role(uuid, text[]) to authenticated, service_role;
grant execute on function private.has_current_health_consent(uuid, uuid) to authenticated, service_role;
grant execute on function private.can_read_patient(uuid, uuid) to authenticated, service_role;
grant execute on function private.has_clinic_membership(uuid) to authenticated, service_role;
grant execute on function private.can_read_message(uuid) to authenticated, service_role;

comment on table public.lead_sessions is
  'Guest session. Raw recovery tokens are never stored; only SHA-256 hashes are persisted.';
comment on table public.messages is
  'Protected append-only message content. Never copy content into logs or funnel metadata.';
comment on table public.consents is
  'Append-only consent event history. The latest clinic/type event is the current state.';
comment on table public.memory_items is
  'Append-only Living Memory revisions with source message provenance.';
comment on table public.audit_logs is
  'Append-only structured audit events. Metadata must remain free of PHI and secrets.';

commit;
