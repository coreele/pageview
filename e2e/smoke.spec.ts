import { test, expect } from "@playwright/test";
import { readSeed } from "./helpers/db.ts";
import { waitConnected, waitTableListed } from "./helpers/app.ts";

test("smoke: title, connected badge, seed table listed", async ({ page }) => {
  const seed = readSeed();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "pg-page-viewer" })).toBeVisible();
  await waitConnected(page);
  await waitTableListed(page, seed.heapName);
});
