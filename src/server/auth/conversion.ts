// src/server/auth/conversion.ts
import { SupabaseClient } from '@supabase/supabase-js';

interface ConversionInput {
  clinicId: string;
  userId: string;
  leadSessionId: string;
  healthConsentId: string;
}

export async function executeGuestToPatientConversion(
  supabase: SupabaseClient,
  input: ConversionInput
) {
  const { clinicId, userId, leadSessionId, healthConsentId } = input;

  // 1. Idempotency check: Return existing patient session if already converted
  const { data: existingLead, error: leadFetchError } = await supabase
    .from('lead_sessions')
    .select('*')
    .eq('lead_session_id', leadSessionId)
    .eq('clinic_id', clinicId)
    .single();

  if (leadFetchError || !existingLead) {
    throw new Error('Lead session not found');
  }

  if (
    existingLead.status === 'converted' &&
    existingLead.converted_patient_id &&
    existingLead.converted_patient_session_id
  ) {
    const { data: patient } = await supabase
      .from('patients')
      .select('*')
      .eq('patient_id', existingLead.converted_patient_id)
      .single();

    const { data: patientSession } = await supabase
      .from('patient_sessions')
      .select('*')
      .eq('patient_session_id', existingLead.converted_patient_session_id)
      .single();

    return {
      patient,
      patient_session: patientSession,
      source_message_ids: [],
      attribution: existingLead.attribution,
    };
  }

  // 2. Resolve or create immutable Patient for User and Clinic
  let { data: patient } = await supabase
    .from('patients')
    .select('*')
    .eq('user_id', userId)
    .eq('clinic_id', clinicId)
    .single();

  if (!patient) {
    const { data: newPatient, error: createPatientError } = await supabase
      .from('patients')
      .insert({ user_id: userId, clinic_id: clinicId })
      .select()
      .single();
    if (createPatientError) throw new Error('Failed to resolve/create patient identity');
    patient = newPatient;
  }

  // 3. Validate health consent belongs to patient and is granted
  const { data: consent, error: consentError } = await supabase
    .from('consents')
    .select('*')
    .eq('consent_id', healthConsentId)
    .eq('patient_id', patient.patient_id)
    .eq('clinic_id', clinicId)
    .eq('consent_type', 'health_data_sharing')
    .eq('status', 'granted')
    .single();

  if (consentError || !consent) {
    throw new Error('Valid granted health consent required for conversion');
  }

  // 4. Create PatientSession linked to LeadSession & copy Attribution
  const { data: patientSession, error: sessionError } = await supabase
    .from('patient_sessions')
    .insert({
      patient_id: patient.patient_id,
      clinic_id: clinicId,
      source_lead_session_id: leadSessionId,
      attribution: existingLead.attribution,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (sessionError || !patientSession) {
    throw new Error('Failed to create patient session');
  }

  // 5. Update LeadSession status to converted
  const { error: updateLeadError } = await supabase
    .from('lead_sessions')
    .update({
      status: 'converted',
      converted_patient_id: patient.patient_id,
      converted_patient_session_id: patientSession.patient_session_id,
      updated_at: new Date().toISOString(),
    })
    .eq('lead_session_id', leadSessionId);

  if (updateLeadError) {
    throw new Error('Failed to update lead session status');
  }

  // 6. Append funnel event 'patient_created' exactly once
  await supabase.from('funnel_events').insert({
    clinic_id: clinicId,
    event_name: 'patient_created',
    lead_session_id: leadSessionId,
    patient_id: patient.patient_id,
    patient_session_id: patientSession.patient_session_id,
    source_channel: existingLead.attribution.source_channel,
    campaign_id: existingLead.attribution.campaign_id,
    metadata: {},
    occurred_at: new Date().toISOString(),
  });

  return {
    patient,
    patient_session: patientSession,
    source_message_ids: [],
    attribution: existingLead.attribution,
  };
}
