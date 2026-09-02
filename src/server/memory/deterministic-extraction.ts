import {
  memoryExtractionCandidateSchema,
  type MemoryExtractionCandidate,
} from "../../contracts";
import { deduplicateMemoryCandidates } from "./normalize-memory";

const REDACTED_VALUE = /\[REDACTED\]/i;

const COMMON_SYMPTOMS = [
  "abdominal pain",
  "back pain",
  "chest pain",
  "constipation",
  "cough",
  "diarrhea",
  "dizziness",
  "fatigue",
  "fever",
  "headache",
  "joint pain",
  "nausea",
  "numbness",
  "rash",
  "runny nose",
  "shortness of breath",
  "sore throat",
  "stomach pain",
  "swelling",
  "vomiting",
  "weakness",
] as const;

const STOP_WORDS =
  /\s+(?:and|but|because|since|for|after|before|last|yesterday|today|currently)\b.*$/i;

function cleanCapturedValue(
  value: string,
  type: MemoryExtractionCandidate["type"],
): string {
  const valueWithStopsRemoved =
    type === "symptom_timeline" ? value : value.replace(STOP_WORDS, "");

  return valueWithStopsRemoved
    .replace(/[.,;!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function addCandidate(
  candidates: MemoryExtractionCandidate[],
  candidate: MemoryExtractionCandidate,
): void {
  const cleaned = cleanCapturedValue(candidate.value, candidate.type);

  if (!cleaned || REDACTED_VALUE.test(cleaned)) {
    return;
  }

  const parsed = memoryExtractionCandidateSchema.safeParse({
    ...candidate,
    value: cleaned,
  });

  if (parsed.success) {
    candidates.push(parsed.data);
  }
}

function extractFirstMatch(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = pattern.exec(text);

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function isNegatedSymptom(text: string, symptom: string): boolean {
  const escapedSymptom = symptom.replace(/\s+/g, "\\s+");
  const negatedPattern = new RegExp(
    `\\b(?:no|not|without|den(?:y|ies)|do\\s+not\\s+have|don't\\s+have|have\\s+not\\s+had|haven't\\s+had)\\s+(?:(?:a|an|any)\\s+)?${escapedSymptom}\\b`,
    "i",
  );

  return negatedPattern.test(text);
}

export function extractDeterministicMemory(
  redactedText: string,
): MemoryExtractionCandidate[] {
  const candidates: MemoryExtractionCandidate[] = [];
  const text = redactedText.normalize("NFKC").replace(/\s+/g, " ").trim();

  const stoppedMedication = extractFirstMatch(text, [
    /\b(?:i\s+)?(?:actually\s+)?stopped(?:\s+taking)?\s+([\p{L}][\p{L}\p{N}-]*(?:\s+\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml))?)/iu,
    /\bi\s+(?:no\s+longer|do\s+not|don't)\s+take\s+([\p{L}][\p{L}\p{N}-]*)/iu,
    /\bi\s+discontinued\s+([\p{L}][\p{L}\p{N}-]*)/iu,
  ]);

  if (stoppedMedication) {
    addCandidate(candidates, {
      type: "medication",
      value: stoppedMedication,
      status: "stopped",
      confidence: "high",
    });
  }

  const activeMedication = extractFirstMatch(text, [
    /\bi\s+(?:currently\s+)?(?:take|am\s+taking)\s+([\p{L}][\p{L}\p{N}-]*(?:\s+\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml))?)/iu,
    /\bi(?:'m|\s+am)\s+(?:taking|on)\s+([\p{L}][\p{L}\p{N}-]*(?:\s+\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml))?)/iu,
    /\bmy\s+medication\s+is\s+([\p{L}][\p{L}\p{N}-]*(?:\s+\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml))?)/iu,
  ]);

  if (activeMedication && !stoppedMedication) {
    addCandidate(candidates, {
      type: "medication",
      value: activeMedication,
      status: "active",
      confidence: "high",
    });
  }

  const allergy = extractFirstMatch(text, [
    /\bi(?:'m|\s+am)\s+allergic\s+to\s+([^,.;!?]+?)(?=\s+(?:and|but|because|with)\b|[,.;!?]|$)/iu,
    /\b(?:my\s+)?allerg(?:y|ies)\s*(?:is|are|:)?\s*([^,.;!?]+?)(?=\s+(?:and|but|because|with)\b|[,.;!?]|$)/iu,
  ]);

  if (allergy) {
    addCandidate(candidates, {
      type: "allergy",
      value: allergy,
      status: "active",
      confidence: "high",
    });
  }

  const timelineMatches = [
    ...text.matchAll(
      /\b(for\s+(?:about\s+)?\d+\s+(?:hours?|days?|weeks?|months?|years?))\b/giu,
    ),
    ...text.matchAll(
      /\b(since\s+(?:today|yesterday|last\s+(?:night|week|month|year)|\d+\s+(?:hours?|days?|weeks?|months?)\s+ago))\b/giu,
    ),
  ];

  for (const match of timelineMatches) {
    if (match[1]) {
      addCandidate(candidates, {
        type: "symptom_timeline",
        value: match[1],
        status: "active",
        confidence: "high",
      });
    }
  }

  const lowerText = text.toLocaleLowerCase("en");
  const foundSymptoms = COMMON_SYMPTOMS.filter((symptom) => {
    const symptomIsPresent = new RegExp(
      `\\b${symptom.replace(/\s+/g, "\\s+")}\\b`,
      "i",
    ).test(lowerText);

    return symptomIsPresent && !isNegatedSymptom(lowerText, symptom);
  });

  for (const symptom of foundSymptoms) {
    addCandidate(candidates, {
      type: "symptom",
      value: symptom,
      status: "active",
      confidence: "med",
    });
  }

  const explicitChiefComplaint = extractFirstMatch(text, [
    /\b(?:my\s+)?(?:main\s+concern|chief\s+complaint)\s*(?:is|:)?\s*([^,.;!?]+?)(?=[,.;!?]|$)/iu,
    /\bi(?:'m|\s+am)\s+(?:most\s+)?worried\s+about\s+([^,.;!?]+?)(?=[,.;!?]|$)/iu,
  ]);

  if (explicitChiefComplaint) {
    addCandidate(candidates, {
      type: "chief_complaint",
      value: explicitChiefComplaint,
      status: "active",
      confidence: "high",
    });
  } else if (foundSymptoms[0]) {
    addCandidate(candidates, {
      type: "chief_complaint",
      value: foundSymptoms[0],
      status: "active",
      confidence: "med",
    });
  }

  return deduplicateMemoryCandidates(candidates);
}
