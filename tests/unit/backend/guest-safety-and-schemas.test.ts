import { describe, expect, it } from "vitest";

import {
  funnelEventRequestSchema,
  guestMessageRequestSchema,
  leadSessionRequestSchema,
} from "@/server/guest/schemas";
import { createSafeGuestResponse } from "@/server/guest/safe-response";

const clinicId = "11111111-1111-4111-8111-111111111111";
const leadId = "22222222-2222-4222-8222-222222222222";

describe("guest journey schemas and deterministic safety", () => {
  it("strictly validates acquisition and referral inputs", () => {
    expect(
      leadSessionRequestSchema.safeParse({
        clinic_id: clinicId,
        source_channel: "website_widget",
        source_platform: "website",
      }).success,
    ).toBe(true);
    expect(
      leadSessionRequestSchema.safeParse({
        clinic_id: clinicId,
        source_channel: "staff_referral",
        source_platform: "clinic",
      }).success,
    ).toBe(false);
    expect(
      leadSessionRequestSchema.safeParse({
        clinic_id: clinicId,
        source_channel: "staff_referral",
        source_platform: "clinic",
        referral_token: "synthetic-private-referral-token",
      }).success,
    ).toBe(true);
  });

  it("accepts only contracted guest-message fields", () => {
    expect(
      guestMessageRequestSchema.safeParse({
        lead_session_id: leadId,
        content: "I have a question.",
      }).success,
    ).toBe(true);
    expect(
      guestMessageRequestSchema.safeParse({
        lead_session_id: leadId,
        content: "I have a question.",
        patient_id: clinicId,
      }).success,
    ).toBe(false);
  });

  it("rejects server-authoritative events and protected funnel metadata", () => {
    expect(
      funnelEventRequestSchema.safeParse({
        lead_session_id: leadId,
        event_name: "auth_started",
      }).success,
    ).toBe(true);
    expect(
      funnelEventRequestSchema.safeParse({
        lead_session_id: leadId,
        event_name: "patient_created",
      }).success,
    ).toBe(false);
    expect(
      funnelEventRequestSchema.safeParse({
        lead_session_id: leadId,
        event_name: "value_event",
        metadata: { message_content: "synthetic private concern" },
      }).success,
    ).toBe(false);
  });

  it.each([
    "I have severe chest pain",
    "I cannot breathe",
    "I have heavy bleeding",
    "I want to hurt myself",
  ])("returns emergency guidance for %s", (content) => {
    const result = createSafeGuestResponse(content);
    expect(result.risk_level).toBe("high");
    expect(result.content).toContain("Call 999");
    expect(result.content).toContain("should not wait");
  });

  it("blocks ordinary advice for unclear chest symptoms", () => {
    const result = createSafeGuestResponse("My chest feels funny");
    expect(result.risk_level).toBe("medium");
    expect(result.content).toContain("nurse or clinician");
    expect(result.content).not.toMatch(/you (?:have|probably have)/i);
  });

  it("answers guest trust questions precisely", () => {
    const result = createSafeGuestResponse("Are you a real doctor?");
    expect(result.risk_level).toBe("low");
    expect(result.content).toContain("Nightingale AI");
    expect(result.content).toContain("not a doctor");
    expect(result.content).toContain("clinic");
    expect(result.content).toMatch(/nurse|clinician/);
  });
});
