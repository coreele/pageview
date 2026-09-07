import { test, expect } from "@playwright/test";
import { readSeed } from "./helpers/db.ts";
import {
  expectSearch,
  hrefFor,
  pageLoadButton,
  searchFor,
  waitConnected,
  waitPageBlk,
  waitWalLoaded,
} from "./helpers/app.ts";

test("M6: history 5→7 back/forward reloads; same-block Refresh adds no entry", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(60_000);
  const seed = readSeed();
  await page.goto(
    hrefFor(baseURL!, { mode: "page", kind: "table", table: seed.heapOid, blkno: 5 }),
  );
  await waitConnected(page);
  await waitPageBlk(page, 5);

  await page.getByLabel("blkno").fill("7");
  await pageLoadButton(page).click();
  await waitPageBlk(page, 7);
  const url7 = searchFor({ mode: "page", kind: "table", table: seed.heapOid, blkno: 7 });
  await expectSearch(page, url7);

  await page.goBack();
  await waitPageBlk(page, 5);
  await expectSearch(page, searchFor({ mode: "page", kind: "table", table: seed.heapOid, blkno: 5 }));

  await page.goForward();
  await waitPageBlk(page, 7);
  await expectSearch(page, url7);

  await page.getByRole("button", { name: "Refresh" }).click();
  await waitPageBlk(page, 7);
  await expectSearch(page, url7);
  await page.goBack();
  await waitPageBlk(page, 5);
});

test("M8: LSN %2F and / both restore; copied URL round-trips", async ({ page, context, baseURL }) => {
  const seed = readSeed();
  const encoded = hrefFor(baseURL!, {
    mode: "wal",
    startLsn: seed.startLsn,
    endLsn: seed.endLsn,
  });
  await page.goto(encoded);
  await waitConnected(page);
  await waitWalLoaded(page);

  const copied = page.url();
  const page2 = await context.newPage();
  await page2.goto(copied);
  await waitConnected(page2);
  await waitWalLoaded(page2);
  await expect(page2.getByLabel("start LSN")).toHaveValue(seed.startLsn);
  await expect(page2.getByLabel("end LSN")).toHaveValue(seed.endLsn);
  await page2.close();

  const slash = `${baseURL}/?mode=wal&startLsn=${seed.startLsn}&endLsn=${seed.endLsn}`;
  await page.goto(slash);
  await waitConnected(page);
  await waitWalLoaded(page);
});

test("M9: P1 guards — normalize, unknown param, single LSN, blk 0, no-request, drop index", async ({
  page,
  baseURL,
}) => {
  const seed = readSeed();

  await page.goto(`${baseURL}/?foo=1&mode=wal`);
  await waitConnected(page);
  await expectSearch(page, searchFor({ mode: "wal" }));
  await expect(page.getByLabel("WAL context").getByText("not loaded")).toBeVisible();

  await page.goto(hrefFor(baseURL!, { mode: "wal", startLsn: seed.startLsn }));
  await waitConnected(page);
  await expect(page.getByLabel("start LSN")).toHaveValue(seed.startLsn);
  await expect(page.getByLabel("WAL context").getByText("not loaded")).toBeVisible();

  await page.goto(hrefFor(baseURL!, { mode: "page", kind: "table", table: seed.heapOid }));
  await waitConnected(page);
  await waitPageBlk(page, 0);

  const pageReqs: string[] = [];
  page.on("request", (req) => {
    const u = req.url();
    if (u.includes("/api/tables/") && u.includes("/pages/")) pageReqs.push(u);
    if (u.includes("/api/indexes/") && u.includes("/pages/")) pageReqs.push(u);
  });

  await page.goto(
    hrefFor(baseURL!, { mode: "page", kind: "table", table: seed.emptyOid, blkno: 0 }),
  );
  await waitConnected(page);
  await expect(page.getByLabel("Page statistics")).toHaveCount(0);

  await page.goto(
    hrefFor(baseURL!, {
      mode: "page",
      kind: "index",
      table: seed.hashHeapOid,
      index: seed.hashIndexOid,
      blkno: 0,
    }),
  );
  await waitConnected(page);
  await expect(page.getByLabel("Index page statistics")).toHaveCount(0);

  await page.goto(
    hrefFor(baseURL!, {
      mode: "page",
      kind: "index",
      table: seed.emptyOid,
      index: seed.btreeOid,
      blkno: 0,
    }),
  );
  await waitConnected(page);
  await expect(page.getByLabel("Index page statistics")).toHaveCount(0);

  expect(pageReqs, "M9 guards must not issue page fetches").toEqual([]);
});
