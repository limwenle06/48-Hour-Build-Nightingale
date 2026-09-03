import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  profileSnapshotItemSchema,
  riskDecisionSchema,
  uuidSchema,
} from "@/contracts";

const timestampSchema = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value).toISOString());
const sourceChannelSchema = z.enum([
  "staff_referral",
  "social_comment",
  "instagram_ad_click",
  "website_widget",
]);
const sourcePlatformSchema = z.enum([
  "clinic",
  "instagram",
  "tiktok",
  "facebook",
  "website",
  "other",
]);
const attributionSchema = z.object({
  clinic_id: uuidSchema,
  source_channel: sourceChannelSchema,
  source_platform: sourcePlatformSchema,
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
const staffUserSchema = z.object({
  staff_user_id: uuidSchema,
  user_id: uuidSchema,
  clinic_id: uuidSchema,
  role: z.enum(["staff", "nurse", "clinician"]),
  created_at: timestampSchema,
});
const escalationSchema = z.object({
  escalation_id: uuidSchema,
  clinic_id: uuidSchema,
  patient_id: uuidSchema,
  patient_session_id: uuidSchema,
  trigger_message_id: uuidSchema,
  risk_assessment_id: uuidSchema,
  triage_summary: z.array(z.string().min(1).max(500)).min(1).max(5),
  profile_snapshot: z.array(profileSnapshotItemSchema).max(500),
  provenance: z.array(uuidSchema).min(1).max(100),
  attribution: attributionSchema,
  risk_context: z.object({
    risk_level: z.enum(["low", "medium", "high"]),
    risk_reason: z.string().min(1).max(500),
    confidence: z.enum(["low", "med", "high"]),
    risk_provenance: z.enum([
      "deterministic",
      "model",
      "combined",
      "system_fallback",
    ]),
    escalation_required: z.boolean(),
  }),
  status: z.enum(["pending", "in_review", "responded", "closed"]),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  clinician_response: z
    .object({
      responder_staff_user_id: uuidSchema,
      message: z.string().min(1).max(20_000),
      responded_at: timestampSchema,
    })
    .nullable(),
});
const escalationContextSchema = z.object({
  patient_id: uuidSchema,
  patient_session_id: uuidSchema,
  trigger_message_id: uuidSchema,
  raw_content: z.string().min(1).max(20_000),
  risk: riskDecisionSchema,
  current_profile: z.array(profileSnapshotItemSchema).max(500),
  attribution: attributionSchema,
});
const warmLeadSchema = z.object({
  lead_session_id: uuidSchema,
  source_channel: sourceChannelSchema,
  identity_level: z.enum([
    "anonymous",
    "social_handle",
    "contact_provided",
    "verified",
  ]),
  funnel_stage: z.enum([
    "visitor",
    "conversation_started",
    "value_event",
    "auth_started",
    "consented",
    "patient_created",
    "escalation_sent",
  ]),
  top_concern: z.string().nullable(),
  warm_lead_score: z.number().int().min(0).max(100),
  score_reasons: z.array(z.string()).max(10),
  last_activity_at: timestampSchema,
  contact_suggestion: z.string().nullable(),
});
const funnelMetricSchema = z.object({
  source_channel: sourceChannelSchema,
  visitors: z.number().int().nonnegative(),
  value_events: z.number().int().nonnegative(),
  patient_conversions: z.number().int().nonnegative(),
  escalations: z.number().int().nonnegative(),
});
const staffReferralSchema = z.object({
  staff_referral_id: uuidSchema,
  clinic_id: uuidSchema,
  created_by_staff_user_id: uuidSchema,
  topic: z.string().min(1).max(500),
  status: z.enum(["active", "converted", "expired", "revoked"]),
  expires_at: timestampSchema,
  created_at: timestampSchema,
});

export class StaffPersistenceError extends Error {
  constructor(
    readonly operation: string,
    readonly databaseCode?: string,
  ) {
    super(`The ${operation} database operation failed.`);
    this.name = "StaffPersistenceError";
  }
}

async function callRpc(
  admin: SupabaseClient,
  operation: string,
  parameters: Record<string, unknown>,
) {
  const { data, error } = await admin.rpc(operation, parameters);
  if (error) throw new StaffPersistenceError(operation, error.code);
  return data;
}

function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown, operation: string) {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new StaffPersistenceError(operation);
  return parsed.data;
}

export async function resolveStaffIdentity(
  admin: SupabaseClient,
  input: { auth_user_id: string; clinic_id: string },
) {
  const data = await callRpc(admin, "resolve_staff_identity", {
    p_auth_user_id: input.auth_user_id,
    p_clinic_id: input.clinic_id,
  });
  return parseOrThrow(staffUserSchema, data, "resolve_staff_identity");
}

export async function loadEscalationContext(
  admin: SupabaseClient,
  input: {
    auth_user_id: string;
    clinic_id: string;
    patient_session_id: string;
    trigger_message_id: string;
    risk_assessment_id: string;
  },
) {
  const data = await callRpc(admin, "load_escalation_context", {
    p_auth_user_id: input.auth_user_id,
    p_clinic_id: input.clinic_id,
    p_patient_session_id: input.patient_session_id,
    p_trigger_message_id: input.trigger_message_id,
    p_risk_assessment_id: input.risk_assessment_id,
  });
  return parseOrThrow(
    escalationContextSchema,
    data,
    "load_escalation_context",
  );
}

export async function persistEscalation(
  admin: SupabaseClient,
  input: {
    auth_user_id: string;
    clinic_id: string;
    patient_session_id: string;
    trigger_message_id: string;
    risk_assessment_id: string;
    triage_summary: string[];
    provenance: string[];
    request_id: string;
  },
) {
  const data = await callRpc(admin, "create_patient_escalation", {
    p_auth_user_id: input.auth_user_id,
    p_clinic_id: input.clinic_id,
    p_patient_session_id: input.patient_session_id,
    p_trigger_message_id: input.trigger_message_id,
    p_risk_assessment_id: input.risk_assessment_id,
    p_triage_summary: input.triage_summary,
    p_provenance: input.provenance,
    p_request_id: input.request_id,
  });
  return parseOrThrow(escalationSchema, data, "create_patient_escalation");
}

export async function listWarmLeads(
  admin: SupabaseClient,
  input: { auth_user_id: string; clinic_id: string },
) {
  const data = await callRpc(admin, "list_warm_leads", {
    p_auth_user_id: input.auth_user_id,
    p_clinic_id: input.clinic_id,
  });
  return parseOrThrow(z.array(warmLeadSchema).max(100), data, "list_warm_leads");
}

export async function listStaffEscalations(
  admin: SupabaseClient,
  input: { auth_user_id: string; clinic_id: string },
) {
  const data = await callRpc(admin, "list_staff_escalations", {
    p_auth_user_id: input.auth_user_id,
    p_clinic_id: input.clinic_id,
  });
  return parseOrThrow(
    z.array(escalationSchema).max(200),
    data,
    "list_staff_escalations",
  );
}

export async function createStaffReferral(
  admin: SupabaseClient,
  input: {
    auth_user_id: string;
    clinic_id: string;
    topic: string;
    token_hash: string;
    expires_in_hours: number;
    request_id: string;
  },
) {
  const data = await callRpc(admin, "create_staff_referral", {
    p_auth_user_id: input.auth_user_id,
    p_clinic_id: input.clinic_id,
    p_topic: input.topic,
    p_token_hash: input.token_hash,
    p_expires_in_hours: input.expires_in_hours,
    p_request_id: input.request_id,
  });
  return parseOrThrow(staffReferralSchema, data, "create_staff_referral");
}

export async function getStaffFunnelMetrics(
  admin: SupabaseClient,
  input: { auth_user_id: string; clinic_id: string },
) {
  const data = await callRpc(admin, "get_staff_funnel_metrics", {
    p_auth_user_id: input.auth_user_id,
    p_clinic_id: input.clinic_id,
  });
  return parseOrThrow(
    z.object({
      metrics: z.array(funnelMetricSchema).length(4),
      window: z.object({ from: timestampSchema, to: timestampSchema }),
    }),
    data,
    "get_staff_funnel_metrics",
  );
}
