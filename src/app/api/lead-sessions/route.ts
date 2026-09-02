import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../server/auth/session';

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const requestId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString();

  try {
    const body = await request.json();
    const { clinic_id, attribution, identity_level, social_handle, staff_referral_id } = body;

    if (!clinic_id || !attribution) {
      return NextResponse.json(
        { error: { code: 'validation_error', message: 'clinic_id and attribution are required' }, request_id: requestId },
        { status: 400 }
      );
    }

    const recoveryExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('lead_sessions')
      .insert({
        clinic_id,
        attribution,
        identity_level: identity_level || 'anonymous',
        social_handle,
        staff_referral_id,
        status: 'active',
        recovery_expires_at: recoveryExpiresAt,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ data, request_id: requestId }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: 'internal_error', message: err.message || 'Failed to create lead session' }, request_id: requestId },
      { status: 500 }
    );
  }
}