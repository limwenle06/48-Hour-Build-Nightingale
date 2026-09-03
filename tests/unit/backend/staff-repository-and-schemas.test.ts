import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import {
  createStaffReferral,
  getStaffFunnelMetrics,
  resolveStaffIdentity,
  StaffPersistenceError,
} from "@/server/data/staff-repository";
import { createStaffReferralCredential } from "@/server/staff/referral-token";
import {
  staffAuthRequestSchema,
  staffReferralRequestSchema,
} from "@/server/staff/schemas";

const ids = {
  auth: "11111111-1111-4111-8111-111111111111",
  clinic: "22222222-2222-4222-8222-222222222222",
  user: "33333333-3333-4333-8333-333333333333",
  staff: "44444444-4444-4444-8444-444444444444",
  referral: "55555555-5555-4555-8555-555555555555",
};
const at = "2026-09-03T03:00:00.000Z";

function fakeAdmin(data: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe("staff repository and schemas", () => {
  it("resolves only a runtime-validated clinic role", async () => {
    const staff = {
      staff_user_id: ids.staff,
      user_id: ids.user,
      clinic_id: ids.clinic,
      role: "nurse",
      created_at: at,
    };
    const { client } = fakeAdmin(staff);
    await expect(
      resolveStaffIdentity(client, {
        auth_user_id: ids.auth,
        clinic_id: ids.clinic,
      }),
    ).resolves.toEqual(staff);
  });

  it("passes only a referral hash into persistence", async () => {
    const referral = {
      staff_referral_id: ids.referral,
      clinic_id: ids.clinic,
      created_by_staff_user_id: ids.staff,
      topic: "General follow-up question",
      status: "active",
      expires_at: "2026-09-06T03:00:00.000Z",
      created_at: at,
    };
    const { client, rpc } = fakeAdmin(referral);
    const credential = createStaffReferralCredential();
    expect(credential.raw_token).not.toBe(credential.token_hash);
    expect(credential.token_hash).toMatch(/^[0-9a-f]{64}$/);

    await createStaffReferral(client, {
      auth_user_id: ids.auth,
      clinic_id: ids.clinic,
      topic: referral.topic,
      token_hash: credential.token_hash,
      expires_in_hours: 72,
      request_id: "request-1",
    });
    const parameters = rpc.mock.calls[0]?.[1];
    expect(parameters).toHaveProperty("p_token_hash", credential.token_hash);
    expect(parameters).not.toHaveProperty("p_raw_token");
  });

  it("validates four query-backed metric rows", async () => {
    const metrics = [
      "staff_referral",
      "social_comment",
      "instagram_ad_click",
      "website_widget",
    ].map((source_channel) => ({
      source_channel,
      visitors: 1,
      value_events: 1,
      patient_conversions: 0,
      escalations: 0,
    }));
    const result = {
      metrics,
      window: {
        from: "2026-08-04T03:00:00.000Z",
        to: at,
      },
    };
    const { client } = fakeAdmin(result);
    await expect(
      getStaffFunnelMetrics(client, {
        auth_user_id: ids.auth,
        clinic_id: ids.clinic,
      }),
    ).resolves.toEqual(result);
  });

  it("rejects unknown auth/referral fields and invalid expiry", () => {
    expect(
      staffAuthRequestSchema.safeParse({
        action: "sign_out",
        email: "should-not-be-sent@example.test",
      }).success,
    ).toBe(false);
    expect(
      staffReferralRequestSchema.safeParse({ topic: "Follow up", expires_in_hours: 1000 })
        .success,
    ).toBe(false);
  });

  it("fails closed for malformed privileged database output", async () => {
    const { client } = fakeAdmin({ role: "admin" });
    await expect(
      resolveStaffIdentity(client, {
        auth_user_id: ids.auth,
        clinic_id: ids.clinic,
      }),
    ).rejects.toBeInstanceOf(StaffPersistenceError);
  });
});

