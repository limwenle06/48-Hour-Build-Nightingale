import { z } from "zod";

export const uuidSchema = z.string().uuid();
export const isoDateTimeSchema = z.string().datetime();

export const confidenceSchema = z.enum(["low", "med", "high"]);
export type Confidence = z.infer<typeof confidenceSchema>;

export const processingStatusSchema = z.enum(["success", "blocked", "failed"]);
export type ProcessingStatus = z.infer<typeof processingStatusSchema>;

export const senderTypeSchema = z.enum([
  "guest",
  "patient",
  "ai",
  "staff",
  "nurse",
  "clinician",
]);
export type SenderType = z.infer<typeof senderTypeSchema>;
