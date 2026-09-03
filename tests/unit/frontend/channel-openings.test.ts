import { describe, expect, it } from "vitest";
import {
  canonicalSourceChannel,
  canonicalSourcePlatform,
  channelOpeningRules,
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
});
