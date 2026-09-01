// src/server/data/sessionRepository.ts
import { createClient } from '@supabase/supabase-js';
import { LeadSession, PatientSession, ChannelSource } from '../../contracts';

// Initialize Supabase Client
declare const process: { env: Record<string, string | undefined> };
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 1. Create LeadSession in Supabase DB
 */
export async function createLeadSession(data: {
  clinic_id: string;
  source_channel: ChannelSource;
  campaign_id?: string;
  creative?: string;
}): Promise<LeadSession> {
  const { data: session, error } = await supabase
    .from('sessions')
    .insert({
      clinic_id: data.clinic_id,
      source_channel: data.source_channel,
      campaign_id: data.campaign_id,
      creative: data.creative,
      identity_level: 'anonymous',
      is_authenticated: false,
    })
    .select()
    .single();

  if (error || !session) {
    throw new Error(`Failed to create lead session: ${error?.message}`);
  }

  return session as LeadSession;
}

/**
 * 2. Convert LeadSession -> PatientSession in Supabase DB
 */
export async function convertToPatientSession(
  leadSessionId: string,
  patientData: {
    patient_id: string;
    verified_email: string;
    verified_phone: string;
    marketing_consent: boolean;
  }
): Promise<PatientSession> {
  const consentedAt = new Date().toISOString();

  const { data: updatedSession, error } = await supabase
    .from('sessions')
    .update({
      user_id: patientData.patient_id,
      identity_level: 'identified',
      is_authenticated: true,
      verified_email: patientData.verified_email,
      verified_phone: patientData.verified_phone,
    })
    .eq('id', leadSessionId)
    .select()
    .single();

  if (error || !updatedSession) {
    throw new Error(`Failed to convert session: ${error?.message}`);
  }

  return {
    ...updatedSession,
    patient_id: patientData.patient_id,
    consented_at: consentedAt,
    marketing_consent: patientData.marketing_consent,
  } as PatientSession;
}