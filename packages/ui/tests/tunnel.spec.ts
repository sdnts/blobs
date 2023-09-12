import { test, expect } from "@playwright/test";

test("landing page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Blob City/);

  await expect(page.getByTestId("hero")).toBeVisible();
  await expect(page.getByTestId("new")).toBeVisible();
  await expect(page.getByTestId("join")).toBeVisible();
});

test("can create a tunnel", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("new").click();
  await expect(page).toHaveURL(/new/);

  await expect(page.getByTestId("secret")).toBeVisible();
});

test("waits for peer 2 to join", async ({ page }) => {});

test("can join a tunnel", async ({ page }) => {
  await page.goto("/");

  const { secret } = await fetch("http://localhost:8787/new", {
    method: "PUT",
  }).then((r) => r.json());

  await page.getByTestId("join").click();
  await expect(page).toHaveURL(/join/);
});

test("can transfer a file from peer 1 to 2", async ({ page }) => {});

test("can transfer a file from peer 2 to 1", async ({ page }) => {});
