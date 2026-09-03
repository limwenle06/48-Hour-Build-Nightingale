import { expect, test } from "@playwright/test";

test("guest_to_patient_conversion and escalation_payload", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  await page.goto(
    "/start?source_channel=website_widget&source_platform=website",
  );
  await expect(page.getByText("What’s bothering you?")).toBeVisible();

  await page.getByRole("button", { name: "I have a private question." }).click();
  await expect(page.getByText("Continue without repeating yourself.")).toBeVisible();
  await page.getByRole("button", { name: "Continue securely" }).click();

  const consentDialog = page.getByRole("dialog");
  await consentDialog.getByRole("checkbox").check();
  await consentDialog.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/patient\?patient_session_id=/);
  await expect(page.getByText("Developer demo tools")).toBeVisible();

  await page.getByText("Developer demo tools").click();
  await page.getByRole("button", { name: "Medium review" }).click();
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByText("A nurse or clinician should review this."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Send to Nurse/Clinic" }).click();
  await expect(page.getByText(/Demo clinic alert recorded/)).toBeVisible();

  await page.goto("/staff/sign-in");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/staff$/);
  await expect(
    page.getByRole("heading", { name: "Today’s care queue" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "My chest feels funny" }),
  ).toBeVisible();
});
