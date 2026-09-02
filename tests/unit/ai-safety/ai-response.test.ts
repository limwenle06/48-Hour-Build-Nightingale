import { describe, expect, it } from "vitest";

import type { RiskDecision } from "../../../src/contracts";
import { FakeLlmProvider } from "../../../src/server/ai/fake-provider";
import { generateSafeAssistantResponse } from "../../../src/server/ai/generate-safe-response";
import { NIGHTINGALE_SYSTEM_INSTRUCTIONS } from "../../../src/server/ai/nightingale-policy";
import { redactPhi } from "../../../src/server/safety/redaction";

const lowRisk: RiskDecision = {
  patient_id: "eb5ab4f7-a92d-437f-9258-1057db2b04dc",
  patient_session_id: "13e31a72-5b23-457b-9824-17b9092e2555",
  message_id: "78b3b189-b95a-41ea-bda5-27857f675425",
  risk_level: "low",
  risk_reason: "No deterministic high- or medium-risk rule matched.",
  confidence: "med",
  risk_provenance: "deterministic",
  matched_rule_ids: [],
  escalation_required: false,
};

describe("generateSafeAssistantResponse", () => {
  it("uses a provider only for successfully redacted low-risk text", async () => {
    const provider = new FakeLlmProvider(
      () => "General information can help you prepare questions for your clinic.",
    );
    const redaction = redactPhi(
      "My name is Amelia Tan. I have a mild headache today.",
    );

    const response = await generateSafeAssistantResponse(
      { redaction, risk: lowRisk },
      { provider },
    );

    expect(response.response_kind).toBe("normal");
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0]?.redacted_input).toContain("[REDACTED]");
    expect(provider.calls[0]?.redacted_input).not.toContain("Amelia Tan");
    expect(provider.calls[0]?.instructions).toBe(
      NIGHTINGALE_SYSTEM_INSTRUCTIONS,
    );
  });

  it("does not call the provider when redaction failed", async () => {
    const provider = new FakeLlmProvider();
    const redaction = redactPhi(null);

    const response = await generateSafeAssistantResponse(
      { redaction, risk: lowRisk },
      { provider },
    );

    expect(response.response_kind).toBe("fallback");
    expect(response.content).toContain("no message content was sent");
    expect(provider.calls).toHaveLength(0);
  });

  it("blocks the provider and returns emergency guidance for high risk", async () => {
    const provider = new FakeLlmProvider();
    const redaction = redactPhi("I have chest pain and cannot breathe.");
    const highRisk: RiskDecision = {
      ...lowRisk,
      risk_level: "high",
      confidence: "high",
      risk_reason: "Serious chest and breathing symptoms were reported.",
      matched_rule_ids: [
        "high_risk_chest_001",
        "high_risk_breathing_001",
      ],
      escalation_required: true,
    };

    const response = await generateSafeAssistantResponse(
      { redaction, risk: highRisk },
      { provider },
    );

    expect(response.response_kind).toBe("safety");
    expect(response.content).toContain("emergency services");
    expect(provider.calls).toHaveLength(0);
  });

  it("blocks the provider and requests clinician review for medium risk", async () => {
    const provider = new FakeLlmProvider();
    const redaction = redactPhi("Should I stop my medication?");
    const mediumRisk: RiskDecision = {
      ...lowRisk,
      risk_level: "medium",
      risk_reason: "Medication advice requires a clinician.",
      matched_rule_ids: ["medium_risk_medication_advice_001"],
      escalation_required: true,
    };

    const response = await generateSafeAssistantResponse(
      { redaction, risk: mediumRisk },
      { provider },
    );

    expect(response.response_kind).toBe("safety");
    expect(response.content).toContain("Send to Nurse/Clinic");
    expect(provider.calls).toHaveLength(0);
  });

  it("uses a dedicated self-harm safety response", async () => {
    const provider = new FakeLlmProvider();
    const redaction = redactPhi("I want to harm myself.");
    const highRisk: RiskDecision = {
      ...lowRisk,
      risk_level: "high",
      confidence: "high",
      risk_reason: "Self-harm intent was reported.",
      matched_rule_ids: ["high_risk_self_harm_001"],
      escalation_required: true,
    };

    const response = await generateSafeAssistantResponse(
      { redaction, risk: highRisk },
      { provider },
    );

    expect(response.response_kind).toBe("safety");
    expect(response.content).toContain("stay with someone you trust");
    expect(provider.calls).toHaveLength(0);
  });

  it("returns the precise trust disclosure without provider use", async () => {
    const provider = new FakeLlmProvider();
    const redaction = redactPhi("Are you a real doctor?");

    const response = await generateSafeAssistantResponse(
      { redaction, risk: lowRisk },
      { provider },
    );

    expect(response.content).toContain("Nightingale AI");
    expect(response.content).toContain("not a doctor");
    expect(response.content).toContain("your clinic");
    expect(response.content).toContain("nurse or clinician");
    expect(provider.calls).toHaveLength(0);
  });

  it("returns a fallback when the provider throws", async () => {
    const provider = new FakeLlmProvider(() => {
      throw new Error("Synthetic provider failure");
    });

    const response = await generateSafeAssistantResponse(
      { redaction: redactPhi("Tell me about headaches."), risk: lowRisk },
      { provider },
    );

    expect(response.response_kind).toBe("fallback");
  });

  it("returns a fallback when the provider times out", async () => {
    const provider = new FakeLlmProvider(
      () => new Promise<string>(() => undefined),
    );

    const response = await generateSafeAssistantResponse(
      { redaction: redactPhi("Tell me about headaches."), risk: lowRisk },
      { provider, timeout_ms: 5 },
    );

    expect(response.response_kind).toBe("fallback");
  });

  it("returns a fallback for an empty provider response", async () => {
    const provider = new FakeLlmProvider(() => "   ");

    const response = await generateSafeAssistantResponse(
      { redaction: redactPhi("Tell me about headaches."), risk: lowRisk },
      { provider },
    );

    expect(response.response_kind).toBe("fallback");
  });

  it.each([
    "You have migraine.",
    "You definitely have migraine.",
    "Stop taking Advil today.",
    "I recommend taking ibuprofen.",
    "There is nothing to worry about.",
    "This is not serious.",
    "I am your doctor.",
  ])("rejects unsafe provider output: %s", async (unsafeOutput) => {
    const provider = new FakeLlmProvider(() => unsafeOutput);

    const response = await generateSafeAssistantResponse(
      { redaction: redactPhi("Tell me about headaches."), risk: lowRisk },
      { provider },
    );

    expect(response.response_kind).toBe("fallback");
  });
});
