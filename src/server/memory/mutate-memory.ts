import {
  memoryMutationInputSchema,
  memoryMutationProposalSchema,
  type MemoryExtractionCandidate,
  type MemoryMutationInput,
  type MemoryMutationProposal,
  type ProfileSnapshotItem,
} from "../../contracts";
import {
  deduplicateMemoryCandidates,
  normalizeMemoryValue,
} from "./normalize-memory";

function findMatchingCurrentItem(
  candidate: MemoryExtractionCandidate,
  currentProfile: ProfileSnapshotItem[],
): ProfileSnapshotItem | undefined {
  const normalizedCandidate = normalizeMemoryValue(candidate.value);

  return currentProfile.find(
    (item) =>
      item.type === candidate.type &&
      normalizeMemoryValue(item.value) === normalizedCandidate,
  );
}

export function buildMemoryMutations(
  input: MemoryMutationInput,
): MemoryMutationProposal[] {
  const parsedInput = memoryMutationInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return [];
  }

  const mutations: MemoryMutationProposal[] = [];
  const candidates = deduplicateMemoryCandidates(parsedInput.data.candidates);

  for (const candidate of candidates) {
    const normalizedValue = normalizeMemoryValue(candidate.value);
    const currentItem = findMatchingCurrentItem(
      candidate,
      parsedInput.data.current_profile,
    );

    if (currentItem?.status === candidate.status) {
      continue;
    }

    const isUncertainCorrection =
      currentItem !== undefined &&
      currentItem.status !== candidate.status &&
      candidate.confidence === "low";

    const mutation = memoryMutationProposalSchema.safeParse({
      type: candidate.type,
      value: candidate.value,
      normalized_value: normalizedValue,
      status: isUncertainCorrection ? "unknown" : candidate.status,
      provenance_pointer: parsedInput.data.message_id,
      supersedes_memory_item_id: isUncertainCorrection
        ? null
        : (currentItem?.memory_item_id ?? null),
      confidence: candidate.confidence,
    });

    if (mutation.success) {
      mutations.push(mutation.data);
    }
  }

  return mutations;
}
