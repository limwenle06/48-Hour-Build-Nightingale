import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { requireVerifiedAuthUser } from "@/server/auth/authenticated-user";
import {
  createLeadRecoveryCredential,
  hashRecoveryToken,
} from "@/server/auth/recovery-cookie";
import {
  consentRequestSchema,
  conversionRequestSchema,
  patientAuthRequestSchema,
} from "@/server/auth/schemas";
import {
  ApiRouteError,
  apiFailure,
  parseJsonRequest,
} from "@/server/http/api-response";
import {
  getNightingaleClinicId,
  getSupabaseAdminConfig,
  SupabaseConfigurationError,
} from "@/server/supabase/config";

const clinicId = "11111111-1111-4111-8111-111111111111";

describe("Person 2 authentication helpers", () => {
  it("validates server configuration without returning partial secrets", () => {
    expect(
      getSupabaseAdminConfig({
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-with-enough-characters",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-with-enough-characters",
      }),
    ).toEqual({
      url: "https://project.supabase.co",
      anon_key: "anon-key-with-enough-characters",
      service_role_key: "service-role-with-enough-characters",
    });

    expect(() => getSupabaseAdminConfig({})).toThrow(
      SupabaseConfigurationError,
    );
    expect(() =>
      getNightingaleClinicId({
        NEXT_PUBLIC_NIGHTINGALE_CLINIC_ID: "clinic_demo",
      }),
    ).toThrow(SupabaseConfigurationError);
  });

  it("strictly validates patient auth, consent, and conversion bodies", () => {
    expect(
      patientAuthRequestSchema.safeParse({
        action: "sign_up",
        clinic_id: clinicId,
        email: "patient@example.test",
        password: "Secret123!",
        phone: "+60112223333",
      }).success,
    ).toBe(true);
    expect(
      patientAuthRequestSchema.safeParse({
        action: "sign_up",
        clinic_id: "clinic_demo",
        email: "patient@example.test",
        password: "short",
        extra: true,
      }).success,
    ).toBe(false);
    expect(
      consentRequestSchema.safeParse({
        clinic_id: clinicId,
        consent_type: "health_data_sharing",
        status: "granted",
        policy_version: "0.1.0",
      }).success,
    ).toBe(true);
    expect(
      conversionRequestSchema.safeParse({
        lead_session_id: clinicId,
        health_consent_id: clinicId,
      }).success,
    ).toBe(true);
  });

  it("rejects non-JSON state-changing requests", async () => {
    const request = new Request("https://nightingale.test/api/consents", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        clinic_id: clinicId,
        consent_type: "health_data_sharing",
        status: "granted",
        policy_version: "0.1.0",
      }),
    });

    await expect(
      parseJsonRequest(request, consentRequestSchema),
    ).rejects.toMatchObject({ status: 400, code: "validation_error" });
  });

  it("returns the canonical safe error for missing Supabase configuration", async () => {
    const response = apiFailure(
      new SupabaseConfigurationError(),
      "synthetic-request-id",
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "dependency_unavailable",
        message: "The secure data service is not available.",
      },
      request_id: "synthetic-request-id",
    });
  });

  it("hashes recovery credentials deterministically without retaining the token", () => {
    const rawToken = "a-private-random-token-that-is-long-enough";
    const tokenHash = hashRecoveryToken(rawToken);

    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).toBe(hashRecoveryToken(rawToken));
    expect(tokenHash).not.toContain(rawToken);

    const first = createLeadRecoveryCredential();
    const second = createLeadRecoveryCredential();
    expect(first.raw_token.length).toBeGreaterThanOrEqual(32);
    expect(first.token_hash).toBe(hashRecoveryToken(first.raw_token));
    expect(first.raw_token).not.toBe(second.raw_token);
  });

  it("accepts only a Supabase-verified user with confirmed email", async () => {
    const confirmedClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "22222222-2222-4222-8222-222222222222",
              email: "patient@example.test",
              email_confirmed_at: "2026-09-03T00:00:00.000Z",
            },
          },
          error: null,
        }),
      },
    } as unknown as SupabaseClient;

    await expect(requireVerifiedAuthUser(confirmedClient)).resolves.toMatchObject({
      email: "patient@example.test",
    });

    const unconfirmedClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "22222222-2222-4222-8222-222222222222",
              email: "patient@example.test",
              email_confirmed_at: null,
            },
          },
          error: null,
        }),
      },
    } as unknown as SupabaseClient;

    await expect(requireVerifiedAuthUser(unconfirmedClient)).rejects.toMatchObject({
      status: 403,
      code: "forbidden",
    } satisfies Partial<ApiRouteError>);

    const missingUserClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new Error("Synthetic unavailable session"),
        }),
      },
    } as unknown as SupabaseClient;

    await expect(requireVerifiedAuthUser(missingUserClient)).rejects.toMatchObject({
      status: 401,
      code: "unauthenticated",
    } satisfies Partial<ApiRouteError>);
  });
});
