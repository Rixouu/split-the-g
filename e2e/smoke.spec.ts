import { test, expect } from "@playwright/test";

test.describe("Smoke", () => {
  test("home loads and shows score CTA", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /split the g/i }).first(),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("button", { name: /start analysis|score your pour/i }).first(),
    ).toBeVisible();
  });
});
