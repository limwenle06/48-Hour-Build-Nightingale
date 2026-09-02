// src/app/api/patient/profile/route.ts
import { NextResponse } from 'next/server';
import { createServerSupabaseClient, getAuthenticatedUser } from '../../../../server/auth/session';

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const auth = await getAuthenticatedUser(supabase);
  const requestId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString();

  if (!auth) {
    return NextResponse.json(
      { 
        error: { code: 'unauthenticated', message: 'Unauthorized' },
        request_id: requestId
      }, 
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const clinicId = url.searchParams.get('clinic_id');

  if (!clinicId) {
    return NextResponse.json(
      { 
        error: { code: 'validation_error', message: 'Clinic ID parameter is required' },
        request_id: requestId
      }, 
      { status: 400 }
    );
  }

  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .select('patient_id')
    .eq('user_id', auth.dbUser.user_id)
    .eq('clinic_id', clinicId)
    .single();

  if (patientError || !patient) {
    return NextResponse.json(
      { 
        error: { code: 'not_found', message: 'Patient record not found for this clinic' },
        request_id: requestId
      }, 
      { status: 404 }
    );
  }

  const { data: items, error: memoryError } = await supabase
    .from('memory_items')
    .select('*')
    .eq('patient_id', patient.patient_id);

  if (memoryError) {
    return NextResponse.json(
      { 
        error: { code: 'internal_error', message: 'Failed to retrieve profile items' },
        request_id: requestId
      }, 
      { status: 500 }
    );
  }

  return NextResponse.json({
    data: {
      patient_id: patient.patient_id,
      items: items || [],
    },
    request_id: requestId,
  });
}