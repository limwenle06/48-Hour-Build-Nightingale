import { z } from "zod";

import {
  isoDateTimeSchema,
  processingStatusSchema,
  senderTypeSchema,
  uuidSchema,
} from "./common";
import { escalationGenerationSchema } from "./escalation";
import { memoryMutationProposalSchema, profileSnapshotItemSchema } from "./memory";
import { riskDecisionSchema } from "./risk";

export const recentMessageSchema = z.object({
  message_id: uuidSchema,
  sender_type: senderTypeSchema,
  content: z.string().min(1).max(20_000),
  created_at: isoDateTimeSchema,
});
export type RecentMessage = z.infer<typeof recentMessageSchema>;

export const patientMessageProcessingInputSchema = z.object({
  clinic_id: uuidSchema,
  patient_id: uuidSchema,
  patient_session_id: uuidSchema,
  message_id: uuidSchema,
  raw_content: z.string().min(1).max(20_000),
  current_profile: z.array(profileSnapshotItemSchema).max(500),
  recent_messages: z.array(recentMessageSchema).max(50),
});
export type PatientMessageProcessingInput = z.infer<
  typeof patientMessageProcessingInputSchema
>;

export const assistantResponseSchema = z.object({
  content: z.string().trim().min(1).max(20_000),
  response_kind: z.enum(["normal", "safety", "fallback"]),
});
export type AssistantResponse = z.infer<typeof assistantResponseSchema>;

export const citationProposalSchema = z.object({
  title: z.string().trim().min(1).max(500),
  source_url: z.string().url(),
  publisher: z.string().trim().min(1).max(500),
  retrieved_at: isoDateTimeSchema,
});
export type CitationProposal = z.infer<typeof citationProposalSchema>;

export const patientMessageProcessingOutputSchema = z
  .object({
    processing_status: processingStatusSchema,
    risk: riskDecisionSchema,
    assistant_response: assistantResponseSchema.nullable(),
    memory_mutations: z.array(memoryMutationProposalSchema).max(100),
    escalation: escalationGenerationSchema.nullable(),
    citations: z.array(citationProposalSchema).max(20),
  })
  .superRefine((result, context) => {
    const normalResponseIsBlocked =
      result.risk.risk_level !== "low" ||
      result.risk.confidence === "low" ||
      result.risk.escalation_required;

    if (
      normalResponseIsBlocked &&
      result.assistant_response?.response_kind === "normal"
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assistant_response", "response_kind"],
        message: "Normal responses are not allowed when risk requires a safe path.",
      });
    }

    if (result.risk.escalation_required && result.escalation === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["escalation"],
        message: "Escalation details are required when escalation_required is true.",
      });
    }

    if (!result.risk.escalation_required && result.escalation !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["escalation"],
        message: "Escalation details require escalation_required to be true.",
      });
    }
  });
export type PatientMessageProcessingOutput = z.infer<
  typeof patientMessageProcessingOutputSchema
>;
