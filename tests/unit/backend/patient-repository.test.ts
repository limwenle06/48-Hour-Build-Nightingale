import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import {
  beginPatientMessage,
  finalizePatientMessage,
  getPatientProfile,
  PatientPersistenceError,
} from "@/server/data/patient-repository";

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

const patientMessage = {
  message_id: ids.patientMessage,
  clinic_id: ids.clinic,
  session_type: "patient",
  session_id: ids.session,
  sender_type: "patient",
  message_kind: "text",
  content: "I have a mild headache.",
  migrated_from_message_id: null,
  audio_asset_id: null,
  transcript_id: null,
  transcription_status: "not_applicable",
  created_at: at,
};

function fakeAdmin(data: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe("patient repository", () => {
  it("begins a message through the service-only identity boundary", async () => {
    const context = {
      patient_message: patientMessage,
      patient_id: ids.patient,
      clinic_id: ids.clinic,
      current_profile: [],
      recent_messages: [],
    };
    const { client, rpc } = fakeAdmin(context);

    await expect(
      beginPatientMessage(client, {
        auth_user_id: ids.auth,
        clinic_id: ids.clinic,
        patient_session_id: ids.session,
        content: patientMessage.content,
        request_id: "request-1",
      }),
    ).resolves.toEqual(context);
    expect(rpc).toHaveBeenCalledWith("begin_patient_message", {
      p_auth_user_id: ids.auth,
      p_clinic_id: ids.clinic,
      p_patient_session_id: ids.session,
      p_content: patientMessage.content,
      p_request_id: "request-1",
    });
  });

  it("validates and finalizes the structured AI result", async () => {
    const assistantMessage = {
      ...patientMessage,
      message_id: ids.assistantMessage,
      sender_type: "ai",
      content: "General information only.",
    };
    const processingResult = {
      processing_status: "success" as const,
      risk: {
        patient_id: ids.patient,
        patient_session_id: ids.session,
        message_id: ids.patientMessage,
        risk_level: "low" as const,
        risk_reason: "No deterministic risk rule matched.",
        confidence: "high" as const,
        risk_provenance: "deterministic" as const,
        matched_rule_ids: [],
        escalation_required: false,
      },
      assistant_response: {
        content: assistantMessage.content,
        response_kind: "normal" as const,
      },
      memory_mutations: [],
      escalation: null,
      citations: [],
    };
    const reply = {
      patient_message: patientMessage,
      risk_assessment: {
        risk_assessment_id: ids.risk,
        ...processingResult.risk,
        created_at: at,
      },
      assistant_message: assistantMessage,
      profile_changes: [],
      escalation_required: false,
      send_to_clinic_available: false,
      citations: [],
      processing_status: "success",
    };
    const { client, rpc } = fakeAdmin(reply);

    await expect(
      finalizePatientMessage(client, {
        auth_user_id: ids.auth,
        clinic_id: ids.clinic,
        patient_session_id: ids.session,
        message_id: ids.patientMessage,
        result: processingResult,
        request_id: "request-1",
      }),
    ).resolves.toEqual(reply);
    expect(rpc).toHaveBeenCalledWith(
      "finalize_patient_message",
      expect.objectContaining({
        p_message_id: ids.patientMessage,
        p_risk: processingResult.risk,
        p_processing_status: "success",
      }),
    );
  });

  it("returns only the current validated patient profile", async () => {
    const profile = { patient_id: ids.patient, items: [] };
    const { client } = fakeAdmin(profile);
    await expect(
      getPatientProfile(client, {
        auth_user_id: ids.auth,
        clinic_id: ids.clinic,
      }),
    ).resolves.toEqual(profile);
  });

  it("fails closed for database failures and malformed output", async () => {
    const denied = fakeAdmin(null, { code: "42501" });
    await expect(
      getPatientProfile(denied.client, {
        auth_user_id: ids.auth,
        clinic_id: ids.clinic,
      }),
    ).rejects.toMatchObject({ databaseCode: "42501" });

    const malformed = fakeAdmin({ patient_id: "not-a-uuid", items: [] });
    await expect(
      getPatientProfile(malformed.client, {
        auth_user_id: ids.auth,
        clinic_id: ids.clinic,
      }),
    ).rejects.toBeInstanceOf(PatientPersistenceError);
  });
});

