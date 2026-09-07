import { test, expect } from "@playwright/test";
import { envCredentials, readSeed } from "./helpers/db.ts";
import { hrefFor, waitConnected, waitDisconnected, waitPageBlk } from "./helpers/app.ts";
import { startM3Stack } from "./helpers/m3-stack.ts";

test.describe("M3 sanitized stack", () => {
  test.describe.configure({ timeout: 60_000 });

  test("unconnected restore → Connect → auto load", async ({ browser }) => {
    const seed = readSeed();
    const creds = envCredentials();
    const stack = await startM3Stack();
    const page = await browser.newPage({ baseURL: stack.baseURL });
    try {
      await page.goto(
        hrefFor(stack.baseURL, {
          mode: "page",
          kind: "table",
          table: seed.heapOid,
          blkno: 5,
        }),
      );
      await waitDisconnected(page);
      await expect(page.getByRole("heading", { name: "Connect" })).toBeVisible();
      await expect(page).toHaveURL(/table=/);

      await page.getByLabel("Host").fill(creds.host);
      await page.getByLabel("Port").fill(String(creds.port));
      await page.getByLabel("Database").fill(creds.database);
      await page.getByLabel("User").fill(creds.user);
      await page.getByLabel("Password").fill(creds.password);
      await page.getByRole("button", { name: "Connect", exact: true }).click();

      await waitConnected(page);
      await waitPageBlk(page, 5);
    } finally {
      await page.close();
      await stack.stop();
    }
  });
});
