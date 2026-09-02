export const NIGHTINGALE_SYSTEM_INSTRUCTIONS = `
You are Nightingale AI, an AI assistant supporting a healthcare clinic.

The message passed to you has already been classified as low risk and redacted. Follow these rules:
- Be calm, empathetic, concise, and transparent that you are an AI when relevant.
- Provide general educational information only.
- Do not diagnose or claim the patient has a condition.
- Do not prescribe treatment or tell the patient to start, stop, or change medication or dosage.
- Do not provide false reassurance or say that something is definitely harmless.
- Do not invent citations, clinic facts, availability, statistics, or clinician actions.
- Do not reconstruct, guess, or ask for information represented by [REDACTED].
- Encourage appropriate clinician review when the answer requires individual medical judgement.
- If the message unexpectedly appears urgent, do not give ordinary advice; tell the patient to seek urgent human help.
- Keep the response under 180 words.
`.trim();

export const TRUST_RESPONSE =
  "I’m Nightingale AI, not a doctor. I help you organize your concerns and provide general information for your clinic. A nurse or clinician becomes involved when your question needs human judgement or safety review.";

const TRUST_QUESTION_PATTERNS = [
  /\bare\s+you\s+(?:a\s+)?(?:real\s+)?doctor\b/i,
  /\bare\s+you\s+(?:an?\s+)?ai\b/i,
  /\bare\s+you\s+(?:a\s+)?(?:bot|human)\b/i,
  /\bis\s+this\s+(?:a\s+)?(?:real\s+)?doctor\b/i,
  /\bwho\s+am\s+i\s+(?:talking|speaking)\s+to\b/i,
];

interface ForbiddenOutputRule {
  rule_id: string;
  pattern: RegExp;
}

const FORBIDDEN_OUTPUT_RULES: readonly ForbiddenOutputRule[] = [
  {
    rule_id: "diagnosis_direct",
    pattern:
      /(?:^|[.!?]\s+)you\s+(?:(?:likely|probably|possibly|may|might)\s+)?have\s+(?:a\s+|an\s+)?[\p{L}]/iu,
  },
  {
    rule_id: "diagnosis_certainty",
    pattern: /\byou\s+(?:definitely|certainly|clearly)\s+have\b/i,
  },
  {
    rule_id: "diagnosis_claim",
    pattern: /\byour\s+diagnosis\s+is\b/i,
  },
  {
    rule_id: "medication_start_stop",
    pattern:
      /\b(?:start|stop)\s+taking\s+(?:(?:your|the)\s+)?[\p{L}]/iu,
  },
  {
    rule_id: "treatment_recommendation",
    pattern: /\bi\s+recommend\s+(?:taking|starting|stopping|using)\b/i,
  },
  {
    rule_id: "medication_dose_change",
    pattern: /\b(?:increase|decrease|double|reduce|change)\s+(?:your\s+)?dose\b/i,
  },
  {
    rule_id: "medication_dose_instruction",
    pattern: /\btake\s+\d+(?:\.\d+)?\s*(?:mg|ml|tablets?|capsules?)\b/i,
  },
  {
    rule_id: "false_reassurance",
    pattern:
      /\b(?:nothing\s+to\s+worry\s+about|definitely\s+fine|certainly\s+harmless|this\s+is\s+not\s+serious|you're\s+fine|you\s+are\s+fine)\b/i,
  },
  {
    rule_id: "discourage_human_care",
    pattern: /\bno\s+need\s+to\s+(?:see|contact|call|visit)\s+(?:a\s+|your\s+)?(?:doctor|nurse|clinic|hospital)\b/i,
  },
  {
    rule_id: "false_doctor_identity",
    pattern: /\bi\s+am\s+(?:a|your)\s+doctor\b/i,
  },
];

export interface ProviderOutputValidation {
  safe: boolean;
  matched_rule_ids: string[];
}

export function isTrustQuestion(text: string): boolean {
  return TRUST_QUESTION_PATTERNS.some((pattern) => pattern.test(text));
}

export function validateProviderOutput(text: string): ProviderOutputValidation {
  const matchedRuleIds = FORBIDDEN_OUTPUT_RULES.filter((rule) =>
    rule.pattern.test(text),
  ).map((rule) => rule.rule_id);

  return {
    safe: matchedRuleIds.length === 0,
    matched_rule_ids: matchedRuleIds,
  };
}
