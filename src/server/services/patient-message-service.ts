import type { SupabaseClient } from "@supabase/supabase-js";

import {
  patientMessageProcessingOutputSchema,
  type PatientMessageProcessingOutput,
} from "@/contracts";
import { createProviderFailureResponse } from "@/server/ai/fallback-response";
import { processPatientMessage } from "@/server/ai/process-patient-message";
import { createLlmProvider } from "@/server/ai/provider-factory";
import type { LlmProvider } from "@/server/ai/provider";
import {
  beginPatientMessage,
  finalizePatientMessage,
} from "@/server/data/patient-repository";

const unavailableProvider: LlmProvider = {
  async generate() {
    throw new Error("The optional LLM provider is not configured.");
  },
};

function configuredProviderOrSafeFallback(): LlmProvider {
  try {
    return createLlmProvider();
  } catch {
    return unavailableProvider;
  }
}

function conservativeProcessingFailure(input: {
  patient_id: string;
  patient_session_id: string;
  message_id: string;
}): PatientMessageProcessingOutput {
  return patientMessageProcessingOutputSchema.parse({
    processing_status: "failed",
    risk: {
      ...input,
      risk_level: "medium",
      risk_reason: "Message processing did not complete safely.",
      confidence: "low",
      risk_provenance: "system_fallback",
      matched_rule_ids: [],
      escalation_required: true,
    },
    assistant_response: createProviderFailureResponse(),
    memory_mutations: [],
    escalation: {
      required: true,
      triage_summary: ["Message processing did not complete safely."],
      provenance: [input.message_id],
    },
    citations: [],
  });
}

export async function handlePatientMessage(
  admin: SupabaseClient,
  input: {
    auth_user_id: string;
    clinic_id: string;
    patient_session_id: string;
    content: string;
    request_id: string;
    provider?: LlmProvider;
  },
) {
  const context = await beginPatientMessage(admin, input);
  const processingInput = {
    clinic_id: context.clinic_id,
    patient_id: context.patient_id,
    patient_session_id: input.patient_session_id,
    message_id: context.patient_message.message_id,
    raw_content: context.patient_message.content,
    current_profile: context.current_profile,
    recent_messages: context.recent_messages,
  };

  let result: PatientMessageProcessingOutput;
  try {
    const provider = input.provider ?? configuredProviderOrSafeFallback();
    const pipelineResult = await processPatientMessage(processingInput, {
      provider,
      memory_provider: provider === unavailableProvider ? undefined : provider,
    });
    result =
      pipelineResult.processing_status === "success"
        ? pipelineResult
        : conservativeProcessingFailure(processingInput);
  } catch {
    result = conservativeProcessingFailure(processingInput);
  }

  return finalizePatientMessage(admin, {
    auth_user_id: input.auth_user_id,
    clinic_id: input.clinic_id,
    patient_session_id: input.patient_session_id,
    message_id: context.patient_message.message_id,
    result,
    request_id: input.request_id,
  });
}
