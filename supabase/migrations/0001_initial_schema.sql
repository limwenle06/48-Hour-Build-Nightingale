-- supabase/migrations/0002_schema_conventions.sql

-- Ensure tables use plural snake_case and timestamps use timestamptz
CREATE TABLE IF NOT EXISTS clinics (
    clinic_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    timezone TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('patient', 'staff', 'nurse', 'clinician')),
    verified_email TEXT NOT NULL,
    phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS patients (
    patient_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS staff_users (
    staff_user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('staff', 'nurse', 'clinician')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS lead_sessions (
    lead_session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    attribution JSONB NOT NULL,
    identity_level TEXT NOT NULL,
    social_handle TEXT,
    staff_referral_id UUID,
    status TEXT NOT NULL CHECK (status IN ('active', 'auth_started', 'converted', 'expired')),
    recovery_expires_at TIMESTAMPTZ NOT NULL,
    converted_patient_id UUID REFERENCES patients(patient_id),
    converted_patient_session_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS patient_sessions (
    patient_session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    source_lead_session_id UUID REFERENCES lead_sessions(lead_session_id),
    attribution JSONB NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS consents (
    consent_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    consent_type TEXT NOT NULL CHECK (consent_type IN ('health_data_sharing', 'marketing')),
    status TEXT NOT NULL CHECK (status IN ('granted', 'revoked')),
    policy_version TEXT NOT NULL,
    granted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS messages (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    session_type TEXT NOT NULL CHECK (session_type IN ('lead', 'patient')),
    session_id UUID NOT NULL,
    sender_type TEXT NOT NULL,
    message_kind TEXT NOT NULL CHECK (message_kind IN ('text', 'system')),
    content TEXT NOT NULL,
    migrated_from_message_id UUID REFERENCES messages(message_id),
    audio_asset_id UUID,
    transcript_id UUID,
    transcription_status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS risk_assessments (
    risk_assessment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    patient_session_id UUID NOT NULL REFERENCES patient_sessions(patient_session_id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES messages(message_id) ON DELETE CASCADE,
    risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
    risk_reason TEXT NOT NULL,
    confidence TEXT NOT NULL CHECK (confidence IN ('low', 'med', 'high')),
    risk_provenance TEXT NOT NULL,
    matched_rule_ids TEXT[] NOT NULL,
    escalation_required BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS memory_items (
    memory_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    value TEXT NOT NULL,
    normalized_value TEXT NOT NULL,
    status TEXT NOT NULL,
    provenance_pointer UUID NOT NULL REFERENCES messages(message_id),
    source_session_type TEXT NOT NULL CHECK (source_session_type IN ('lead', 'patient')),
    supersedes_memory_item_id UUID REFERENCES memory_items(memory_item_id),
    confidence TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS escalations (
    escalation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    patient_session_id UUID NOT NULL REFERENCES patient_sessions(patient_session_id) ON DELETE CASCADE,
    trigger_message_id UUID NOT NULL REFERENCES messages(message_id),
    risk_assessment_id UUID NOT NULL REFERENCES risk_assessments(risk_assessment_id),
    triage_summary TEXT[] NOT NULL,
    profile_snapshot JSONB[] NOT NULL,
    provenance UUID[] NOT NULL,
    attribution JSONB NOT NULL,
    risk_context JSONB NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'in_review', 'responded', 'closed')),
    clinician_response JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS funnel_events (
    funnel_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    event_name TEXT NOT NULL,
    lead_session_id UUID REFERENCES lead_sessions(lead_session_id),
    patient_id UUID REFERENCES patients(patient_id),
    patient_session_id UUID REFERENCES patient_sessions(patient_session_id),
    source_channel TEXT NOT NULL,
    campaign_id TEXT,
    metadata JSONB NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS audit_logs (
    audit_log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE SET NULL,
    actor_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    actor_role TEXT NOT NULL,
    event_type TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    outcome TEXT NOT NULL CHECK (outcome IN ('success', 'denied', 'failed')),
    request_id TEXT NOT NULL,
    metadata JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);