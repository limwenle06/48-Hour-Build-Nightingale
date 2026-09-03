import { createClient } from "@supabase/supabase-js";

import { getSupabaseAdminConfig } from "./config";

export function createSupabaseAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("The Supabase admin client is server-only.");
  }

  const config = getSupabaseAdminConfig();
  return createClient(config.url, config.service_role_key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
