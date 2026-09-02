import type { AssistantResponse, RiskDecision } from "../../contracts";

const GENERAL_EMERGENCY_TEXT =
  "Your message may describe an urgent medical situation. Nightingale AI cannot assess this safely. Please contact local emergency services now or go to the nearest emergency department. You may also send this to the clinic, but do not wait for a clinic reply in an emergency.";

const SELF_HARM_EMERGENCY_TEXT =
  "I’m sorry you’re dealing with this. If you may act on these thoughts or are in immediate danger, contact local emergency services now or go to the nearest emergency department. If possible, stay with someone you trust. You can also send this to the clinic, but do not wait for a clinic reply in an emergency.";

export function createRiskSafetyResponse(
  risk: RiskDecision,
): AssistantResponse {
  if (risk.risk_level === "high") {
    const isSelfHarmRisk = risk.matched_rule_ids.includes(
      "high_risk_self_harm_001",
    );

    return {
      content: isSelfHarmRisk
        ? SELF_HARM_EMERGENCY_TEXT
        : GENERAL_EMERGENCY_TEXT,
      response_kind: "safety",
    };
  }

  return {
    content:
      "This question needs judgement from a nurse or clinician, so Nightingale AI should not diagnose it, interpret it, or recommend medication changes. Please use Send to Nurse/Clinic. If symptoms become severe or rapidly worsen, contact local emergency services.",
    response_kind: "safety",
  };
}

export function createRedactionFailureResponse(): AssistantResponse {
  return {
    content:
      "I couldn’t safely prepare this message for AI processing, so no message content was sent to the AI provider. Please try again or use Send to Nurse/Clinic. If this is an emergency, contact local emergency services now.",
    response_kind: "fallback",
  };
}

export function createProviderFailureResponse(): AssistantResponse {
  return {
    content:
      "I’m unable to generate a safe response right now. Please try again or use Send to Nurse/Clinic. If this is an emergency, contact local emergency services now.",
    response_kind: "fallback",
  };
}
