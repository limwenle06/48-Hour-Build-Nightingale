import { NextResponse } from 'next/server';
import { createServerSupabaseClient, getAuthenticatedUser } from '../../../server/auth/session';

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const auth = await getAuthenticatedUser(supabase);
  const requestId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString();

  if (!auth) {
    return NextResponse.json(
      { error: { code: 'unauthenticated', message: 'Unauthorized' }, request_id: requestId },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { clinic_id, consent_type, status, policy_version } = body;

    if (!clinic_id || !consent_type || !status || !policy_version) {
      return NextResponse.json(
        { error: { code: 'validation_error', message: 'Missing required consent fields' }, request_id: requestId },
        { status: 400 }
      );
    }

    let { data: patient } = await supabase
      .from('patients')
      .select('patient_id')
      .eq('user_id', auth.dbUser.user_id)
      .eq('clinic_id', clinic_id)
      .single();

    if (!patient) {
      const { data: newPatient, error: pError } = await supabase
        .from('patients')
        .insert({ user_id: auth.dbUser.user_id, clinic_id })
        .select()
        .single();
      if (pError || !newPatient) throw new Error('Failed to resolve patient record');
      patient = newPatient;
    }

    // Ensure TypeScript knows patient is non-null here
    const patientId = patient!.patient_id;

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('consents')
      .insert({
        patient_id: patientId,
        clinic_id,
        consent_type,
        status,
        policy_version,
        granted_at: status === 'granted' ? now : null,
        revoked_at: status === 'revoked' ? now : null,
      })
      .select()
      .single();

    return NextResponse.json({ data, request_id: requestId }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: 'internal_error', message: err.message || 'Failed to record consent' }, request_id: requestId },
      { status: 500 }
    );
  }
}