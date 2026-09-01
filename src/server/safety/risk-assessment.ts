import {
  riskAssessmentContextSchema,
  riskAssessmentInputSchema,
  riskDecisionSchema,
  type RiskAssessmentContext,
  type RiskDecision,
} from "../../contracts";
import {
  HIGH_RISK_RULES,
  MEDIUM_RISK_RULES,
  type DeterministicRiskRule,
} from "./risk-rules";

export class InvalidRiskContextError extends Error {
  constructor() {
    super("Risk assessment requires valid patient, session, and message IDs.");
    this.name = "InvalidRiskContextError";
  }
}

function matchesRule(text: string, rule: DeterministicRiskRule): boolean {
  return rule.patterns.some((pattern) => pattern.test(text));
}

function findMatches(
  text: string,
  rules: readonly DeterministicRiskRule[],
): DeterministicRiskRule[] {
  return rules.filter((rule) => matchesRule(text, rule));
}

function buildMatchedReason(matches: DeterministicRiskRule[]): string {
  const [firstMatch] = matches;

  if (!firstMatch) {
    return "No deterministic high- or medium-risk rule matched.";
  }

  if (matches.length === 1) {
    return firstMatch.reason;
  }

  return `${firstMatch.reason} ${matches.length - 1} additional safety rule(s) matched.`;
}

function buildFallbackDecision(
  context: RiskAssessmentContext,
  reason: string,
): RiskDecision {
  return riskDecisionSchema.parse({
    ...context,
    risk_level: "medium",
    risk_reason: reason,
    confidence: "low",
    risk_provenance: "system_fallback",
    matched_rule_ids: [],
    escalation_required: true,
  });
}

/**
 * Runs deterministic safety rules against successfully redacted text.
 * This is a conservative prototype gate, not a diagnosis or clinical protocol.
 */
export function assessRisk(input: unknown): RiskDecision {
  const contextResult = riskAssessmentContextSchema.safeParse(input);

  if (!contextResult.success) {
    throw new InvalidRiskContextError();
  }

  const inputResult = riskAssessmentInputSchema.safeParse(input);

  if (!inputResult.success) {
    return buildFallbackDecision(
      contextResult.data,
      "Risk input was empty or invalid, so human review is required.",
    );
  }

  try {
    const normalizedText = inputResult.data.redacted_text
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim();

    const highRiskMatches = findMatches(normalizedText, HIGH_RISK_RULES);

    if (highRiskMatches.length > 0) {
      return riskDecisionSchema.parse({
        patient_id: inputResult.data.patient_id,
        patient_session_id: inputResult.data.patient_session_id,
        message_id: inputResult.data.message_id,
        risk_level: "high",
        risk_reason: buildMatchedReason(highRiskMatches),
        confidence: "high",
        risk_provenance: "deterministic",
        matched_rule_ids: highRiskMatches.map((rule) => rule.rule_id),
        escalation_required: true,
      });
    }

    const mediumRiskMatches = findMatches(normalizedText, MEDIUM_RISK_RULES);

    if (mediumRiskMatches.length > 0) {
      return riskDecisionSchema.parse({
        patient_id: inputResult.data.patient_id,
        patient_session_id: inputResult.data.patient_session_id,
        message_id: inputResult.data.message_id,
        risk_level: "medium",
        risk_reason: buildMatchedReason(mediumRiskMatches),
        confidence: "med",
        risk_provenance: "deterministic",
        matched_rule_ids: mediumRiskMatches.map((rule) => rule.rule_id),
        escalation_required: true,
      });
    }

    return riskDecisionSchema.parse({
      patient_id: inputResult.data.patient_id,
      patient_session_id: inputResult.data.patient_session_id,
      message_id: inputResult.data.message_id,
      risk_level: "low",
      risk_reason: "No deterministic high- or medium-risk rule matched.",
      confidence: "med",
      risk_provenance: "deterministic",
      matched_rule_ids: [],
      escalation_required: false,
    });
  } catch {
    return buildFallbackDecision(
      contextResult.data,
      "Risk processing failed, so human review is required.",
    );
  }
}
