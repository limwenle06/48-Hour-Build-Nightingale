import type { MemoryExtractionCandidate } from "../../contracts";

export function normalizeMemoryValue(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function deduplicateMemoryCandidates(
  candidates: MemoryExtractionCandidate[],
): MemoryExtractionCandidate[] {
  const seen = new Set<string>();
  const unique: MemoryExtractionCandidate[] = [];

  for (const candidate of candidates) {
    const normalizedValue = normalizeMemoryValue(candidate.value);
    const key = `${candidate.type}:${normalizedValue}:${candidate.status}`;

    if (!normalizedValue || seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push({ ...candidate, value: candidate.value.trim() });
  }

  return unique;
}
