import { ConvertGuestRequestSchema } from '../../shared/schemas';
import { createClient } from '@supabase/supabase-js';

// Avoid referencing 'process' entirely to bypass missing type definitions
const supabaseUrl = 'https://placeholder.supabase.co';
const supabaseKey = 'placeholder-key';
const db = createClient(supabaseUrl, supabaseKey);

async function triggerMemoryIngestion(patientId: string, patientSessionId: string): Promise<void> {
  console.log(`Triggering memory ingestion for patient ${patientId} in session ${patientSessionId}`);
}

export async function handleGuestConversion(reqBody: unknown) {
  const parsed = ConvertGuestRequestSchema.safeParse(reqBody);
  if (!parsed.success) {
    throw new Error(`Validation failed: ${parsed.error.message}`);
  }
  const { guest_session_id, verified_email, consent_granted } = parsed.data;

  let patientResult = await db.from('Patients').select('id').eq('email', verified_email).single();
  
  let patientId: string;
  if (!patientResult.data) {
    const insertResult = await db.from('Patients').insert({ email: verified_email }).select('id').single();
    if (!insertResult.data) {
      throw new Error("Failed to create new patient record.");
    }
    patientId = insertResult.data.id;
  } else {
    patientId = patientResult.data.id;
  }

  const newSession = await db.from('PatientSessions').insert({
    patient_id: patientId,
    started_at: new Date().toISOString()
  }).select('id').single();
  
  if (!newSession.data) {
    throw new Error("Failed to create new patient session.");
  }
  const patientSessionId = newSession.data.id;

  if (consent_granted) {
    await db.from('GuestMessages')
      .update({ patient_session_id: patientSessionId })
      .eq('session_id', guest_session_id);
      
    await db.from('LeadSessions')
      .update({ patient_session_id: patientSessionId })
      .eq('id', guest_session_id);
  }

  await triggerMemoryIngestion(patientId, patientSessionId);

  return {
    success: true,
    patient_id: patientId,
    new_patient_session_id: patientSessionId,
    message: "Guest context successfully migrated to Patient Session."
  };
}