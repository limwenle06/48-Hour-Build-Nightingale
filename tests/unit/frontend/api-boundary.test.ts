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
});
