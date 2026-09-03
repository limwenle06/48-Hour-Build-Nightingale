import { describe, expect, it } from "vitest";
import {
  canonicalSourceChannel,
  canonicalSourcePlatform,
  channelOpeningRules,
  clinicTimeOfDay,
  openingStrategyFor,
  openingCopy,
} from "@/config/channel-openings";
describe("channel openings", () => {
  it("covers four contracted channels declaratively", () => {
    expect(new Set(channelOpeningRules.map((x) => x.source_channel))).toEqual(
      new Set([
        "staff_referral",
        "social_comment",
        "instagram_ad_click",
        "website_widget",
      ]),
    );
    expect(channelOpeningRules).toHaveLength(8);
  });
  it("uses stable strategy keys with patient copy", () => {
    for (const rule of channelOpeningRules)
      expect(openingCopy[rule.opening_strategy]).toBeTruthy();
  });
  it("constrains acquisition URL values to canonical contract enums", () => {
    expect(canonicalSourceChannel("social_comment")).toBe("social_comment");
    expect(canonicalSourceChannel("instagram_comment")).toBe("website_widget");
    expect(canonicalSourcePlatform("tiktok")).toBe("tiktok");
    expect(canonicalSourcePlatform("unknown-platform")).toBe("website");
  });
  it("uses the clinic timezone and declarative matrix", () => {
    expect(
      clinicTimeOfDay(new Date("2026-09-03T02:00:00.000Z"), "Asia/Kuala_Lumpur"),
    ).toBe("business_hours");
    expect(
      clinicTimeOfDay(new Date("2026-09-03T20:00:00.000Z"), "Asia/Kuala_Lumpur"),
    ).toBe("after_hours");
    expect(
      openingStrategyFor(
        "social_comment",
        "anonymous",
        new Date("2026-09-03T02:00:00.000Z"),
        "Asia/Kuala_Lumpur",
      ),
    ).toBe("social_private_question");
  });
});
