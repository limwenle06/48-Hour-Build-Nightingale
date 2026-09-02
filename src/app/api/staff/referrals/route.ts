import { NextResponse } from 'next/server';
import { createServerSupabaseClient, getAuthenticatedUser } from '../../../../server/auth/session';

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const auth = await getAuthenticatedUser(supabase);
  const requestId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString();

  if (!auth || auth.dbUser.role === 'patient') {
    return NextResponse.json({ error: { code: 'forbidden', message: 'Access denied' }, request_id: requestId }, { status: 403 });
  }

  const { data: staff } = await supabase.from('staff_users').select('*').eq('user_id', auth.dbUser.user_id).single();
  if (!staff) return NextResponse.json({ error: { code: 'forbidden', message: 'Staff profile not found' }, request_id: requestId }, { status: 403 });

  const body = await request.json();
  const { topic, token_hash, expires_at } = body;

  const { data, error } = await supabase
    .from('staff_referrals')
    .insert({
      clinic_id: staff.clinic_id,
      created_by_staff_user_id: staff.staff_user_id,
      topic,
      token_hash,
      status: 'active',
      expires_at,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: { code: 'internal_error', message: error.message }, request_id: requestId }, { status: 500 });

  return NextResponse.json({ data, request_id: requestId }, { status: 201 });
}