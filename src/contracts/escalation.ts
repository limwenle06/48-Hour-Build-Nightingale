import { z } from "zod";

import { uuidSchema } from "./common";

export const escalationGenerationSchema = z.object({
  required: z.literal(true),
  triage_summary: z.array(z.string().trim().min(1).max(500)).min(1).max(5),
  provenance: z.array(uuidSchema).min(1).max(100),
});
export type EscalationGeneration = z.infer<typeof escalationGenerationSchema>;
