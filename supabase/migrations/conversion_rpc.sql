-- supabase/migrations/0002_conversion_rpc.sql

CREATE OR REPLACE FUNCTION guest_to_patient_conversion(
    p_lead_session_id UUID,
    p_user_id UUID,
    p_clinic_id UUID,
    p_consent_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lead RECORD;
    v_patient RECORD;
    v_consent RECORD;
    v_session RECORD;
BEGIN
    -- 1. Lock and validate lead session
    SELECT * INTO v_lead FROM lead_sessions 
    WHERE lead_session_id = p_lead_session_id AND clinic_id = p_clinic_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lead session not found';
    END IF;

    -- Idempotency check: Return existing if already converted
    IF v_lead.status = 'converted' AND v_lead.converted_patient_id IS NOT NULL THEN
        SELECT * INTO v_patient FROM patients WHERE patient_id = v_lead.converted_patient_id;
        SELECT * INTO v_session FROM patient_sessions WHERE patient_session_id = v_lead.converted_patient_session_id;
        RETURN jsonb_build_object(
            'patient', row_to_json(v_patient),
            'patient_session', row_to_json(v_session),
            'attribution', v_lead.attribution
        );
    END IF;

    -- 2. Resolve or create Patient identity shell[cite: 3]
    SELECT * INTO v_patient FROM patients 
    WHERE user_id = p_user_id AND clinic_id = p_clinic_id;

    IF NOT FOUND THEN
        INSERT INTO patients (user_id, clinic_id)
        VALUES (p_user_id, p_clinic_id)
        RETURNING * INTO v_patient;
    END IF;

    -- 3. Validate health consent[cite: 3]
    SELECT * INTO v_consent FROM consents
    WHERE consent_id = p_consent_id 
      AND patient_id = v_patient.patient_id 
      AND clinic_id = p_clinic_id 
      AND consent_type = 'health_data_sharing' 
      AND status = 'granted';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Valid granted health data sharing consent is required';
    END IF;

    -- 4. Create PatientSession & copy Attribution[cite: 3]
    INSERT INTO patient_sessions (patient_id, clinic_id, source_lead_session_id, attribution, started_at)
    VALUES (v_patient.patient_id, p_clinic_id, p_lead_session_id, v_lead.attribution, now())
    RETURNING * INTO v_session;

    -- 5. Mark LeadSession converted[cite: 3]
    UPDATE lead_sessions
    SET status = 'converted',
        converted_patient_id = v_patient.patient_id,
        converted_patient_session_id = v_session.patient_session_id,
        updated_at = now()
    WHERE lead_session_id = p_lead_session_id;

    -- 6. Append 'patient_created' funnel event exactly once[cite: 3]
    INSERT INTO funnel_events (clinic_id, event_name, lead_session_id, patient_id, patient_session_id, source_channel, campaign_id, metadata, occurred_at)
    VALUES (p_clinic_id, 'patient_created', p_lead_session_id, v_patient.patient_id, v_session.patient_session_id, v_lead.attribution->>'source_channel', v_lead.attribution->>'campaign_id', '{}'::jsonb, now());

    RETURN jsonb_build_object(
        'patient', row_to_json(v_patient),
        'patient_session', row_to_json(v_session),
        'attribution', v_lead.attribution
    );
END;
$$;