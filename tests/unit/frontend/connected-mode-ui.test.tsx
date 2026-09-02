import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("connected mode UI boundaries", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_NIGHTINGALE_MOCK", "false");
    vi.doMock("next/navigation", () => ({
      useSearchParams: () => new URLSearchParams(),
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { patient_id: "patient-1", items: [] },
          request_id: "request-1",
        }),
      }),
    );
  });
  it("hides developer synthetic tools", async () => {
    const { PatientJourney } =
      await import("@/components/nightingale/patient-journey");
    render(<PatientJourney />);
    expect(screen.queryByText("Developer demo tools")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Your message")).toBeVisible();
  });
});
