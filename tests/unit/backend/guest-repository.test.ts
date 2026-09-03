import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import {
  appendGuestExchange,
  createLeadSession,
  GuestPersistenceError,
  recordGuestFunnelEvent,
  recoverLeadSession,
} from "@/server/data/guest-repository";

const ids = {
  clinic: "11111111-1111-4111-8111-111111111111",
  lead: "22222222-2222-4222-8222-222222222222",
  guestMessage: "33333333-3333-4333-8333-333333333333",
  assistantMessage: "44444444-4444-4444-8444-444444444444",
  funnel: "55555555-5555-4555-8555-555555555555",
};
const at = "2026-09-03T02:00:00.000Z";
const tokenHash = "a".repeat(64);

const guestMessage = {
  message_id: ids.guestMessage,
  clinic_id: ids.clinic,
  session_type: "lead",
  session_id: ids.lead,
  sender_type: "guest",
  message_kind: "text",
  content: "I have a question.",
  migrated_from_message_id: null,
  audio_asset_id: null,
  transcript_id: null,
  transcription_status: "not_applicable",
  created_at: at,
};
const assistantMessage = {
  ...guestMessage,
  message_id: ids.assistantMessage,
  sender_type: "ai",
  content: "General non-diagnostic guidance.",
};
const funnelEvent = {
  funnel_event_id: ids.funnel,
  clinic_id: ids.clinic,
  event_name: "value_event",
  lead_session_id: ids.lead,
  patient_id: null,
  patient_session_id: null,
  source_channel: "website_widget",
  campaign_id: null,
  metadata: { value_type: "questions_for_clinician" },
  occurred_at: at,
};
const leadState = {
  lead_session_id: ids.lead,
  source_channel: "website_widget",
  source_platform: "website",
  identity_level: "anonymous",
  recovery_expires_at: "2026-09-10T02:00:00.000Z",
  clinic_timezone: "Asia/Kuala_Lumpur",
  recovered_messages: [guestMessage, assistantMessage],
};

function fakeAdmin(data: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe("guest repository", () => {
  it("recovers a lead only through its clinic and hashed credential", async () => {
    const { client, rpc } = fakeAdmin(leadState);
    await expect(
      recoverLeadSession(client, {
        clinic_id: ids.clinic,
        recovery_token_hash: tokenHash,
      }),
    ).resolves.toEqual(leadState);
    expect(rpc).toHaveBeenCalledWith("recover_lead_session", {
      p_clinic_id: ids.clinic,
      p_recovery_token_hash: tokenHash,
    });
  });

  it("allows a missing expired recovery result without fabricating a lead", async () => {
    const { client } = fakeAdmin(null);
    await expect(
      recoverLeadSession(client, {
        clinic_id: ids.clinic,
        recovery_token_hash: tokenHash,
      }),
    ).resolves.toBeNull();
  });

  it("creates an attributed lead without passing raw credentials", async () => {
    const { client, rpc } = fakeAdmin({ ...leadState, recovered_messages: [] });
    await createLeadSession(client, {
      clinic_id: ids.clinic,
      source_channel: "website_widget",
      source_platform: "website",
      recovery_token_hash: tokenHash,
      referral_token_hash: null,
    });

    const parameters = rpc.mock.calls[0]?.[1];
    expect(rpc).toHaveBeenCalledWith(
      "create_lead_session",
      expect.objectContaining({
        p_recovery_token_hash: tokenHash,
        p_referral_token_hash: null,
      }),
    );
    expect(parameters).not.toHaveProperty("p_recovery_token");
    expect(parameters).not.toHaveProperty("p_referral_token");
  });

  it("returns runtime-validated guest messages and value event", async () => {
    const result = {
      guest_message: guestMessage,
      assistant_message: assistantMessage,
      value_event: funnelEvent,
    };
    const { client } = fakeAdmin(result);
    await expect(
      appendGuestExchange(client, {
        lead_session_id: ids.lead,
        recovery_token_hash: tokenHash,
        guest_content: guestMessage.content,
        assistant_content: assistantMessage.content,
        value_type: "questions_for_clinician",
      }),
    ).resolves.toEqual(result);
  });

  it("records only the caller's recovered funnel event", async () => {
    const { client, rpc } = fakeAdmin(funnelEvent);
    await expect(
      recordGuestFunnelEvent(client, {
        lead_session_id: ids.lead,
        recovery_token_hash: tokenHash,
        event_name: "value_event",
        metadata: { value_type: "questions_for_clinician" },
      }),
    ).resolves.toEqual(funnelEvent);
    expect(rpc).toHaveBeenCalledWith(
      "record_guest_funnel_event",
      expect.objectContaining({ p_recovery_token_hash: tokenHash }),
    );
  });

  it("fails closed for database errors and malformed RPC output", async () => {
    const denied = fakeAdmin(null, { code: "42501" });
    await expect(
      recoverLeadSession(denied.client, {
        clinic_id: ids.clinic,
        recovery_token_hash: tokenHash,
      }),
    ).rejects.toMatchObject({ databaseCode: "42501" });

    const malformed = fakeAdmin({ lead_session_id: "not-a-uuid" });
    await expect(
      recoverLeadSession(malformed.client, {
        clinic_id: ids.clinic,
        recovery_token_hash: tokenHash,
      }),
    ).rejects.toBeInstanceOf(GuestPersistenceError);
  });
});
