import { z } from "zod";

export const redactionDetectedTypeSchema = z.enum([
  "name",
  "national_id",
  "phone",
]);
export type RedactionDetectedType = z.infer<
  typeof redactionDetectedTypeSchema
>;

const redactionBaseSchema = z.object({
  detected_types: z.array(redactionDetectedTypeSchema).max(3),
  replacement_count: z.number().int().nonnegative(),
});

export const redactionSuccessSchema = redactionBaseSchema.extend({
  status: z.literal("success"),
  redacted_text: z.string(),
  failure_reason: z.null(),
});

export const redactionFailureSchema = redactionBaseSchema.extend({
  status: z.literal("failed"),
  redacted_text: z.null(),
  failure_reason: z.string().trim().min(1).max(200),
});

export const redactionResultSchema = z.discriminatedUnion("status", [
  redactionSuccessSchema,
  redactionFailureSchema,
]);
export type RedactionResult = z.infer<typeof redactionResultSchema>;
