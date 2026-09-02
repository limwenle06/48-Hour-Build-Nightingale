import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ChatThread,
  Citations,
  EmergencyWarning,
  LivingProfile,
  ProcessingFallback,
} from "@/components/nightingale/ui";
import type {
  MemoryItem,
  Message,
} from "@/components/nightingale/frontend-types";

const msg: Message = {
  message_id: "message-1",
  clinic_id: "clinic-1",
  session_type: "patient",
  session_id: "session-1",
  sender_type: "patient",
  message_kind: "text",
  content: "I take Advil.",
  migrated_from_message_id: null,
  audio_asset_id: null,
  transcript_id: null,
  transcription_status: "not_applicable",
  created_at: "2026-09-02T00:00:00.000Z",
};
const memory: MemoryItem = {
  memory_item_id: "memory-2",
  patient_id: "patient-1",
  type: "medication",
  value: "Advil",
  normalized_value: "advil",
  status: "stopped",
  provenance_pointer: "message-2",
  source_session_type: "patient",
  supersedes_memory_item_id: "memory-1",
  confidence: "high",
  created_at: "2026-09-02T00:00:00.000Z",
  updated_at: "2026-09-02T00:01:00.000Z",
};
describe("patient presentation", () => {
  it("renders messages without changing contracted sender data", () => {
    render(<ChatThread messages={[msg]} />);
    expect(screen.getByText("I take Advil.")).toBeInTheDocument();
  });
  it("keeps memory status and provenance visible", () => {
    render(<LivingProfile items={[memory]} />);
    expect(screen.getByText("Advil")).toBeInTheDocument();
    expect(screen.getByText("stopped")).toBeInTheDocument();
    expect(screen.getByText(/Message message-2/)).toBeInTheDocument();
  });
  it("renders an empty Living Profile truthfully", () => {
    render(<LivingProfile items={[]} />);
    expect(screen.getByText("Nothing added yet.")).toBeVisible();
    expect(screen.queryByText(/Stomach discomfort/i)).not.toBeInTheDocument();
  });
  it("shows supersession supplied by the contract", () => {
    render(<LivingProfile items={[memory]} />);
    expect(screen.getByText(/replaces memory-1/)).toBeVisible();
  });
  it("hides citations when none are supplied", () => {
    const { container } = render(<Citations items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("renders a supplied citation without inventing another", () => {
    render(
      <Citations
        items={[
          {
            citation_id: "citation-1",
            message_id: "message-1",
            title: "Synthetic source",
            source_url: "https://example.test/source",
            publisher: "Test publisher",
            retrieved_at: "2026-09-02T00:00:00.000Z",
          },
        ]}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Synthetic source" }),
    ).toHaveAttribute("href", "https://example.test/source");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
  it("presents failed processing calmly without an invented answer", () => {
    render(<ProcessingFallback />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "couldn’t safely process",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "No answer was created",
    );
  });
  it("always renders the required emergency warning", () => {
    render(<EmergencyWarning />);
    expect(screen.getByText(/999 for Emergency Services/)).toBeVisible();
  });
});
