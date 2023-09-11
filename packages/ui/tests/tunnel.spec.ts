import { test, expect } from "@playwright/test";

test("landing page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Blob City/);

  await expect(page.getByTestId("hero")).toBeVisible();
  await expect(page.getByTestId("new")).toBeVisible();
  await expect(page.getByTestId("join")).toBeVisible();
});
