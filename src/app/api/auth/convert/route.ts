// src/app/api/auth/convert/route.ts
import { NextResponse } from 'next/server';
import { createServerSupabaseClient, getAuthenticatedUser } from '../../../../server/auth/session';

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
    const { lead_session_id, health_consent_id } = body;

    if (!lead_session_id || !health_consent_id) {
      return NextResponse.json(
        { error: { code: 'validation_error', message: 'lead_session_id and health_consent_id are required' }, request_id: requestId },
        { status: 400 }
      );
    }

    // 1. Fetch Lead Session to get clinic_id
    const { data: leadSession, error: leadError } = await supabase
      .from('lead_sessions')
      .select('*')
      .eq('lead_session_id', lead_session_id)
      .single();

    if (leadError || !leadSession) {
      return NextResponse.json(
        { error: { code: 'not_found', message: 'Lead session not found' }, request_id: requestId },
        { status: 404 }
      );
    }

    // 2. Execute atomic and idempotent transaction via Supabase RPC
    const { data, error } = await supabase.rpc('guest_to_patient_conversion', {
      p_lead_session_id: lead_session_id,
      p_user_id: auth.dbUser.user_id,
      p_clinic_id: leadSession.clinic_id,
      p_consent_id: health_consent_id,
    });

    if (error) {
      return NextResponse.json(
        { error: { code: 'conversion_failed', message: error.message }, request_id: requestId },
        { status: 400 }
      );
    }

    return NextResponse.json({
      data: {
        patient: data.patient,
        patient_session: data.patient_session,
        source_message_ids: [],
        attribution: data.attribution,
      },
      request_id: requestId,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: 'internal_error', message: err.message || 'Conversion failed' }, request_id: requestId },
      { status: 500 }
    );
  }
}