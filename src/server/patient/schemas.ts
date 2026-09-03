import { z } from "zod";

export const patientMessageRequestSchema = z
  .object({
    patient_session_id: z.string().uuid(),
    content: z.string().trim().min(1).max(20_000),
  })
  .strict();

export type PatientMessageRequest = z.infer<
  typeof patientMessageRequestSchema
>;

