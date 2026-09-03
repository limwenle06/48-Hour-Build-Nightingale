import { describe, expect, it, vi, beforeEach } from "vitest";
describe("contracted API boundary", () => {
  beforeEach(() => vi.resetModules());
  it("sends snake_case lead fields to the contracted endpoint in connected mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_NIGHTINGALE_MOCK", "false");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          lead_session_id: "lead-1",
          identity_level: "anonymous",
          opening_strategy: "campaign_context",
          recovery_expires_at: "2026-09-09T00:00:00.000Z",
          recovered_messages: [],
          active_guest_risk_level: null,
        },
        request_id: "request-1",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { api } = await import("@/components/nightingale/api-client");
    await api.createLead({
      clinic_id: "clinic-1",
      source_channel: "instagram_ad_click",
      source_platform: "instagram",
      campaign_id: "ivf_over40",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/lead-sessions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          clinic_id: "clinic-1",
          source_channel: "instagram_ad_click",
          source_platform: "instagram",
          campaign_id: "ivf_over40",
        }),
      }),
    );
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends patient credentials only to the authentication endpoint", async () => {
    vi.stubEnv("NEXT_PUBLIC_NIGHTINGALE_MOCK", "false");
    vi.stubEnv(
      "NEXT_PUBLIC_NIGHTINGALE_CLINIC_ID",
      "11111111-1111-4111-8111-111111111111",
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          authenticated: true,
          verification_required: false,
          patient: {
            patient_id: "22222222-2222-4222-8222-222222222222",
          },
        },
        request_id: "request-2",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { api } = await import("@/components/nightingale/api-client");

    await api.authenticatePatient({
      action: "sign_up",
      clinic_id: api.clinicId,
      email: "patient@example.test",
      password: "Secret123!",
      phone: "+60112223333",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/session",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          action: "sign_up",
          clinic_id: "11111111-1111-4111-8111-111111111111",
          email: "patient@example.test",
          password: "Secret123!",
          phone: "+60112223333",
        }),
      }),
    );
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses the contracted staff session and live metrics endpoints", async () => {
    vi.stubEnv("NEXT_PUBLIC_NIGHTINGALE_MOCK", "false");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { metrics: [] },
        request_id: "request-3",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { api } = await import("@/components/nightingale/api-client");

    await api.authenticateStaff("nurse@example.test", "Secret123!");
    await api.getFunnelMetrics();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/staff/auth/session",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          action: "sign_in",
          email: "nurse@example.test",
          password: "Secret123!",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/staff/funnel-metrics",
      expect.any(Object),
    );
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
});
