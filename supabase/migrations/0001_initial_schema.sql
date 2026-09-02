-- Nightingale PostgreSQL Schema (Raw SQL)
-- All tables use plural snake_case and columns use snake_case per team contract.

CREATE TYPE role AS ENUM ('guest', 'patient', 'staff', 'nurse', 'clinician');
CREATE TYPE source_channel AS ENUM ('staff_referral', 'social_comment', 'instagram_ad_click', 'website_widget');
CREATE TYPE source_platform AS ENUM ('clinic', 'instagram', 'tiktok', 'facebook', 'website', 'other');
CREATE TYPE identity_level AS ENUM ('anonymous', 'social_handle', 'contact_provided', 'verified');
CREATE TYPE funnel_event_name AS ENUM ('visitor', 'conversation_started', 'value_event', 'auth_started', 'consented', 'patient_created', 'escalation_sent');
CREATE TYPE sender_type AS ENUM ('guest', 'patient', 'ai', 'staff', 'nurse', 'clinician');
CREATE TYPE session_type AS ENUM ('lead', 'patient');
CREATE TYPE message_kind AS ENUM ('text', 'system');
CREATE TYPE consent_type AS ENUM ('health_data_sharing', 'marketing');
CREATE TYPE consent_status AS ENUM ('granted', 'revoked');
CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high');
CREATE TYPE confidence AS ENUM ('low', 'med', 'high');
CREATE TYPE risk_provenance AS ENUM ('deterministic', 'model', 'combined', 'system_fallback');
CREATE TYPE memory_type AS ENUM ('chief_complaint', 'symptom', 'symptom_timeline', 'medication', 'allergy');
CREATE TYPE memory_status AS ENUM ('active', 'stopped', 'resolved', 'historical', 'unknown');
CREATE TYPE memory_source_session_type AS ENUM ('lead', 'patient');
CREATE TYPE escalation_status AS ENUM ('pending', 'in_review', 'responded', 'closed');
CREATE TYPE referral_status AS ENUM ('active', 'converted', 'expired', 'revoked');
CREATE TYPE transcription_status AS ENUM ('not_applicable', 'pending', 'completed', 'failed');
CREATE TYPE processing_status AS ENUM ('success', 'blocked', 'failed');

CREATE TABLE clinics (
    clinic_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    timezone TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id TEXT UNIQUE NOT NULL,
    clinic_id UUID NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    role role NOT NULL DEFAULT 'patient',
    verified_email TEXT UNIQUE NOT NULL,
    phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE patients (
    patient_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE staff_users (
    staff_user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    role role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE lead_sessions (
    lead_session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    source_channel source_channel NOT NULL,
    source_platform source_platform NOT NULL,
    campaign_id TEXT,
    creative TEXT,
    identity_level identity_level NOT NULL DEFAULT 'anonymous',
    social_handle TEXT,
    staff_referral_id TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    recovery_expires_at TIMESTAMPTZ NOT NULL,
    converted_patient_id UUID,
    converted_patient_session_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE patient_sessions (
    patient_session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    source_lead_session_id UUID REFERENCES lead_sessions(lead_session_id) ON DELETE SET NULL,
    source_channel source_channel NOT NULL,
    source_platform source_platform NOT NULL,
    campaign_id TEXT,
    creative TEXT,
    identity_level identity_level NOT NULL,
    landing_timestamp TIMESTAMPTZ NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE messages (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    session_type session_type NOT NULL,
    session_id UUID NOT NULL,
    sender_type sender_type NOT NULL,
    message_kind message_kind NOT NULL DEFAULT 'text',
    content TEXT NOT NULL,
    migrated_from_message_id UUID,
    audio_asset_id TEXT,
    transcript_id TEXT,
    transcription_status transcription_status NOT NULL DEFAULT 'not_applicable',
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE consents (
    consent_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    consent_type consent_type NOT NULL,
    status consent_status NOT NULL,
    policy_version TEXT NOT NULL,
    granted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE risk_assessments (
    risk_assessment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    patient_session_id UUID NOT NULL REFERENCES patient_sessions(patient_session_id) ON DELETE CASCADE,
    message_id UUID UNIQUE NOT NULL REFERENCES messages(message_id) ON DELETE CASCADE,
    risk_level risk_level NOT NULL,
    risk_reason TEXT NOT NULL,
    confidence confidence NOT NULL,
    risk_provenance risk_provenance NOT NULL,
    matched_rule_ids TEXT[] NOT NULL,
    escalation_required BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE memory_items (
    memory_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    type memory_type NOT NULL,
    value TEXT NOT NULL,
    normalized_value TEXT NOT NULL,
    status memory_status NOT NULL,
    provenance_pointer UUID NOT NULL,
    source_session_type memory_source_session_type NOT NULL,
    supersedes_memory_item_id UUID,
    confidence confidence NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE escalations (
    escalation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    patient_session_id UUID NOT NULL REFERENCES patient_sessions(patient_session_id) ON DELETE CASCADE,
    trigger_message_id UUID NOT NULL,
    risk_assessment_id UUID NOT NULL REFERENCES risk_assessments(risk_assessment_id) ON DELETE CASCADE,
    triage_summary TEXT[] NOT NULL,
    profile_snapshot JSONB NOT NULL,
    provenance UUID[] NOT NULL,
    attribution JSONB NOT NULL,
    risk_context JSONB NOT NULL,
    status escalation_status NOT NULL DEFAULT 'pending',
    clinician_response JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE funnel_events (
    funnel_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    event_name funnel_event_name NOT NULL,
    lead_session_id UUID,
    patient_id UUID,
    patient_session_id UUID,
    source_channel source_channel NOT NULL,
    campaign_id TEXT,
    metadata JSONB NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE staff_referrals (
    staff_referral_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    created_by_staff_user_id UUID NOT NULL REFERENCES staff_users(staff_user_id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    status referral_status NOT NULL DEFAULT 'active',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE audit_logs (
    audit_log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID,
    actor_user_id UUID,
    actor_role role NOT NULL,
    event_type TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    outcome TEXT NOT NULL,
    request_id TEXT NOT NULL,
    metadata JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable user isolation on messages" ON messages FOR ALL USING (auth.uid() = user_id);

ALTER TABLE memory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable user isolation on memory_items" ON memory_items FOR ALL USING (auth.uid() = user_id);

ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable user isolation on escalations" ON escalations FOR ALL USING (auth.uid() = user_id);