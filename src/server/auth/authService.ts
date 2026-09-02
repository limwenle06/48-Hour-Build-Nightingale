// src/server/auth/authService.ts
import { SupabaseClient } from '@supabase/supabase-js';

interface EnsureIdentityShellInput {
  authUserId: string;
  verifiedEmail: string;
  clinicId: string;
  phone?: string | null;
}

export async function ensurePatientIdentityShell(
  supabase: SupabaseClient,
  input: EnsureIdentityShellInput
) {
  const { authUserId, verifiedEmail, clinicId, phone } = input;

  // 1. Find or create the User record
  let { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('auth_user_id', authUserId)
    .single();

  if (!user || userError) {
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        auth_user_id: authUserId,
        role: 'patient',
        verified_email: verifiedEmail,
        phone: phone || null,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError || !newUser) {
      throw new Error('Failed to provision user identity record');
    }
    user = newUser;
  } else {
    // Update contact info if changed, without altering historical keys or patient_id
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        verified_email: verifiedEmail,
        phone: phone !== undefined ? phone : user.phone,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.user_id)
      .select()
      .single();

    if (!updateError && updatedUser) {
      user = updatedUser;
    }
  }

  // 2. Ensure clinic-scoped Patient identity shell exists
  // This shell grants NO access to protected patient workflows until health consent is granted.
  let { data: patient, error: patientError } = await supabase
    .from('patients')
    .select('*')
    .eq('user_id', user.user_id)
    .eq('clinic_id', clinicId)
    .single();

  if (!patient || patientError) {
    const { data: newPatient, error: createPatientError } = await supabase
      .from('patients')
      .insert({
        user_id: user.user_id,
        clinic_id: clinicId,
      })
      .select()
      .single();

    if (createPatientError || !newPatient) {
      throw new Error('Failed to provision clinic-scoped patient identity shell');
    }
    patient = newPatient;
  }

  return {
    user,
    patient,
  };
}
