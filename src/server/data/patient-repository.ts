import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  memoryItemSchema,
  patientMessageProcessingOutputSchema,
  profileSnapshotItemSchema,
  recentMessageSchema,
  riskAssessmentSchema,
  uuidSchema,
  type PatientMessageProcessingOutput,
} from "@/contracts";
import { persistedMessageSchema } from "@/server/data/guest-repository";

const timestampSchema = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value).toISOString());

const citationSchema = z.object({
  citation_id: uuidSchema,
  message_id: uuidSchema,
  title: z.string().min(1).max(500),
  source_url: z.string().url(),
  publisher: z.string().min(1).max(500),
  retrieved_at: timestampSchema,
});

const patientMessageContextSchema = z.object({
  patient_message: persistedMessageSchema,
  patient_id: uuidSchema,
  clinic_id: uuidSchema,
  current_profile: z.array(profileSnapshotItemSchema).max(500),
  recent_messages: z.array(recentMessageSchema).max(50),
});

const patientReplySchema = z.object({
  patient_message: persistedMessageSchema,
  risk_assessment: riskAssessmentSchema,
  assistant_message: persistedMessageSchema.nullable(),
  profile_changes: z.array(memoryItemSchema).max(100),
  escalation_required: z.boolean(),
  send_to_clinic_available: z.boolean(),
  citations: z.array(citationSchema).max(20),
  processing_status: z.enum(["success", "blocked", "failed"]),
});

const patientProfileSchema = z.object({
  patient_id: uuidSchema,
  items: z.array(memoryItemSchema).max(500),
});

export type PatientMessageContext = z.infer<
  typeof patientMessageContextSchema
>;
export type PatientReply = z.infer<typeof patientReplySchema>;
export type PatientProfile = z.infer<typeof patientProfileSchema>;

export class PatientPersistenceError extends Error {
  constructor(
    readonly operation: string,
    readonly databaseCode?: string,
  ) {
    super(`The ${operation} database operation failed.`);
    this.name = "PatientPersistenceError";
  }
}

async function callRpc(
  admin: SupabaseClient,
  operation: string,
  parameters: Record<string, unknown>,
) {
  const { data, error } = await admin.rpc(operation, parameters);
  if (error) throw new PatientPersistenceError(operation, error.code);
  return data;
}

export async function beginPatientMessage(
  admin: SupabaseClient,
  input: {
    auth_user_id: string;
    clinic_id: string;
    patient_session_id: string;
    content: string;
    request_id: string;
  },
): Promise<PatientMessageContext> {
  const data = await callRpc(admin, "begin_patient_message", {
    p_auth_user_id: input.auth_user_id,
    p_clinic_id: input.clinic_id,
    p_patient_session_id: input.patient_session_id,
    p_content: input.content,
    p_request_id: input.request_id,
  });
  const parsed = patientMessageContextSchema.safeParse(data);
  if (!parsed.success) throw new PatientPersistenceError("begin_patient_message");
  return parsed.data;
}

export async function finalizePatientMessage(
  admin: SupabaseClient,
  input: {
    auth_user_id: string;
    clinic_id: string;
    patient_session_id: string;
    message_id: string;
    result: PatientMessageProcessingOutput;
    request_id: string;
  },
): Promise<PatientReply> {
  const validatedResult = patientMessageProcessingOutputSchema.parse(
    input.result,
  );
  const data = await callRpc(admin, "finalize_patient_message", {
    p_auth_user_id: input.auth_user_id,
    p_clinic_id: input.clinic_id,
    p_patient_session_id: input.patient_session_id,
    p_message_id: input.message_id,
    p_risk: validatedResult.risk,
    p_assistant_response: validatedResult.assistant_response,
    p_memory_mutations: validatedResult.memory_mutations,
    p_citations: validatedResult.citations,
    p_processing_status: validatedResult.processing_status,
    p_request_id: input.request_id,
  });
  const parsed = patientReplySchema.safeParse(data);
  if (!parsed.success) throw new PatientPersistenceError("finalize_patient_message");
  return parsed.data;
}

export async function getPatientProfile(
  admin: SupabaseClient,
  input: { auth_user_id: string; clinic_id: string },
): Promise<PatientProfile> {
  const data = await callRpc(admin, "get_patient_profile", {
    p_auth_user_id: input.auth_user_id,
    p_clinic_id: input.clinic_id,
  });
  const parsed = patientProfileSchema.safeParse(data);
  if (!parsed.success) throw new PatientPersistenceError("get_patient_profile");
  return parsed.data;
}
