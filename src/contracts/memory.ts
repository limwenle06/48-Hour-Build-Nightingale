import { z } from "zod";

import { confidenceSchema, isoDateTimeSchema, uuidSchema } from "./common";

export const memoryTypeSchema = z.enum([
  "chief_complaint",
  "symptom",
  "symptom_timeline",
  "medication",
  "allergy",
]);
export type MemoryType = z.infer<typeof memoryTypeSchema>;

export const memoryStatusSchema = z.enum([
  "active",
  "stopped",
  "resolved",
  "historical",
  "unknown",
]);
export type MemoryStatus = z.infer<typeof memoryStatusSchema>;

export const memorySourceSessionTypeSchema = z.enum(["lead", "patient"]);
export type MemorySourceSessionType = z.infer<typeof memorySourceSessionTypeSchema>;

export const profileSnapshotItemSchema = z.object({
  memory_item_id: uuidSchema,
  type: memoryTypeSchema,
  value: z.string().trim().min(1).max(1_000),
  status: memoryStatusSchema,
  provenance_pointer: uuidSchema,
});
export type ProfileSnapshotItem = z.infer<typeof profileSnapshotItemSchema>;

export const memoryMutationProposalSchema = z.object({
  type: memoryTypeSchema,
  value: z.string().trim().min(1).max(1_000),
  normalized_value: z.string().trim().min(1).max(1_000),
  status: memoryStatusSchema,
  provenance_pointer: uuidSchema,
  supersedes_memory_item_id: uuidSchema.nullable(),
  confidence: confidenceSchema,
});
export type MemoryMutationProposal = z.infer<typeof memoryMutationProposalSchema>;

export const memoryItemSchema = memoryMutationProposalSchema.extend({
  memory_item_id: uuidSchema,
  patient_id: uuidSchema,
  source_session_type: memorySourceSessionTypeSchema,
  created_at: isoDateTimeSchema,
  updated_at: isoDateTimeSchema,
});
export type MemoryItem = z.infer<typeof memoryItemSchema>;
