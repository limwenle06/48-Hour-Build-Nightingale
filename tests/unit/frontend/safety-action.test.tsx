import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SafetyAction } from "@/components/nightingale/ui";

describe("SafetyAction", () => {
  it("makes emergency services primary for high risk", () => {
    render(<SafetyAction risk="high" onSend={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Nightingale is not emergency services",
    );
    expect(screen.getByRole("link", { name: "Call 999 now" })).toHaveAttribute(
      "href",
      "tel:999",
    );
    expect(
      screen.getByRole("button", { name: "Send to Nurse/Clinic too" }),
    ).toBeInTheDocument();
  });
  it("offers contracted clinic handoff for medium risk", () => {
    render(<SafetyAction risk="medium" onSend={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Send to Nurse/Clinic" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Call 999" }),
    ).not.toBeInTheDocument();
  });
  it("shows no interruption for low risk", () => {
    const { container } = render(<SafetyAction risk="low" />);
    expect(container).toBeEmptyDOMElement();
  });
  it("renders unavailable and loading handoff states", () => {
    const { rerender } = render(
      <SafetyAction risk="medium" onSend={vi.fn()} available={false} />,
    );
    expect(
      screen.getByRole("button", { name: "Send to Nurse/Clinic" }),
    ).toBeDisabled();
    rerender(<SafetyAction risk="medium" onSend={vi.fn()} loading />);
    expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
  });
});
