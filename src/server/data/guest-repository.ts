import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { LeadSessionRequest } from "@/server/guest/schemas";

const uuidSchema = z.string().uuid();
const timestampSchema = z.string().datetime({ offset: true });
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
const identityLevelSchema = z.enum([
  "anonymous",
  "social_handle",
  "contact_provided",
  "verified",
]);

export const persistedMessageSchema = z.object({
  message_id: uuidSchema,
  clinic_id: uuidSchema,
  session_type: z.enum(["lead", "patient"]),
  session_id: uuidSchema,
  sender_type: z.enum([
    "guest",
    "patient",
    "ai",
    "staff",
    "nurse",
    "clinician",
  ]),
  message_kind: z.enum(["text", "system"]),
  content: z.string().min(1).max(20_000),
  migrated_from_message_id: uuidSchema.nullable(),
  audio_asset_id: uuidSchema.nullable(),
  transcript_id: uuidSchema.nullable(),
  transcription_status: z.enum([
    "not_applicable",
    "pending",
    "completed",
    "failed",
  ]),
  created_at: timestampSchema,
});
export type PersistedMessage = z.infer<typeof persistedMessageSchema>;

export const persistedFunnelEventSchema = z.object({
  funnel_event_id: uuidSchema,
  clinic_id: uuidSchema,
  event_name: z.enum([
    "visitor",
    "conversation_started",
    "value_event",
    "auth_started",
    "consented",
    "patient_created",
    "escalation_sent",
  ]),
  lead_session_id: uuidSchema.nullable(),
  patient_id: uuidSchema.nullable(),
  patient_session_id: uuidSchema.nullable(),
  source_channel: sourceChannelSchema,
  campaign_id: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  occurred_at: timestampSchema,
});
export type PersistedFunnelEvent = z.infer<typeof persistedFunnelEventSchema>;

const leadSessionStateSchema = z.object({
  lead_session_id: uuidSchema,
  source_channel: sourceChannelSchema,
  source_platform: sourcePlatformSchema,
  identity_level: identityLevelSchema,
  recovery_expires_at: timestampSchema,
  clinic_timezone: z.string().min(1).max(100),
  recovered_messages: z.array(persistedMessageSchema),
});
export type LeadSessionState = z.infer<typeof leadSessionStateSchema>;

const guestExchangeSchema = z.object({
  guest_message: persistedMessageSchema,
  assistant_message: persistedMessageSchema,
  value_event: persistedFunnelEventSchema.nullable(),
});

export class GuestPersistenceError extends Error {
  constructor(
    readonly operation: string,
    readonly databaseCode?: string,
  ) {
    super(`The ${operation} database operation failed.`);
    this.name = "GuestPersistenceError";
  }
}

async function callRpc(
  admin: SupabaseClient,
  operation: string,
  parameters: Record<string, unknown>,
) {
  const { data, error } = await admin.rpc(operation, parameters);
  if (error) throw new GuestPersistenceError(operation, error.code);
  return data;
}

export async function recoverLeadSession(
  admin: SupabaseClient,
  input: { clinic_id: string; recovery_token_hash: string },
) {
  const data = await callRpc(admin, "recover_lead_session", {
    p_clinic_id: input.clinic_id,
    p_recovery_token_hash: input.recovery_token_hash,
  });
  const parsed = leadSessionStateSchema.nullable().safeParse(data);
  if (!parsed.success) throw new GuestPersistenceError("recover_lead_session");
  return parsed.data;
}

export async function createLeadSession(
  admin: SupabaseClient,
  input: LeadSessionRequest & {
    recovery_token_hash: string;
    referral_token_hash: string | null;
  },
) {
  const data = await callRpc(admin, "create_lead_session", {
    p_clinic_id: input.clinic_id,
    p_source_channel: input.source_channel,
    p_source_platform: input.source_platform,
    p_campaign_id: input.campaign_id ?? null,
    p_creative: input.creative ?? null,
    p_social_handle: input.social_handle ?? null,
    p_referral_token_hash: input.referral_token_hash,
    p_recovery_token_hash: input.recovery_token_hash,
  });
  const parsed = leadSessionStateSchema.safeParse(data);
  if (!parsed.success) throw new GuestPersistenceError("create_lead_session");
  return parsed.data;
}

export async function appendGuestExchange(
  admin: SupabaseClient,
  input: {
    lead_session_id: string;
    recovery_token_hash: string;
    guest_content: string;
    assistant_content: string;
    value_type: string | null;
  },
) {
  const data = await callRpc(admin, "append_guest_exchange", {
    p_lead_session_id: input.lead_session_id,
    p_recovery_token_hash: input.recovery_token_hash,
    p_guest_content: input.guest_content,
    p_assistant_content: input.assistant_content,
    p_value_type: input.value_type,
  });
  const parsed = guestExchangeSchema.safeParse(data);
  if (!parsed.success) throw new GuestPersistenceError("append_guest_exchange");
  return parsed.data;
}

export async function recordGuestFunnelEvent(
  admin: SupabaseClient,
  input: {
    lead_session_id: string;
    recovery_token_hash: string;
    event_name: "value_event" | "auth_started";
    metadata: Record<string, string | number | boolean | null>;
  },
) {
  const data = await callRpc(admin, "record_guest_funnel_event", {
    p_lead_session_id: input.lead_session_id,
    p_recovery_token_hash: input.recovery_token_hash,
    p_event_name: input.event_name,
    p_metadata: input.metadata,
  });
  const parsed = persistedFunnelEventSchema.safeParse(data);
  if (!parsed.success) {
    throw new GuestPersistenceError("record_guest_funnel_event");
  }
  return parsed.data;
}
