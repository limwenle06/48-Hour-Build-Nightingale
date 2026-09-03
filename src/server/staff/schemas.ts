import { z } from "zod";

export const staffAuthRequestSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("sign_in"),
      email: z.string().trim().email().max(320),
      password: z.string().min(8).max(128),
    })
    .strict(),
  z.object({ action: z.literal("sign_out") }).strict(),
]);

export const escalationRequestSchema = z
  .object({
    patient_session_id: z.string().uuid(),
    trigger_message_id: z.string().uuid(),
    risk_assessment_id: z.string().uuid(),
  })
  .strict();

export const staffReferralRequestSchema = z
  .object({
    topic: z.string().trim().min(1).max(500),
    expires_in_hours: z.number().int().min(1).max(168).optional().default(72),
  })
  .strict();

