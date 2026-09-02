import { describe, expect, it } from "vitest";

import {
  patientMessageProcessingOutputSchema,
  type PatientMessageProcessingInput,
} from "../../src/contracts";
import { FakeLlmProvider } from "../../src/server/ai/fake-provider";
import {
  InvalidPatientMessageProcessingInputError,
  processPatientMessage,
} from "../../src/server/ai/process-patient-message";

const IDs = {
  clinic: "8113c052-f3f2-478b-aaf5-cc396a63fa36",
  patient: "eb5ab4f7-a92d-437f-9258-1057db2b04dc",
  session: "13e31a72-5b23-457b-9824-17b9092e2555",
  message: "78b3b189-b95a-41ea-bda5-27857f675425",
  memory: "b0a6bc7e-a676-4d22-b616-ec125fdc061d",
  memoryMessage: "a6c80dd0-cac1-42cf-9570-f6c91a9de4e5",
} as const;

function buildInput(
  rawContent: string,
  overrides: Partial<PatientMessageProcessingInput> = {},
): PatientMessageProcessingInput {
  return {
    clinic_id: IDs.clinic,
    patient_id: IDs.patient,
    patient_session_id: IDs.session,
    message_id: IDs.message,
    raw_content: rawContent,
    current_profile: [],
    recent_messages: [],
    ...overrides,
  };
}

describe("Person 3 patient-message pipeline", () => {
  it("processes a low-risk message without exposing raw PHI", async () => {
    const provider = new FakeLlmProvider(
      () =>
        "I can share general information about headaches and help you prepare questions for your clinic.",
    );
    const result = await processPatientMessage(
      buildInput(
        "My name is Amelia Tan. My IC is 900101-14-5678. I take Advil and have a headache.",
      ),
      { provider },
    );

    expect(patientMessageProcessingOutputSchema.safeParse(result).success).toBe(
      true,
    );
    expect(result.processing_status).toBe("success");
    expect(result.risk.risk_level).toBe("low");
    expect(result.assistant_response?.response_kind).toBe("normal");
    expect(result.escalation).toBeNull();
    expect(result.memory_mutations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "medication",
          normalized_value: "advil",
          provenance_pointer: IDs.message,
        }),
        expect.objectContaining({
          type: "symptom",
          normalized_value: "headache",
          provenance_pointer: IDs.message,
        }),
      ]),
    );
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0]?.redacted_input).toContain("[REDACTED]");
    expect(provider.calls[0]?.redacted_input).not.toContain("Amelia Tan");
    expect(provider.calls[0]?.redacted_input).not.toContain("900101-14-5678");
  });

  it("blocks a normal provider response and creates an escalation for high risk", async () => {
    const provider = new FakeLlmProvider();
    const result = await processPatientMessage(
      buildInput("I have severe chest pain and cannot breathe."),
      { provider },
    );

    expect(result.processing_status).toBe("success");
    expect(result.risk.risk_level).toBe("high");
    expect(result.risk.escalation_required).toBe(true);
    expect(result.assistant_response?.response_kind).toBe("safety");
    expect(result.escalation).not.toBeNull();
    expect(result.escalation?.provenance).toContain(IDs.message);
    expect(provider.calls).toHaveLength(0);
  });

  it("creates correction proposals with current-message provenance", async () => {
    const provider = new FakeLlmProvider(
      () => "A nurse or clinician can help review medication questions.",
    );
    const result = await processPatientMessage(
      buildInput("I actually stopped taking Advil last week.", {
        current_profile: [
          {
            memory_item_id: IDs.memory,
            type: "medication",
            value: "Advil",
            status: "active",
            provenance_pointer: IDs.memoryMessage,
          },
        ],
      }),
      { provider },
    );

    expect(result.memory_mutations).toContainEqual(
      expect.objectContaining({
        type: "medication",
        normalized_value: "advil",
        status: "stopped",
        provenance_pointer: IDs.message,
        supersedes_memory_item_id: IDs.memory,
      }),
    );
  });

  it("returns a safe failed result when the provider fails", async () => {
    const provider = new FakeLlmProvider(() => {
      throw new Error("Synthetic provider outage");
    });
    const result = await processPatientMessage(
      buildInput("I have a headache and take Advil."),
      { provider },
    );

    expect(result.processing_status).toBe("failed");
    expect(result.assistant_response?.response_kind).toBe("fallback");
    expect(result.citations).toEqual([]);
    expect(result.memory_mutations.length).toBeGreaterThan(0);
  });

  it("continues with redacted deterministic Memory when its provider times out", async () => {
    const responseProvider = new FakeLlmProvider(
      () => "I can provide general information for your clinic discussion.",
    );
    const memoryProvider = new FakeLlmProvider(
      () => new Promise<string>(() => undefined),
    );
    const result = await processPatientMessage(
      buildInput("My name is Amelia Tan. I take Metformin."),
      {
        provider: responseProvider,
        memory_provider: memoryProvider,
        memory_timeout_ms: 5,
      },
    );

    expect(result.processing_status).toBe("success");
    expect(result.memory_mutations).toContainEqual(
      expect.objectContaining({
        type: "medication",
        normalized_value: "metformin",
        provenance_pointer: IDs.message,
      }),
    );
    expect(memoryProvider.calls).toHaveLength(1);
    expect(memoryProvider.calls[0]?.redacted_input).toContain("[REDACTED]");
    expect(memoryProvider.calls[0]?.redacted_input).not.toContain("Amelia Tan");
  });

  it("rejects invalid boundary input before any provider call", async () => {
    const provider = new FakeLlmProvider();

    await expect(
      processPatientMessage(
        { ...buildInput("I have a headache."), patient_id: "not-a-uuid" },
        { provider },
      ),
    ).rejects.toBeInstanceOf(InvalidPatientMessageProcessingInputError);
    expect(provider.calls).toHaveLength(0);
  });
});
