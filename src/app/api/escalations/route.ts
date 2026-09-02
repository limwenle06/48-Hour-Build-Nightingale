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
    const { clinic_id, patient_id, patient_session_id, trigger_message_id, risk_assessment_id, triage_summary, profile_snapshot, provenance, attribution, risk_context } = body;

    const { data, error } = await supabase
      .from('escalations')
      .insert({
        clinic_id,
        patient_id,
        patient_session_id,
        trigger_message_id,
        risk_assessment_id,
        triage_summary,
        profile_snapshot,
        provenance,
        attribution,
        risk_context,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ data, request_id: requestId }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: 'internal_error', message: err.message || 'Failed to create escalation' }, request_id: requestId },
      { status: 500 }
    );
  }
}