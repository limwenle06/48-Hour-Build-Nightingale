import {
  memoryExtractionBatchSchema,
  redactionResultSchema,
  uuidSchema,
  type MemoryExtractionCandidate,
  type ProfileSnapshotItem,
  type RedactionResult,
} from "../../contracts";
import type { LlmProvider } from "../ai/provider";
import { extractDeterministicMemory } from "./deterministic-extraction";
import {
  deduplicateMemoryCandidates,
  normalizeMemoryValue,
} from "./normalize-memory";

const MEMORY_EXTRACTION_INSTRUCTIONS = `
Extract only healthcare facts explicitly stated by the patient.
Return JSON only in this exact shape:
{"facts":[{"type":"chief_complaint|symptom|symptom_timeline|medication|allergy","value":"text","status":"active|stopped|resolved|historical|unknown","confidence":"low|med|high"}]}

Rules:
- Do not diagnose, infer a disease, or add advice.
- Do not extract names, IDs, phone numbers, or [REDACTED] as facts.
- Use status "stopped" when the patient says a medication was stopped.
- Use status "resolved" when the patient says a symptom ended.
- Return an empty facts array when no supported fact is stated.
`.trim();

export type MemoryExtractionSource = "model" | "deterministic" | "blocked";

export interface MemoryExtractionResult {
  source: MemoryExtractionSource;
  candidates: MemoryExtractionCandidate[];
}

export interface ExtractMemoryInput {
  message_id: string;
  redaction: RedactionResult;
  current_profile: ProfileSnapshotItem[];
}

export interface ExtractMemoryOptions {
  provider?: LlmProvider;
}

function parseProviderJson(text: string): MemoryExtractionCandidate[] | null {
  const withoutFence = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  try {
    const parsed = memoryExtractionBatchSchema.safeParse(JSON.parse(withoutFence));

    if (!parsed.success) {
      return null;
    }

    const safeFacts = parsed.data.facts.filter(
      (fact) => !fact.value.includes("[REDACTED]"),
    );
    return deduplicateMemoryCandidates(safeFacts);
  } catch {
    return null;
  }
}

function mergeCandidates(
  deterministicCandidates: MemoryExtractionCandidate[],
  modelCandidates: MemoryExtractionCandidate[],
): MemoryExtractionCandidate[] {
  const deterministicKeys = new Set(
    deterministicCandidates.map(
      (candidate) =>
        `${candidate.type}:${normalizeMemoryValue(candidate.value)}`,
    ),
  );
  const nonConflictingModelCandidates = modelCandidates.filter(
    (candidate) =>
      !deterministicKeys.has(
        `${candidate.type}:${normalizeMemoryValue(candidate.value)}`,
      ),
  );

  return deduplicateMemoryCandidates([
    ...deterministicCandidates,
    ...nonConflictingModelCandidates,
  ]);
}

export async function extractMemory(
  input: ExtractMemoryInput,
  options: ExtractMemoryOptions = {},
): Promise<MemoryExtractionResult> {
  if (!uuidSchema.safeParse(input.message_id).success) {
    return { source: "blocked", candidates: [] };
  }

  const redaction = redactionResultSchema.safeParse(input.redaction);

  if (!redaction.success || redaction.data.status === "failed") {
    return { source: "blocked", candidates: [] };
  }

  const deterministicCandidates = extractDeterministicMemory(
    redaction.data.redacted_text,
  );

  if (!options.provider) {
    return { source: "deterministic", candidates: deterministicCandidates };
  }

  try {
    const providerResult = await options.provider.generate({
      redacted_input: redaction.data.redacted_text,
      instructions: MEMORY_EXTRACTION_INSTRUCTIONS,
      max_output_tokens: 500,
    });
    const modelCandidates = parseProviderJson(providerResult.text);

    if (modelCandidates === null) {
      return { source: "deterministic", candidates: deterministicCandidates };
    }

    return {
      source: "model",
      candidates: mergeCandidates(deterministicCandidates, modelCandidates),
    };
  } catch {
    return { source: "deterministic", candidates: deterministicCandidates };
  }
}
