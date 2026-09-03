import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import {
  convertLeadSession,
  ensurePatientIdentity,
  PersistenceError,
  recordPatientConsent,
} from "@/server/data/patient-auth-repository";

const ids = {
  auth: "11111111-1111-4111-8111-111111111111",
  clinic: "22222222-2222-4222-8222-222222222222",
  user: "33333333-3333-4333-8333-333333333333",
  patient: "44444444-4444-4444-8444-444444444444",
  lead: "55555555-5555-4555-8555-555555555555",
  patientSession: "66666666-6666-4666-8666-666666666666",
  consent: "77777777-7777-4777-8777-777777777777",
  message: "88888888-8888-4888-8888-888888888888",
};
const timestamp = "2026-09-03T00:00:00.000Z";
const patient = {
  patient_id: ids.patient,
  user_id: ids.user,
  clinic_id: ids.clinic,
  created_at: timestamp,
  updated_at: timestamp,
};

function fakeAdmin(data: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe("patient auth repository", () => {
  it("passes trusted identity fields to the service-only identity RPC", async () => {
    const { client, rpc } = fakeAdmin({ patient });
    await expect(
      ensurePatientIdentity(client, {
        auth_user_id: ids.auth,
        verified_email: "patient@example.test",
        phone: "+60112223333",
        clinic_id: ids.clinic,
      }),
    ).resolves.toEqual({ patient });

    expect(rpc).toHaveBeenCalledWith("ensure_patient_identity", {
      p_auth_user_id: ids.auth,
      p_verified_email: "patient@example.test",
      p_phone: "+60112223333",
      p_clinic_id: ids.clinic,
    });
  });

  it("returns the canonical consent envelope", async () => {
    const consent = {
      consent_id: ids.consent,
      patient_id: ids.patient,
      clinic_id: ids.clinic,
      consent_type: "health_data_sharing",
      status: "granted",
      policy_version: "0.1.0",
      granted_at: timestamp,
      revoked_at: null,
      created_at: timestamp,
    };
    const { client } = fakeAdmin({ consent });

    await expect(
      recordPatientConsent(client, {
        auth_user_id: ids.auth,
        clinic_id: ids.clinic,
        consent_type: "health_data_sharing",
        status: "granted",
        policy_version: "0.1.0",
        recovery_token_hash: "b".repeat(64),
      }),
    ).resolves.toEqual({ consent });

    expect(client.rpc).toHaveBeenCalledWith(
      "record_patient_consent_with_recovery",
      expect.objectContaining({ p_recovery_token_hash: "b".repeat(64) }),
    );
  });

  it("returns converted source message IDs without changing them", async () => {
    const attribution = {
      clinic_id: ids.clinic,
      source_channel: "website_widget",
      source_platform: "website",
      campaign_id: null,
      creative: null,
      identity_level: "anonymous",
      landing_timestamp: timestamp,
    };
    const result = {
      patient,
      patient_session: {
        patient_session_id: ids.patientSession,
        patient_id: ids.patient,
        clinic_id: ids.clinic,
        source_lead_session_id: ids.lead,
        attribution,
        started_at: timestamp,
        ended_at: null,
        created_at: timestamp,
        updated_at: timestamp,
      },
      source_message_ids: [ids.message],
      attribution,
    };
    const { client, rpc } = fakeAdmin(result);
    const tokenHash = "a".repeat(64);

    await expect(
      convertLeadSession(client, {
        auth_user_id: ids.auth,
        lead_session_id: ids.lead,
        health_consent_id: ids.consent,
        recovery_token_hash: tokenHash,
      }),
    ).resolves.toEqual(result);
    expect(rpc).toHaveBeenCalledWith(
      "convert_lead_session",
      expect.objectContaining({ p_recovery_token_hash: tokenHash }),
    );
  });

  it("fails closed for database errors and malformed RPC output", async () => {
    const databaseFailure = fakeAdmin(null, { code: "42501" });
    await expect(
      ensurePatientIdentity(databaseFailure.client, {
        auth_user_id: ids.auth,
        verified_email: "patient@example.test",
        phone: null,
        clinic_id: ids.clinic,
      }),
    ).rejects.toMatchObject({
      databaseCode: "42501",
    } satisfies Partial<PersistenceError>);

    const invalidOutput = fakeAdmin({ patient_id: "not-an-envelope" });
    await expect(
      ensurePatientIdentity(invalidOutput.client, {
        auth_user_id: ids.auth,
        verified_email: "patient@example.test",
        phone: null,
        clinic_id: ids.clinic,
      }),
    ).rejects.toBeInstanceOf(PersistenceError);
  });
});
