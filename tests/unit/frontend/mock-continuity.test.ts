import { beforeEach, describe, expect, it, vi } from "vitest";

describe("synthetic frontend adapter", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_NIGHTINGALE_MOCK", "true");
  });

  it("does not fabricate a stomach complaint for a new profile", async () => {
    const { api } = await import("@/components/nightingale/api-client");
    expect((await api.getProfile()).items).toEqual([]);
    expect(JSON.stringify(await api.getProfile())).not.toContain(
      "Stomach discomfort",
    );
  });

  it("does not turn hi into a MemoryItem", async () => {
    const { api } = await import("@/components/nightingale/api-client");
    const lead = await api.createLead({
      clinic_id: "clinic_demo",
      source_channel: "website_widget",
      source_platform: "website",
    });
    await api.sendGuest(lead.lead_session_id, "hi");
    expect((await api.getProfile()).items).toEqual([]);
  });

  it("preserves exact guest messages and attribution through mock conversion", async () => {
    const { api } = await import("@/components/nightingale/api-client");
    const lead = await api.createLead({
      clinic_id: "clinic_demo",
      source_channel: "instagram_ad_click",
      source_platform: "instagram",
      campaign_id: "synthetic_campaign",
    });
    await api.sendGuest(lead.lead_session_id, "hi");
    const conversion = await api.consentAndConvert(lead.lead_session_id);
    const snapshot = api.getMockJourney();
    expect(snapshot.guest_messages.map((message) => message.content)).toContain(
      "hi",
    );
    expect(snapshot.attribution).toMatchObject({
      source_channel: "instagram_ad_click",
      campaign_id: "synthetic_campaign",
    });
    expect(conversion.source_message_ids).toHaveLength(1);
    expect((await api.getProfile()).items).toEqual([]);
  });

  it("restores mock conversation after a module remount", async () => {
    const first = (await import("@/components/nightingale/api-client")).api;
    const lead = await first.createLead({
      clinic_id: "clinic_demo",
      source_channel: "social_comment",
      source_platform: "instagram",
    });
    await first.sendGuest(lead.lead_session_id, "my question");
    vi.resetModules();
    const remounted = (await import("@/components/nightingale/api-client")).api;
    expect(
      remounted
        .getMockJourney()
        .guest_messages.some((message) => message.content === "my question"),
    ).toBe(true);
    expect(remounted.getMockJourney().attribution?.source_channel).toBe(
      "social_comment",
    );
  });

  it("uses exact high, medium, and failed fixtures without generating ordinary advice", async () => {
    const { api } = await import("@/components/nightingale/api-client");
    const high = await api.sendPatient(
      "patient_session_demo",
      "I want to hurt myself",
    );
    expect(high.risk_assessment.risk_level).toBe("high");
    expect(high.processing_status).toBe("blocked");
    expect(high.escalation_required).toBe(true);
    expect(high.assistant_message).toBeNull();
    const medium = await api.sendPatient(
      "patient_session_demo",
      "My chest feels funny",
    );
    expect(medium.risk_assessment.risk_level).toBe("medium");
    expect(medium.assistant_message).toBeNull();
    const failed = await api.sendPatient(
      "patient_session_demo",
      "Demo: processing failure",
    );
    expect(failed.processing_status).toBe("failed");
    expect(failed.assistant_message).toBeNull();
  });

  it("does not classify near-match text as the high fixture", async () => {
    const { api } = await import("@/components/nightingale/api-client");
    const result = await api.sendPatient(
      "patient_session_demo",
      "I want to hurt myself tomorrow",
    );
    expect(result.risk_assessment.risk_level).toBe("low");
  });

  it("logout/reset removes the synthetic authenticated session and history", async () => {
    const { api } = await import("@/components/nightingale/api-client");
    const lead = await api.createLead({
      clinic_id: "clinic_demo",
      source_channel: "website_widget",
      source_platform: "website",
    });
    await api.sendGuest(lead.lead_session_id, "private synthetic concern");
    await api.consentAndConvert(lead.lead_session_id);
    expect(api.getMockJourney().authenticated).toBe(true);
    api.endDemoSession();
    expect(api.getMockJourney().authenticated).toBe(false);
    expect(api.getMockJourney().guest_messages).toEqual([]);
  });

  it("stores a successful synthetic handoff in the synthetic clinic queue", async () => {
    const { api } = await import("@/components/nightingale/api-client");
    const result = await api.sendPatient(
      "patient_session_demo",
      "My chest feels funny",
    );
    await api.createEscalation(
      "patient_session_demo",
      result.patient_message.message_id,
      result.risk_assessment.risk_assessment_id,
    );
    const queue = await api.getEscalations();
    expect(queue).toHaveLength(1);
    expect(queue[0].triage_summary[0]).toBe("My chest feels funny");
    expect(queue[0].attribution.source_channel).toBe("website_widget");
  });

  it("keeps the synthetic staff-referral topic available to the guest UI", async () => {
    const { api } = await import("@/components/nightingale/api-client");
    await api.createReferral("asked about egg freezing at today’s visit");
    expect(api.getMockJourney().referral_topic).toBe(
      "asked about egg freezing at today’s visit",
    );
  });
});
