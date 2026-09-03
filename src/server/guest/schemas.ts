import { z } from "zod";

const sourceChannelSchema = z.enum([
  "staff_referral",
  "social_comment",
  "instagram_ad_click",
  "website_widget",
]);
const sourcePlatformSchema = z.enum([
  "clinic",
  "instagram",
  "tiktok",
  "facebook",
  "website",
  "other",
]);

const safeMetadataValueSchema = z.union([
  z.string().max(200),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);
const forbiddenMetadataKey =
  /content|message|name|email|phone|token|secret|password|prompt|response|national.?id|\bic\b/i;

export const leadSessionRequestSchema = z
  .object({
    clinic_id: z.string().uuid(),
    source_channel: sourceChannelSchema,
    source_platform: sourcePlatformSchema,
    campaign_id: z.string().trim().min(1).max(200).optional(),
    creative: z.string().trim().min(1).max(500).optional(),
    social_handle: z.string().trim().min(1).max(200).optional(),
    referral_token: z.string().trim().min(16).max(500).optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (
      (input.source_channel === "staff_referral") !==
      Boolean(input.referral_token)
    ) {
      context.addIssue({
        code: "custom",
        path: ["referral_token"],
        message: "Staff referrals require their private referral token.",
      });
    }
  });
export type LeadSessionRequest = z.infer<typeof leadSessionRequestSchema>;

export const guestMessageRequestSchema = z
  .object({
    lead_session_id: z.string().uuid(),
    content: z.string().trim().min(1).max(20_000),
  })
  .strict();
export type GuestMessageRequest = z.infer<typeof guestMessageRequestSchema>;

export const funnelEventRequestSchema = z
  .object({
    event_name: z.enum(["value_event", "auth_started"]),
    lead_session_id: z.string().uuid(),
    metadata: z
      .record(z.string().trim().min(1).max(64), safeMetadataValueSchema)
      .refine((metadata) => Object.keys(metadata).length <= 20, {
        message: "Funnel metadata contains too many fields.",
      })
      .refine(
        (metadata) =>
          Object.keys(metadata).every((key) => !forbiddenMetadataKey.test(key)),
        { message: "Funnel metadata cannot contain protected content." },
      )
      .optional(),
  })
  .strict();
export type FunnelEventRequest = z.infer<typeof funnelEventRequestSchema>;
