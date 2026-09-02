import { z } from 'zod';

export const ConvertGuestRequestSchema = z.object({
  guest_session_id: z.string().uuid(),
  verified_email: z.string().email(),
  consent_granted: z.boolean().refine((val: boolean) => val === true, {
    message: "Explicit consent is legally required to migrate guest data."
  })
});

export const ConvertGuestResponseSchema = z.object({
  success: z.boolean(),
  patient_id: z.string().uuid(),
  new_patient_session_id: z.string().uuid(),
  message: z.string()
});

export const LeadScoreInputSchema = z.object({
  funnel_stage: z.enum(['visitor', 'conversation_started', 'value_event', 'auth_started', 'consented', 'patient_created']),
  last_active_at: z.string().datetime(),
  identity_level: z.enum(['anonymous', 'social_handle', 'email_known', 'verified_patient']),
  channel: z.enum(['staff_referral', 'lead_form', 'social_comment', 'ad_click', 'website_widget', 'google_reviews']),
  clinical_risk: z.enum(['none', 'low', 'medium', 'high', 'escalated']).default('none')
});

export type LeadScoreInput = z.infer<typeof LeadScoreInputSchema>;