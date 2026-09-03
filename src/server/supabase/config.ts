import { z } from "zod";

const publicConfigSchema = z.object({
  url: z.string().url(),
  anon_key: z.string().min(20),
});

const adminConfigSchema = publicConfigSchema.extend({
  service_role_key: z.string().min(20),
});

export class SupabaseConfigurationError extends Error {
  constructor() {
    super("Supabase server configuration is incomplete.");
    this.name = "SupabaseConfigurationError";
  }
}

export function getSupabasePublicConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  const result = publicConfigSchema.safeParse({
    url: environment.NEXT_PUBLIC_SUPABASE_URL,
    anon_key: environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!result.success) throw new SupabaseConfigurationError();
  return result.data;
}

export function getSupabaseAdminConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  const result = adminConfigSchema.safeParse({
    url: environment.NEXT_PUBLIC_SUPABASE_URL,
    anon_key: environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    service_role_key: environment.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!result.success) throw new SupabaseConfigurationError();
  return result.data;
}

export function getNightingaleClinicId(
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  const result = z.string().uuid().safeParse(
    environment.NEXT_PUBLIC_NIGHTINGALE_CLINIC_ID,
  );

  if (!result.success) throw new SupabaseConfigurationError();
  return result.data;
}
