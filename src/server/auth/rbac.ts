// src/server/auth/rbac.ts
import { SupabaseClient } from '@supabase/supabase-js';

type AllowedRole = 'staff' | 'nurse' | 'clinician';

export async function verifyPatientAccess(
  supabase: SupabaseClient,
  userId: string,
  patientId: string,
  clinicId: string
): Promise<boolean> {
  // Ensure the patient record belongs strictly to the authenticated user and clinic
  const { data: patient, error } = await supabase
    .from('patients')
    .select('patient_id')
    .eq('patient_id', patientId)
    .eq('user_id', userId)
    .eq('clinic_id', clinicId)
    .single();

  if (error || !patient) {
    return false;
  }

  // Verify that active healthcare consent is granted for this clinic
  const { data: consent } = await supabase
    .from('consents')
    .select('status')
    .eq('patient_id', patientId)
    .eq('clinic_id', clinicId)
    .eq('consent_type', 'health_data_sharing')
    .eq('status', 'granted')
    .single();

  return !!consent;
}

export async function verifyStaffClinicAccess(
  supabase: SupabaseClient,
  userId: string,
  clinicId: string,
  allowedRoles: AllowedRole[]
): Promise<boolean> {
  const { data: staffUser, error } = await supabase
    .from('staff_users')
    .select('role, clinic_id')
    .eq('user_id', userId)
    .eq('clinic_id', clinicId)
    .single();

  if (error || !staffUser) {
    return false;
  }

  return allowedRoles.includes(staffUser.role);
}