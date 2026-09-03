import type { RiskLevel } from "@/contracts";
import { isTrustQuestion, TRUST_RESPONSE } from "@/server/ai/nightingale-policy";
import {
  HIGH_RISK_RULES,
  MEDIUM_RISK_RULES,
  type DeterministicRiskRule,
} from "@/server/safety/risk-rules";

function matchesAnyRule(
  content: string,
  rules: readonly DeterministicRiskRule[],
) {
  return rules.some((rule) =>
    rule.patterns.some((pattern) => pattern.test(content)),
  );
}

export interface SafeGuestResponse {
  content: string;
  risk_level: RiskLevel;
  value_type: string | null;
}

/** Deterministic guest guidance only. This function never calls an LLM. */
export function createSafeGuestResponse(content: string): SafeGuestResponse {
  const normalized = content.normalize("NFKC").replace(/\s+/g, " ").trim();

  if (matchesAnyRule(normalized, HIGH_RISK_RULES)) {
    return {
      content:
        "Your message may describe an emergency. Call 999 now or go to the nearest emergency department. Nightingale AI is not emergency services, and you should not wait for the clinic or sign up before seeking urgent help.",
      risk_level: "high",
      value_type: "safety_guidance",
    };
  }

  if (matchesAnyRule(normalized, MEDIUM_RISK_RULES)) {
    return {
      content:
        "This needs judgement from a nurse or clinician, so Nightingale AI will not diagnose it or recommend treatment. You can continue securely to share this conversation with the clinic. If symptoms become severe or rapidly worsen, call 999.",
      risk_level: "medium",
      value_type: "human_review_guidance",
    };
  }

  if (isTrustQuestion(normalized)) {
    return {
      content: TRUST_RESPONSE,
      risk_level: "low",
      value_type: null,
    };
  }

  return {
    content:
      "To help put this into words for a clinician, note when it started, whether it is changing, and what makes it better or worse. Share only what you are comfortable sharing. Nightingale AI provides general guidance, not a diagnosis.",
    risk_level: "low",
    value_type: "questions_for_clinician",
  };
}
