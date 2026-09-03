import type { SupabaseClient, User } from "@supabase/supabase-js";

import { ApiRouteError } from "@/server/http/api-response";

export async function requireVerifiedAuthUser(
  supabase: SupabaseClient,
): Promise<User & { email: string; email_confirmed_at: string }> {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new ApiRouteError(
      401,
      "unauthenticated",
      "Please sign in to continue.",
    );
  }

  if (!data.user.email || !data.user.email_confirmed_at) {
    throw new ApiRouteError(
      403,
      "forbidden",
      "Verify your email before continuing.",
    );
  }

  return data.user as User & {
    email: string;
    email_confirmed_at: string;
  };
}
