import { test, expect } from "@playwright/test";
import { readSeed } from "./helpers/db.ts";
import {
  expectSearch,
  pageLoadButton,
  searchFor,
  selectTableOid,
  waitConnected,
  waitPageBlk,
  waitTableListed,
} from "./helpers/app.ts";

test("M1: selection replaceState, Load push, failure/unloaded do not write, back skips selection", async ({
  page,
}) => {
  const seed = readSeed();
  await page.goto("/");
  await waitConnected(page);
  await waitTableListed(page, seed.heapName);

  await selectTableOid(page, seed.heapOid);
  const selected = searchFor({ mode: "page", kind: "table", table: seed.heapOid });
  await expectSearch(page, selected);

  await page.getByLabel("blkno").fill("5");
  await expectSearch(page, selected);

  await pageLoadButton(page).click();
  await waitPageBlk(page, 5);
  const loaded = searchFor({ mode: "page", kind: "table", table: seed.heapOid, blkno: 5 });
  await expectSearch(page, loaded);

  await page.getByLabel("blkno").fill("999999");
  await pageLoadButton(page).click();
  await expect(page.getByRole("alert")).toContainText("BLKNO_OUT_OF_RANGE");
  await expectSearch(page, loaded);

  await page.goBack();
  await expectSearch(page, selected);
  await page.goForward();
  await waitPageBlk(page, 5);
  await expectSearch(page, loaded);
});
