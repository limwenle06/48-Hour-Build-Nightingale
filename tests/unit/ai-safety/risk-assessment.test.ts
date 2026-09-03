import { describe, expect, it } from "vitest";

import { riskDecisionSchema } from "../../../src/contracts";
import {
  assessRisk,
  InvalidRiskContextError,
} from "../../../src/server/safety/risk-assessment";

const baseInput = {
  patient_id: "eb5ab4f7-a92d-437f-9258-1057db2b04dc",
  patient_session_id: "13e31a72-5b23-457b-9824-17b9092e2555",
  message_id: "78b3b189-b95a-41ea-bda5-27857f675425",
};

describe("assessRisk", () => {
  it.each([
    ["chest", "I have severe chest pain and feel sweaty.", "high_risk_chest_001"],
    ["breathing", "I cannot breathe properly.", "high_risk_breathing_001"],
    ["bleeding", "The bleeding is heavy and will not stop.", "high_risk_bleeding_001"],
    ["self-harm", "I want to kill myself.", "high_risk_self_harm_001"],
    ["stroke", "My face is drooping and my speech is slurred.", "high_risk_stroke_001"],
    ["seizure", "They are having a seizure.", "high_risk_consciousness_seizure_001"],
    ["allergy", "My throat is closing after the medicine.", "high_risk_allergic_reaction_001"],
    ["overdose", "I took too many pills.", "high_risk_overdose_poisoning_001"],
    ["choking", "I am choking.", "high_risk_choking_001"],
  ])("classifies %s warning signs as high risk", (_category, text, ruleId) => {
    const result = assessRisk({ ...baseInput, redacted_text: text });

    expect(result.risk_level).toBe("high");
    expect(result.confidence).toBe("high");
    expect(result.escalation_required).toBe(true);
    expect(result.matched_rule_ids).toContain(ruleId);
    expect(riskDecisionSchema.safeParse(result).success).toBe(true);
  });

  it.each([
    ["diagnosis", "Do I have diabetes?", "medium_risk_diagnosis_request_001"],
    ["medication", "Should I stop taking my medication?", "medium_risk_medication_advice_001"],
    ["test result", "What do my blood test results mean?", "medium_risk_test_interpretation_001"],
    ["urgency", "Should I go to the hospital?", "medium_risk_urgency_advice_001"],
    ["worsening", "My symptoms are getting much worse.", "medium_risk_worsening_symptoms_001"],
    ["human request", "I want to speak with a nurse.", "medium_risk_human_review_request_001"],
    ["ambiguity", "Something feels very wrong.", "medium_risk_ambiguous_concern_001"],
    ["unclear chest symptom", "My chest feels funny", "medium_risk_ambiguous_chest_001"],
  ])("classifies %s questions as medium risk", (_category, text, ruleId) => {
    const result = assessRisk({ ...baseInput, redacted_text: text });

    expect(result.risk_level).toBe("medium");
    expect(result.escalation_required).toBe(true);
    expect(result.matched_rule_ids).toContain(ruleId);
    expect(riskDecisionSchema.safeParse(result).success).toBe(true);
  });

  it("returns all matching high-risk rule IDs", () => {
    const result = assessRisk({
      ...baseInput,
      redacted_text: "I have chest pain and I cannot breathe.",
    });

    expect(result.risk_level).toBe("high");
    expect(result.matched_rule_ids).toEqual([
      "high_risk_chest_001",
      "high_risk_breathing_001",
    ]);
  });

  it("matches rules without depending on letter case", () => {
    const result = assessRisk({
      ...baseInput,
      redacted_text: "MY THROAT IS CLOSING.",
    });

    expect(result.risk_level).toBe("high");
    expect(result.matched_rule_ids).toContain(
      "high_risk_allergic_reaction_001",
    );
  });

  it("returns low risk when no deterministic rule matches", () => {
    const result = assessRisk({
      ...baseInput,
      redacted_text: "I would like general information about clinic opening hours.",
    });

    expect(result.risk_level).toBe("low");
    expect(result.confidence).toBe("med");
    expect(result.escalation_required).toBe(false);
    expect(result.matched_rule_ids).toEqual([]);
  });

  it("fails safely when redacted text is empty", () => {
    const result = assessRisk({ ...baseInput, redacted_text: "" });

    expect(result.risk_level).toBe("medium");
    expect(result.confidence).toBe("low");
    expect(result.risk_provenance).toBe("system_fallback");
    expect(result.escalation_required).toBe(true);
  });

  it("rejects invalid record identity instead of fabricating IDs", () => {
    expect(() =>
      assessRisk({
        ...baseInput,
        patient_id: "not-a-uuid",
        redacted_text: "I have chest pain.",
      }),
    ).toThrow(InvalidRiskContextError);
  });
});
