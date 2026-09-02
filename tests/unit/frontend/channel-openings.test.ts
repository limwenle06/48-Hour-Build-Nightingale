import { describe, expect, it } from "vitest";
import { channelOpeningRules, openingCopy } from "@/config/channel-openings";
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
});
