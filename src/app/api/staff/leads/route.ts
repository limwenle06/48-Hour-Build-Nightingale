import { NextResponse } from 'next/server';
import { createServerSupabaseClient, getAuthenticatedUser } from '../../../../server/auth/session';

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const auth = await getAuthenticatedUser(supabase);
  const requestId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString();

  if (!auth || auth.dbUser.role === 'patient') {
    return NextResponse.json({ error: { code: 'forbidden', message: 'Access denied' }, request_id: requestId }, { status: 403 });
  }

  const { data: staff } = await supabase.from('staff_users').select('clinic_id').eq('user_id', auth.dbUser.user_id).single();
  if (!staff) return NextResponse.json({ data: [], request_id: requestId });

  const { data, error } = await supabase.from('lead_sessions').select('*').eq('clinic_id', staff.clinic_id);
  if (error) return NextResponse.json({ error: { code: 'internal_error', message: error.message }, request_id: requestId }, { status: 500 });

  return NextResponse.json({ data, request_id: requestId });
}