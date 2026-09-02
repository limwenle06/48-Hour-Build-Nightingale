// src/server/auth/session.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function createServerSupabaseClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const token = cookieStore.get('sb-access-token')?.value || '';

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
      },
      global: {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      },
    }
  );
}

export async function getAuthenticatedUser(supabase: SupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const { data: dbUser, error: dbError } = await supabase
    .from('users')
    .select('*')
    .eq('auth_user_id', user.id)
    .single();

  if (dbError || !dbUser) {
    return null;
  }

  return {
    authUserId: user.id,
    email: user.email,
    dbUser,
  };
}