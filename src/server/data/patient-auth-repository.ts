import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const uuidSchema = z.string().uuid();
const timestampSchema = z.string().datetime({ offset: true });

const patientSchema = z.object({
  patient_id: uuidSchema,
  user_id: uuidSchema,
  clinic_id: uuidSchema,
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

const identityResultSchema = z.object({
  patient: patientSchema,
});

const consentSchema = z.object({
  consent_id: uuidSchema,
  patient_id: uuidSchema,
  clinic_id: uuidSchema,
  consent_type: z.enum(["health_data_sharing", "marketing"]),
  status: z.enum(["granted", "revoked"]),
  policy_version: z.string(),
  granted_at: timestampSchema.nullable(),
  revoked_at: timestampSchema.nullable(),
  created_at: timestampSchema,
});

const consentResultSchema = z.object({ consent: consentSchema });

const attributionSchema = z.object({
  clinic_id: uuidSchema,
  source_channel: z.enum([
    "staff_referral",
    "social_comment",
    "instagram_ad_click",
    "website_widget",
  ]),
  source_platform: z.enum([
    "clinic",
    "instagram",
    "tiktok",
    "facebook",
    "website",
    "other",
  ]),
  campaign_id: z.string().nullable(),
  creative: z.string().nullable(),
  identity_level: z.enum([
    "anonymous",
    "social_handle",
    "contact_provided",
    "verified",
  ]),
  landing_timestamp: timestampSchema,
});

const patientSessionSchema = z.object({
  patient_session_id: uuidSchema,
  patient_id: uuidSchema,
  clinic_id: uuidSchema,
  source_lead_session_id: uuidSchema.nullable(),
  attribution: attributionSchema,
  started_at: timestampSchema,
  ended_at: timestampSchema.nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

const conversionResultSchema = z.object({
  patient: patientSchema,
  patient_session: patientSessionSchema,
  source_message_ids: z.array(uuidSchema),
  attribution: attributionSchema,
});

export class PersistenceError extends Error {
  constructor(
    readonly operation: string,
    readonly databaseCode?: string,
  ) {
    super(`The ${operation} database operation failed.`);
    this.name = "PersistenceError";
  }
}

async function callRpc(
  admin: SupabaseClient,
  operation: string,
  parameters: Record<string, unknown>,
) {
  const { data, error } = await admin.rpc(operation, parameters);
  if (error) throw new PersistenceError(operation, error.code);
  return data;
}

export async function ensurePatientIdentity(
  admin: SupabaseClient,
  input: {
    auth_user_id: string;
    verified_email: string;
    phone: string | null;
    clinic_id: string;
  },
) {
  const data = await callRpc(admin, "ensure_patient_identity", {
    p_auth_user_id: input.auth_user_id,
    p_verified_email: input.verified_email,
    p_phone: input.phone,
    p_clinic_id: input.clinic_id,
  });

  const parsed = identityResultSchema.safeParse(data);
  if (!parsed.success) throw new PersistenceError("ensure_patient_identity");
  return parsed.data;
}

export async function recordPatientConsent(
  admin: SupabaseClient,
  input: {
    auth_user_id: string;
    clinic_id: string;
    consent_type: "health_data_sharing" | "marketing";
    status: "granted" | "revoked";
    policy_version: string;
    recovery_token_hash: string | null;
  },
) {
  const data = await callRpc(admin, "record_patient_consent_with_recovery", {
    p_auth_user_id: input.auth_user_id,
    p_clinic_id: input.clinic_id,
    p_consent_type: input.consent_type,
    p_status: input.status,
    p_policy_version: input.policy_version,
    p_recovery_token_hash: input.recovery_token_hash,
  });

  const parsed = consentResultSchema.safeParse(data);
  if (!parsed.success) throw new PersistenceError("record_patient_consent");
  return parsed.data;
}

export async function convertLeadSession(
  admin: SupabaseClient,
  input: {
    auth_user_id: string;
    lead_session_id: string;
    health_consent_id: string;
    recovery_token_hash: string;
  },
) {
  const data = await callRpc(admin, "convert_lead_session", {
    p_auth_user_id: input.auth_user_id,
    p_lead_session_id: input.lead_session_id,
    p_health_consent_id: input.health_consent_id,
    p_recovery_token_hash: input.recovery_token_hash,
  });

  const parsed = conversionResultSchema.safeParse(data);
  if (!parsed.success) throw new PersistenceError("convert_lead_session");
  return parsed.data;
}
