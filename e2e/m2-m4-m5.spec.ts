import { test, expect } from "@playwright/test";
import { readSeed } from "./helpers/db.ts";
import { alertPanel, hrefFor, waitConnected, waitPageBlk, waitWalLoaded } from "./helpers/app.ts";

const NEXT =
  "Fix or remove the URL parameters in the address bar, then reload. The app stays usable on the default view.";

test("M2: connected restore, F5, WAL prefill not overwritten", async ({ page, baseURL }) => {
  const seed = readSeed();
  await page.goto(
    hrefFor(baseURL!, { mode: "page", kind: "table", table: seed.heapOid, blkno: 5 }),
  );
  await waitConnected(page);
  await waitPageBlk(page, 5);
  await page.reload();
  await waitConnected(page);
  await waitPageBlk(page, 5);

  const walHref = hrefFor(baseURL!, {
    mode: "wal",
    startLsn: seed.startLsn,
    endLsn: seed.endLsn,
  });
  await page.goto(walHref);
  await waitConnected(page);
  await waitWalLoaded(page);
  await expect(page.getByLabel("start LSN")).toHaveValue(seed.startLsn);
  await expect(page.getByLabel("end LSN")).toHaveValue(seed.endLsn);
});

test("M4: BAD_URL_PARAM frozen copy, default view usable, address bar preserved", async ({
  page,
  baseURL,
}) => {
  const cases: Array<{ path: string; message: string }> = [
    {
      path: "?mode=xyz",
      message: 'Invalid URL parameter mode="xyz" (expected "page" or "wal")',
    },
    {
      path: "?mode=page&table=abc",
      message: 'Invalid URL parameter table="abc" (expected an integer in 1..4294967295)',
    },
    {
      path: "?blkno=-1",
      message: 'Invalid URL parameter blkno="-1" (expected a non-negative integer)',
    },
    {
      path: "?mode=wal&startLsn=ZZ",
      message: 'Invalid URL parameter startLsn="ZZ" (expected an LSN like 0/16B3748)',
    },
  ];
  for (const c of cases) {
    const dest = hrefFor(baseURL!, {});
    const u = new URL(dest);
    u.search = c.path.startsWith("?") ? c.path.slice(1) : c.path;
    await page.goto(u.href);
    await expect(page).toHaveURL((url) => new URL(url).search === c.path);
    const alert = alertPanel(page);
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("BAD_URL_PARAM");
    await expect(alert).toContainText(c.message);
    await expect(alert).toContainText(`Next: ${NEXT}`);
    await expect(page).toHaveURL((url) => new URL(url).search === c.path);
    await expect(page.getByRole("heading", { name: "pg-page-viewer" })).toBeVisible();
    await expect(page.getByRole("group", { name: "View mode" }).getByRole("button", { name: "Page" })).toBeEnabled();
  }
});

test("M5: object-layer errors keep existing codes", async ({ page, baseURL }) => {
  const seed = readSeed();
  await page.goto(
    hrefFor(baseURL!, { mode: "page", kind: "table", table: seed.btreeOid, blkno: 0 }),
  );
  await waitConnected(page);
  await expect(alertPanel(page)).toContainText("NOT_HEAP_TABLE");

  await page.goto(
    hrefFor(baseURL!, {
      mode: "page",
      kind: "index",
      table: seed.heapOid,
      index: seed.heapOid,
      blkno: 0,
    }),
  );
  await waitConnected(page);
  await expect(alertPanel(page)).toContainText("NOT_INDEX");

  await page.goto(
    hrefFor(baseURL!, { mode: "page", kind: "table", table: seed.heapOid, blkno: 999999 }),
  );
  await waitConnected(page);
  await expect(alertPanel(page)).toContainText("BLKNO_OUT_OF_RANGE");
});
