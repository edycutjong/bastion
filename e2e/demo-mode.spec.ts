import { test, expect } from "@playwright/test";

test.describe("Demo Mode Smoke Test", () => {
  test("App loads correctly without API keys", async ({ page }) => {
    await page.goto("/");

    // Verify metadata
    await expect(page).toHaveTitle(/Bastion/);

    // Verify main app structure loads (no fatal crashes)
    await expect(page.locator("body")).toBeVisible();
    
    // Check for absence of Next.js error overlays
    await expect(page.locator("nextjs-portal")).not.toBeVisible();
  });
});
