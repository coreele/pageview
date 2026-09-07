import { test, expect } from "@playwright/test";
import { expectSearch, waitConnected } from "./helpers/app.ts";

test("M7: bare URL stays default view, connected, no auto-load", async ({ page }) => {
  await page.goto("/");
  await waitConnected(page);
  await expectSearch(page, "");
  await expect(page.getByText("Select a heap table to begin.")).toBeVisible();
  await expect(page.getByLabel("Page statistics")).toHaveCount(0);
});
