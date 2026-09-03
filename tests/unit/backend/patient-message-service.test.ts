import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import type { LlmProvider } from "@/server/ai/provider";
import { handlePatientMessage } from "@/server/services/patient-message-service";

const ids = {
  auth: "11111111-1111-4111-8111-111111111111",
  clinic: "22222222-2222-4222-8222-222222222222",
  patient: "33333333-3333-4333-8333-333333333333",
  session: "44444444-4444-4444-8444-444444444444",
  patientMessage: "55555555-5555-4555-8555-555555555555",
  assistantMessage: "66666666-6666-4666-8666-666666666666",
  risk: "77777777-7777-4777-8777-777777777777",
};
const at = "2026-09-03T03:00:00.000Z";
const baseMessage = {
  clinic_id: ids.clinic,
  session_type: "patient",
  session_id: ids.session,
  message_kind: "text",
  migrated_from_message_id: null,
  audio_asset_id: null,
  transcript_id: null,
  transcription_status: "not_applicable",
  created_at: at,
};

describe("patient message service", () => {
  it("turns provider failure into a persisted conservative human-review path", async () => {
    const provider: LlmProvider = {
      async generate() {
        throw new Error("provider unavailable");
      },
    };
    const rpc = vi.fn(async (operation: string, parameters: Record<string, unknown>) => {
      if (operation === "begin_patient_message") {
        return {
          data: {
            patient_message: {
              ...baseMessage,
              message_id: ids.patientMessage,
              sender_type: "patient",
              content: "I have a mild headache.",
            },
            patient_id: ids.patient,
            clinic_id: ids.clinic,
            current_profile: [],
            recent_messages: [],
          },
          error: null,
        };
      }

      const risk = parameters.p_risk as Record<string, unknown>;
      return {
        data: {
          patient_message: {
            ...baseMessage,
            message_id: ids.patientMessage,
            sender_type: "patient",
            content: "I have a mild headache.",
          },
          risk_assessment: {
            risk_assessment_id: ids.risk,
            ...risk,
            created_at: at,
          },
          assistant_message: {
            ...baseMessage,
            message_id: ids.assistantMessage,
            sender_type: "ai",
            content: "I’m unable to generate a safe response right now.",
          },
          profile_changes: [],
          escalation_required: true,
          send_to_clinic_available: true,
          citations: [],
          processing_status: "failed",
        },
        error: null,
      };
    });

    const result = await handlePatientMessage(
      { rpc } as unknown as SupabaseClient,
      {
        auth_user_id: ids.auth,
        clinic_id: ids.clinic,
        patient_session_id: ids.session,
        content: "I have a mild headache.",
        request_id: "request-1",
        provider,
      },
    );

    expect(result.processing_status).toBe("failed");
    expect(result.risk_assessment).toMatchObject({
      risk_level: "medium",
      confidence: "low",
      risk_provenance: "system_fallback",
      escalation_required: true,
    });
    expect(result.send_to_clinic_available).toBe(true);
  });
});

