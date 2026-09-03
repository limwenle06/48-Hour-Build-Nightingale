export type SourceChannel =
  "staff_referral" | "social_comment" | "instagram_ad_click" | "website_widget";
export type SourcePlatform =
  "clinic" | "instagram" | "tiktok" | "facebook" | "website" | "other";
export type IdentityLevel =
  "anonymous" | "social_handle" | "contact_provided" | "verified";
export type TimeOfDay = "business_hours" | "after_hours";

export interface ChannelOpeningRule {
  source_channel: SourceChannel;
  identity_level: IdentityLevel;
  time_of_day: TimeOfDay;
  opening_strategy: string;
}
export const channelOpeningRules: ChannelOpeningRule[] = [
  {
    source_channel: "staff_referral",
    identity_level: "anonymous",
    time_of_day: "business_hours",
    opening_strategy: "staff_referral_known_topic",
  },
  {
    source_channel: "staff_referral",
    identity_level: "anonymous",
    time_of_day: "after_hours",
    opening_strategy: "staff_referral_known_topic",
  },
  {
    source_channel: "social_comment",
    identity_level: "social_handle",
    time_of_day: "business_hours",
    opening_strategy: "social_private_question",
  },
  {
    source_channel: "social_comment",
    identity_level: "social_handle",
    time_of_day: "after_hours",
    opening_strategy: "social_private_question",
  },
  {
    source_channel: "instagram_ad_click",
    identity_level: "anonymous",
    time_of_day: "business_hours",
    opening_strategy: "campaign_context",
  },
  {
    source_channel: "instagram_ad_click",
    identity_level: "anonymous",
    time_of_day: "after_hours",
    opening_strategy: "campaign_context",
  },
  {
    source_channel: "website_widget",
    identity_level: "anonymous",
    time_of_day: "business_hours",
    opening_strategy: "neutral_clinic_help",
  },
  {
    source_channel: "website_widget",
    identity_level: "anonymous",
    time_of_day: "after_hours",
    opening_strategy: "neutral_clinic_help",
  },
];

export const openingCopy: Record<string, string> = {
  staff_referral_known_topic:
    "Your care team shared a topic so you can continue without starting over.",
  social_private_question:
    "Thanks for reaching out. You can put your question into words here before choosing what to share.",
  campaign_context:
    "You came from a clinic information post. Ask a general question first — no account needed.",
  neutral_clinic_help:
    "Ask a general clinic or health question first — no account needed.",
};

const sourceChannels: readonly SourceChannel[] = [
  "staff_referral",
  "social_comment",
  "instagram_ad_click",
  "website_widget",
];
const sourcePlatforms: readonly SourcePlatform[] = [
  "clinic",
  "instagram",
  "tiktok",
  "facebook",
  "website",
  "other",
];

/** Keeps untrusted URL parameters inside the canonical acquisition contract. */
export function canonicalSourceChannel(value: string | null): SourceChannel {
  return sourceChannels.includes(value as SourceChannel)
    ? (value as SourceChannel)
    : "website_widget";
}

export function canonicalSourcePlatform(value: string | null): SourcePlatform {
  return sourcePlatforms.includes(value as SourcePlatform)
    ? (value as SourcePlatform)
    : "website";
}

export function clinicTimeOfDay(
  at: Date,
  timeZone: string,
): TimeOfDay {
  try {
    const hour = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone,
        hour: "2-digit",
        hourCycle: "h23",
      }).format(at),
    );
    return hour >= 8 && hour < 18 ? "business_hours" : "after_hours";
  } catch {
    return "after_hours";
  }
}

export function openingStrategyFor(
  sourceChannel: SourceChannel,
  identityLevel: IdentityLevel,
  at: Date,
  timeZone: string,
) {
  const timeOfDay = clinicTimeOfDay(at, timeZone);
  const exact = channelOpeningRules.find(
    (rule) =>
      rule.source_channel === sourceChannel &&
      rule.identity_level === identityLevel &&
      rule.time_of_day === timeOfDay,
  );
  const channelFallback = channelOpeningRules.find(
    (rule) =>
      rule.source_channel === sourceChannel && rule.time_of_day === timeOfDay,
  );

  return (exact ?? channelFallback)?.opening_strategy ?? "neutral_clinic_help";
}
