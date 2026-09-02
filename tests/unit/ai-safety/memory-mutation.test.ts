import { describe, expect, it } from "vitest";

import type {
  MemoryExtractionCandidate,
  ProfileSnapshotItem,
} from "../../../src/contracts";
import { buildMemoryMutations } from "../../../src/server/memory/mutate-memory";

const messageA = "78b3b189-b95a-41ea-bda5-27857f675425";
const messageB = "7599d7da-48b3-45c9-bde5-a9d73570dbd6";
const advilMemoryId = "15ed6fc9-9ca9-409d-b00a-a1f72237bfb4";

const activeAdvilCandidate: MemoryExtractionCandidate = {
  type: "medication",
  value: "Advil",
  status: "active",
  confidence: "high",
};

const currentAdvil: ProfileSnapshotItem = {
  memory_item_id: advilMemoryId,
  type: "medication",
  value: "Advil",
  status: "active",
  provenance_pointer: messageA,
};

describe("buildMemoryMutations", () => {
  it("creates a new active medication with message provenance", () => {
    const mutations = buildMemoryMutations({
      message_id: messageA,
      current_profile: [],
      candidates: [activeAdvilCandidate],
    });

    expect(mutations).toEqual([
      {
        type: "medication",
        value: "Advil",
        normalized_value: "advil",
        status: "active",
        provenance_pointer: messageA,
        supersedes_memory_item_id: null,
        confidence: "high",
      },
    ]);
  });

  it("creates a stopped revision while preserving both provenance pointers", () => {
    const stoppedMutations = buildMemoryMutations({
      message_id: messageB,
      current_profile: [currentAdvil],
      candidates: [
        {
          type: "medication",
          value: "Advil",
          status: "stopped",
          confidence: "high",
        },
      ],
    });

    expect(currentAdvil.provenance_pointer).toBe(messageA);
    expect(stoppedMutations).toEqual([
      expect.objectContaining({
        type: "medication",
        normalized_value: "advil",
        status: "stopped",
        provenance_pointer: messageB,
        supersedes_memory_item_id: advilMemoryId,
      }),
    ]);
  });

  it("does not create a duplicate for the same current fact", () => {
    const mutations = buildMemoryMutations({
      message_id: messageB,
      current_profile: [currentAdvil],
      candidates: [
        { ...activeAdvilCandidate, value: "  ADVIL  ", confidence: "med" },
      ],
    });

    expect(mutations).toEqual([]);
  });

  it("does not supersede an existing fact with a low-confidence correction", () => {
    const mutations = buildMemoryMutations({
      message_id: messageB,
      current_profile: [currentAdvil],
      candidates: [
        {
          type: "medication",
          value: "Advil",
          status: "stopped",
          confidence: "low",
        },
      ],
    });

    expect(mutations).toEqual([
      expect.objectContaining({
        status: "unknown",
        provenance_pointer: messageB,
        supersedes_memory_item_id: null,
      }),
    ]);
  });

  it("removes duplicate extraction candidates", () => {
    const mutations = buildMemoryMutations({
      message_id: messageA,
      current_profile: [],
      candidates: [activeAdvilCandidate, { ...activeAdvilCandidate }],
    });

    expect(mutations).toHaveLength(1);
  });

  it("returns no mutations when record identity is invalid", () => {
    const mutations = buildMemoryMutations({
      message_id: "not-a-uuid",
      current_profile: [],
      candidates: [activeAdvilCandidate],
    });

    expect(mutations).toEqual([]);
  });
});
