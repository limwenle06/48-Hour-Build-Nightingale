import { describe, expect, it } from "vitest";

import { FakeLlmProvider } from "../../../src/server/ai/fake-provider";
import { extractMemory } from "../../../src/server/memory/extract-memory";
import { redactPhi } from "../../../src/server/safety/redaction";

const messageId = "78b3b189-b95a-41ea-bda5-27857f675425";

describe("extractMemory", () => {
  it("extracts required facts deterministically without a provider", async () => {
    const result = await extractMemory({
      message_id: messageId,
      redaction: redactPhi(
        "I take Advil and I have a headache for 3 days.",
      ),
      current_profile: [],
    });

    expect(result.source).toBe("deterministic");
    expect(result.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "medication",
          value: "Advil",
          status: "active",
        }),
        expect.objectContaining({
          type: "symptom",
          value: "headache",
          status: "active",
        }),
        expect.objectContaining({
          type: "symptom_timeline",
          value: "for 3 days",
        }),
        expect.objectContaining({
          type: "chief_complaint",
          value: "headache",
        }),
      ]),
    );
  });

  it("extracts stopped medication and allergy statements", async () => {
    const result = await extractMemory({
      message_id: messageId,
      redaction: redactPhi(
        "I actually stopped taking Advil last week. I am allergic to penicillin.",
      ),
      current_profile: [],
    });

    expect(result.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "medication",
          value: "Advil",
          status: "stopped",
        }),
        expect.objectContaining({
          type: "allergy",
          value: "penicillin",
          status: "active",
        }),
      ]),
    );
  });

  it("does not store an obviously negated symptom as active", async () => {
    const result = await extractMemory({
      message_id: messageId,
      redaction: redactPhi("I do not have a headache."),
      current_profile: [],
    });

    expect(result.candidates).not.toContainEqual(
      expect.objectContaining({ type: "symptom", value: "headache" }),
    );
  });

  it("accepts strict model JSON and sends only redacted text", async () => {
    const provider = new FakeLlmProvider(() =>
      JSON.stringify({
        facts: [
          {
            type: "symptom",
            value: "headache",
            status: "active",
            confidence: "high",
          },
        ],
      }),
    );
    const result = await extractMemory(
      {
        message_id: messageId,
        redaction: redactPhi(
          "My name is Amelia Tan. I have experienced a headache.",
        ),
        current_profile: [],
      },
      { provider },
    );

    expect(result.source).toBe("model");
    expect(result.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "symptom",
          value: "headache",
          status: "active",
        }),
        expect.objectContaining({
          type: "chief_complaint",
          value: "headache",
        }),
      ]),
    );
    expect(provider.calls[0]?.redacted_input).toContain("[REDACTED]");
    expect(provider.calls[0]?.redacted_input).not.toContain("Amelia Tan");
  });

  it("uses deterministic extraction when model JSON is invalid", async () => {
    const provider = new FakeLlmProvider(() => "This is not JSON.");
    const result = await extractMemory(
      {
        message_id: messageId,
        redaction: redactPhi("I take Metformin."),
        current_profile: [],
      },
      { provider },
    );

    expect(result.source).toBe("deterministic");
    expect(result.candidates).toContainEqual(
      expect.objectContaining({
        type: "medication",
        value: "Metformin",
        status: "active",
      }),
    );
  });

  it("keeps a deterministic fact when model output conflicts", async () => {
    const provider = new FakeLlmProvider(() =>
      JSON.stringify({
        facts: [
          {
            type: "medication",
            value: "Advil",
            status: "stopped",
            confidence: "low",
          },
        ],
      }),
    );
    const result = await extractMemory(
      {
        message_id: messageId,
        redaction: redactPhi("I take Advil."),
        current_profile: [],
      },
      { provider },
    );

    expect(result.candidates).toContainEqual(
      expect.objectContaining({
        type: "medication",
        value: "Advil",
        status: "active",
      }),
    );
    expect(result.candidates).not.toContainEqual(
      expect.objectContaining({
        type: "medication",
        value: "Advil",
        status: "stopped",
      }),
    );
  });

  it("uses deterministic extraction when the provider fails", async () => {
    const provider = new FakeLlmProvider(() => {
      throw new Error("Synthetic provider failure");
    });
    const result = await extractMemory(
      {
        message_id: messageId,
        redaction: redactPhi("I have nausea since yesterday."),
        current_profile: [],
      },
      { provider },
    );

    expect(result.source).toBe("deterministic");
    expect(result.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "symptom", value: "nausea" }),
        expect.objectContaining({
          type: "symptom_timeline",
          value: "since yesterday",
        }),
      ]),
    );
  });

  it("blocks extraction and provider use when redaction failed", async () => {
    const provider = new FakeLlmProvider();
    const result = await extractMemory(
      {
        message_id: messageId,
        redaction: redactPhi(null),
        current_profile: [],
      },
      { provider },
    );

    expect(result).toEqual({ source: "blocked", candidates: [] });
    expect(provider.calls).toHaveLength(0);
  });

  it("does not accept a redaction placeholder as a memory value", async () => {
    const provider = new FakeLlmProvider(() =>
      JSON.stringify({
        facts: [
          {
            type: "medication",
            value: "[REDACTED]",
            status: "active",
            confidence: "high",
          },
        ],
      }),
    );
    const result = await extractMemory(
      {
        message_id: messageId,
        redaction: redactPhi("My medication is [REDACTED]."),
        current_profile: [],
      },
      { provider },
    );

    expect(result.source).toBe("model");
    expect(result.candidates).toEqual([]);
  });
});
