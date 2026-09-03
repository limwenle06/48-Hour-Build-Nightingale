import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
import { PatientJourney } from "@/components/nightingale/patient-journey";

describe("PatientJourney synthetic safety states", () => {
  async function openPatient() {
    const { api } = await import("@/components/nightingale/api-client");
    const lead = await api.createLead({
      clinic_id: "clinic_demo",
      source_channel: "website_widget",
      source_platform: "website",
    });
    await api.consentAndConvert(lead.lead_session_id);
    render(<PatientJourney />);
  }
  it("keeps the high emergency interruption after the secondary demo clinic action", async () => {
    const user = userEvent.setup();
    await openPatient();
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
    expect(
      screen.queryByRole("button", { name: "Send to Nurse/Clinic too" }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Close emergency warning" }),
    );
    expect(screen.queryByText("EMERGENCY · HIGH RISK")).not.toBeInTheDocument();
    expect(screen.getByText(/Demo clinic alert recorded/)).toBeVisible();
  });

  it("shows medium human review without a 999 emergency action", async () => {
    const user = userEvent.setup();
    await openPatient();
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
    await user.click(
      screen.getByRole("button", { name: "Send to Nurse/Clinic" }),
    );
    expect(
      await screen.findByText(/Expected clinic response: 12-18 hours/),
    ).toBeVisible();
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
    await openPatient();
    expect(
      await screen.findByText("Please keep this exact concern"),
    ).toBeVisible();
  });

  it("shows failed processing fallback and no assistant advice", async () => {
    const user = userEvent.setup();
    await openPatient();
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
    await openPatient();
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
    await openPatient();
    await user.type(
      screen.getByLabelText("Your message"),
      "Demo: handoff unavailable",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(
      await screen.findByRole("button", { name: "Send to Nurse/Clinic" }),
    ).toBeDisabled();
  });

  it("loads the explicit Symptoms profile fixture into Living Profile", async () => {
    const user = userEvent.setup();
    await openPatient();
    await user.click(screen.getByRole("button", { name: "Symptoms profile" }));
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Persistent cough")).toBeVisible();
    expect(screen.getByText("Dry cough")).toBeVisible();
    expect(screen.getByText("Sore throat")).toBeVisible();
    expect(screen.getByText("Started 3 days ago")).toBeVisible();
    expect(screen.getByText("Paracetamol")).toBeVisible();
    expect(screen.getByText("Penicillin")).toBeVisible();
  });

  it("keeps a HIGH warning latched after a later ordinary message", async () => {
    const user = userEvent.setup();
    await openPatient();
    await user.type(
      screen.getByLabelText("Your message"),
      "I want to hurt myself",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("EMERGENCY · HIGH RISK")).toBeVisible();
    await user.type(screen.getByLabelText("Your message"), "hi");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByText("EMERGENCY · HIGH RISK")).toBeVisible();
  });

  it("asks before dismissing HIGH prior to handoff", async () => {
    const user = userEvent.setup();
    await openPatient();
    await user.type(
      screen.getByLabelText("Your message"),
      "I want to hurt myself",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));
    await user.click(
      await screen.findByRole("button", { name: "Close emergency warning" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Close this emergency warning?" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Keep warning" })).toBeVisible();
  });

  it("Keep warning preserves HIGH and Close warning dismisses only its UI", async () => {
    const user = userEvent.setup();
    await openPatient();
    await user.type(
      screen.getByLabelText("Your message"),
      "I want to hurt myself",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));
    await user.click(
      await screen.findByRole("button", { name: "Close emergency warning" }),
    );
    await user.click(screen.getByRole("button", { name: "Keep warning" }));
    expect(screen.getByText("EMERGENCY · HIGH RISK")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Close emergency warning" }),
    );
    await user.click(screen.getByRole("button", { name: "Close warning" }));
    expect(screen.queryByText("EMERGENCY · HIGH RISK")).not.toBeInTheDocument();
    await user.type(
      screen.getByLabelText("Your message"),
      "I want to hurt myself",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("EMERGENCY · HIGH RISK")).toBeVisible();
  });

  it("clears visible authenticated chat when the demo session ends", async () => {
    await openPatient();
    expect(screen.getByLabelText("Your message")).toBeVisible();
    const { api } = await import("@/components/nightingale/api-client");
    api.endDemoSession();
    expect(await screen.findByText("Your chat is closed.")).toBeVisible();
    expect(screen.queryByLabelText("Your message")).not.toBeInTheDocument();
  });
});
