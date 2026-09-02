import {
  patientMessageProcessingInputSchema,
  patientMessageProcessingOutputSchema,
  type PatientMessageProcessingOutput,
} from "../../contracts";
import { generateEscalation } from "../escalation/generate-escalation";
import { extractMemory } from "../memory/extract-memory";
import { buildMemoryMutations } from "../memory/mutate-memory";
import { redactPhi } from "../safety/redaction";
import { assessRisk } from "../safety/risk-assessment";
import { generateSafeAssistantResponse } from "./generate-safe-response";
import type { LlmProvider } from "./provider";

export class InvalidPatientMessageProcessingInputError extends Error {
  constructor() {
    super("Patient message processing requires a valid contract-shaped input.");
    this.name = "InvalidPatientMessageProcessingInputError";
  }
}

export interface ProcessPatientMessageOptions {
  provider: LlmProvider;
  memory_provider?: LlmProvider;
  response_timeout_ms?: number;
}

/**
 * Runs the Person 3 safety pipeline after Person 2 has completed access and
 * consent checks. This function returns proposals only and never persists data.
 */
export async function processPatientMessage(
  input: unknown,
  options: ProcessPatientMessageOptions,
): Promise<PatientMessageProcessingOutput> {
  const parsedInput = patientMessageProcessingInputSchema.safeParse(input);

  if (!parsedInput.success) {
    throw new InvalidPatientMessageProcessingInputError();
  }

  const message = parsedInput.data;
  const redaction = redactPhi(message.raw_content);
  const risk = assessRisk({
    patient_id: message.patient_id,
    patient_session_id: message.patient_session_id,
    message_id: message.message_id,
    redacted_text: redaction.redacted_text ?? "",
  });

  const assistantResponse = await generateSafeAssistantResponse(
    { redaction, risk },
    {
      provider: options.provider,
      timeout_ms: options.response_timeout_ms,
    },
  );
  const extraction = await extractMemory(
    {
      message_id: message.message_id,
      redaction,
      current_profile: message.current_profile,
    },
    { provider: options.memory_provider },
  );
  const memoryMutations = buildMemoryMutations({
    message_id: message.message_id,
    current_profile: message.current_profile,
    candidates: extraction.candidates,
  });
  const escalation = generateEscalation({
    risk,
    redaction,
    profile_snapshot: message.current_profile,
  });

  const processingStatus =
    redaction.status === "failed"
      ? "blocked"
      : assistantResponse.response_kind === "fallback"
        ? "failed"
        : "success";

  return patientMessageProcessingOutputSchema.parse({
    processing_status: processingStatus,
    risk,
    assistant_response: assistantResponse,
    memory_mutations: memoryMutations,
    escalation,
    citations: [],
  });
}
