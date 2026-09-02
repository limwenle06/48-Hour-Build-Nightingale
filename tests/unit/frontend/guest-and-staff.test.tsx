import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({
  useSearchParams: () =>
    new URLSearchParams(
      "source_channel=website_widget&source_platform=website",
    ),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
}));
import { GuestJourney } from "@/components/nightingale/guest-journey";
import {
  CaseCard,
  FunnelChart,
} from "@/components/nightingale/staff-dashboard";
import { JourneySteps } from "@/components/nightingale/ui";
import { StaffSignIn } from "@/components/nightingale/staff-sign-in";
import type {
  Escalation,
  FunnelMetric,
} from "@/components/nightingale/frontend-types";

describe("guest and clinic product journey", () => {
  it("renders starter suggestions and sends one through the guest flow", async () => {
    const user = userEvent.setup();
    render(<GuestJourney />);
    const suggestion = await screen.findByRole("button", {
      name: "I have a private question.",
    });
    await user.click(suggestion);
    expect(await screen.findByText("I have a private question.")).toBeVisible();
    expect(
      screen.getByText("Continue without repeating yourself."),
    ).toBeVisible();
  });
  it("does not expose prior secure-session history in a fresh guest view", async () => {
    const { api } = await import("@/components/nightingale/api-client");
    const lead = await api.createLead({
      clinic_id: "clinic_demo",
      source_channel: "website_widget",
      source_platform: "website",
    });
    await api.sendGuest(lead.lead_session_id, "old guest concern now secured");
    await api.consentAndConvert(lead.lead_session_id);
    await api.sendPatient("patient_session_demo", "private patient history");
    render(<GuestJourney />);
    expect(await screen.findByText("What’s bothering you?")).toBeVisible();
    expect(
      screen.queryByText("old guest concern now secured"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("private patient history"),
    ).not.toBeInTheDocument();
  });
  it("keeps patient journey free of a Clinic/admin tab", () => {
    render(<JourneySteps active="secure" />);
    expect(screen.queryByText("Clinic")).not.toBeInTheDocument();
    expect(screen.getByText("Ask")).toBeVisible();
  });
  it("provides a separate staff sign-in shell", () => {
    render(<StaffSignIn />);
    expect(
      screen.getByRole("heading", { name: "Sign in to the clinic workspace" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Work email")).toBeVisible();
  });
  it("renders case detail as structured sections, not raw JSON", async () => {
    const user = userEvent.setup();
    render(<CaseCard escalation={escalation} />);
    await user.click(screen.getByText("View case"));
    expect(screen.getByText("Triggering concern")).toBeVisible();
    expect(screen.queryByText(/\{\s*"triage_summary"/)).not.toBeInTheDocument();
  });
  it("renders a supplied-data chart and labels synthetic metrics", () => {
    const metrics: FunnelMetric[] = [
      {
        source_channel: "website_widget",
        visitors: 10,
        value_events: 7,
        patient_conversions: 3,
        escalations: 1,
      },
    ];
    render(<FunnelChart metrics={metrics} synthetic />);
    expect(
      screen.getByLabelText(
        /10 visitors, 7 value events, 3 patient conversions, 1 escalations/,
      ),
    ).toBeVisible();
    expect(screen.getByText("Synthetic metrics")).toBeVisible();
  });
});

const escalation: Escalation = {
  escalation_id: "esc-1",
  clinic_id: "clinic-1",
  patient_id: "patient-1",
  patient_session_id: "session-1",
  trigger_message_id: "message-1",
  risk_assessment_id: "risk-1",
  triage_summary: ["Synthetic chest concern", "Started today"],
  profile_snapshot: [
    {
      memory_item_id: "memory-1",
      type: "symptom",
      value: "Synthetic chest sensation",
      status: "active",
      provenance_pointer: "message-1",
    },
  ],
  provenance: ["message-1"],
  attribution: {
    clinic_id: "clinic-1",
    source_channel: "website_widget",
    source_platform: "website",
    campaign_id: null,
    creative: null,
    identity_level: "verified",
    landing_timestamp: "2026-09-02T00:00:00.000Z",
  },
  risk_context: {
    risk_level: "medium",
    risk_reason: "Synthetic review fixture",
    confidence: "low",
    risk_provenance: "system_fallback",
    escalation_required: true,
  },
  status: "pending",
  created_at: "2026-09-02T00:00:00.000Z",
  updated_at: "2026-09-02T00:00:00.000Z",
  clinician_response: null,
};
