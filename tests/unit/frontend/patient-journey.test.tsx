import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
import { PatientJourney } from "@/components/nightingale/patient-journey";

describe("PatientJourney synthetic safety states", () => {
  it("keeps the high emergency interruption after the secondary demo clinic action", async () => {
    const user = userEvent.setup();
    render(<PatientJourney />);
    await user.type(
      screen.getByLabelText("Your message"),
      "I want to hurt myself",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("EMERGENCY · HIGH RISK")).toBeVisible();
    expect(screen.queryByText(/Thanks —/)).not.toBeInTheDocument();
    const call = screen.getByRole("link", { name: "Call 999 now" });
    expect(call.className).toContain("text-lg");
    await user.click(
      screen.getByRole("button", { name: "Send to Nurse/Clinic too" }),
    );
    expect(await screen.findByText(/Demo clinic alert recorded/)).toBeVisible();
    expect(screen.getByText("EMERGENCY · HIGH RISK")).toBeVisible();
  });

  it("shows medium human review without a 999 emergency action", async () => {
    const user = userEvent.setup();
    render(<PatientJourney />);
    await user.type(
      screen.getByLabelText("Your message"),
      "My chest feels funny",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(
      await screen.findByText("NEEDS HUMAN REVIEW · MEDIUM"),
    ).toBeVisible();
    expect(
      screen.queryByRole("link", { name: /Call 999/ }),
    ).not.toBeInTheDocument();
  });

  it("restores a converted guest message on remount", async () => {
    const { api } = await import("@/components/nightingale/api-client");
    const lead = await api.createLead({
      clinic_id: "clinic_demo",
      source_channel: "staff_referral",
      source_platform: "clinic",
    });
    await api.sendGuest(lead.lead_session_id, "Please keep this exact concern");
    await api.consentAndConvert(lead.lead_session_id);
    const first = render(<PatientJourney />);
    expect(
      await screen.findByText("Please keep this exact concern"),
    ).toBeVisible();
    first.unmount();
    render(<PatientJourney />);
    expect(
      await screen.findByText("Please keep this exact concern"),
    ).toBeVisible();
  });

  it("shows failed processing fallback and no assistant advice", async () => {
    const user = userEvent.setup();
    render(<PatientJourney />);
    await user.type(
      screen.getByLabelText("Your message"),
      "Demo: processing failure",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(
      await screen.findByText("I couldn’t safely process that."),
    ).toBeVisible();
    await waitFor(() =>
      expect(screen.getByText("NEEDS HUMAN REVIEW · MEDIUM")).toBeVisible(),
    );
  });

  it("shows a truthful synthetic handoff failure while keeping review visible", async () => {
    const user = userEvent.setup();
    render(<PatientJourney />);
    await user.type(
      screen.getByLabelText("Your message"),
      "Demo: handoff failure",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));
    await user.click(
      await screen.findByRole("button", { name: "Send to Nurse/Clinic" }),
    );
    expect(
      await screen.findByText("Not sent yet. You can try again."),
    ).toBeVisible();
    expect(screen.getByText("NEEDS HUMAN REVIEW · MEDIUM")).toBeVisible();
  });

  it("disables a fixture-declared unavailable handoff", async () => {
    const user = userEvent.setup();
    render(<PatientJourney />);
    await user.type(
      screen.getByLabelText("Your message"),
      "Demo: handoff unavailable",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(
      await screen.findByRole("button", { name: "Send to Nurse/Clinic" }),
    ).toBeDisabled();
  });
});
