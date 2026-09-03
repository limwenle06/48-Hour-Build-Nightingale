import { z } from "zod";

export const patientAuthRequestSchema = z
  .object({
    action: z.enum(["sign_up", "sign_in"]),
    clinic_id: z.string().uuid(),
    email: z.string().trim().email().max(320),
    password: z.string().min(8).max(128),
    phone: z.string().trim().min(5).max(50).nullable().optional(),
  })
  .strict();
export type PatientAuthRequest = z.infer<typeof patientAuthRequestSchema>;

export const consentRequestSchema = z
  .object({
    clinic_id: z.string().uuid(),
    consent_type: z.enum(["health_data_sharing", "marketing"]),
    status: z.enum(["granted", "revoked"]),
    policy_version: z.string().trim().min(1).max(100),
  })
  .strict();
export type ConsentRequest = z.infer<typeof consentRequestSchema>;

export const conversionRequestSchema = z
  .object({
    lead_session_id: z.string().uuid(),
    health_consent_id: z.string().uuid(),
  })
  .strict();
export type ConversionRequest = z.infer<typeof conversionRequestSchema>;
