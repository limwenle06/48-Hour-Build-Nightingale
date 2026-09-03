import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));
import Home from "@/app/page";
import { AppShell } from "@/components/nightingale/app-shell";

describe("surgical copy", () => {
  it("uses the approved tired-patient landing copy", () => {
    render(<Home />);
    expect(screen.getByText("The first step")).toBeVisible();
    expect(screen.getByText("Start now.")).toBeVisible();
    expect(
      screen.getByText("We only see what you consent to share."),
    ).toBeVisible();
    expect(
      screen.getByText("Urgent matters interrupt everything else."),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Ask a question" }),
    ).toHaveAttribute(
      "href",
      "/start?source_channel=website_widget&source_platform=website",
    );
  });
  it("uses the approved header promise", () => {
    render(
      <AppShell>
        <div />
      </AppShell>,
    );
    expect(screen.getByText("Your health, our priority")).toBeVisible();
  });
});
