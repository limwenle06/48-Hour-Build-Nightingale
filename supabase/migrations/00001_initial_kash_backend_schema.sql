-- 1. Identity & Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    clinic_id TEXT NOT NULL,
    source_channel TEXT NOT NULL, -- e.g., 'staff_referral', 'social_comment'
    campaign_id TEXT,
    creative TEXT,
    identity_level TEXT NOT NULL, -- e.g., 'anonymous', 'identified'
    landing_timestamp TIMESTAMPTZ DEFAULT NOW(),
    is_authenticated BOOLEAN DEFAULT FALSE,
    verified_email TEXT,
    verified_phone TEXT,
    social_handle TEXT
);

-- 2. Chat Messages Table (Supports Voice Transcript IDs)
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL, -- 'patient', 'ai', 'clinician', 'system'
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    audio_transcript_id TEXT, -- Voice readiness field
    audio_metadata JSONB
);

-- 3. Living Memory Items Table
CREATE TABLE IF NOT EXISTS memory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    category TEXT NOT NULL, -- 'chief_complaint', 'medications', 'allergies'
    value TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'stopped', 'updated'
    provenance_pointer UUID REFERENCES messages(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Escalation & Triage Table
CREATE TABLE IF NOT EXISTS escalations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    triggering_message_id UUID REFERENCES messages(id),
    triage_summary JSONB NOT NULL, -- 1-5 bullet points
    profile_snapshot JSONB NOT NULL,
    risk_level TEXT NOT NULL, -- 'Med', 'High'
    status TEXT DEFAULT 'pending_review', -- 'pending_review', 'in_progress', 'resolved'
    clinician_response TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;

-- Sessions Policy: Patients can view their own session data
CREATE POLICY "Patients view own sessions"
ON sessions FOR SELECT
USING (auth.uid() = user_id);

-- Escalations Policy: Staff/Clinicians can view all escalations
CREATE POLICY "Staff view escalations"
ON escalations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.uid() = id AND raw_user_meta_data->>'role' IN ('clinician', 'nurse', 'staff')
  )
);