import { test, expect } from "@playwright/test";
import { readSeed } from "./helpers/db.ts";
import { hrefFor, waitConnected, waitPageBlk } from "./helpers/app.ts";

test("M10: two tabs keep independent blkno views", async ({ context, baseURL }) => {
  const seed = readSeed();
  const pageA = await context.newPage();
  const pageB = await context.newPage();
  await pageA.goto(
    hrefFor(baseURL!, { mode: "page", kind: "table", table: seed.heapOid, blkno: 5 }),
  );
  await pageB.goto(
    hrefFor(baseURL!, { mode: "page", kind: "table", table: seed.heapOid, blkno: 7 }),
  );
  await waitConnected(pageA);
  await waitConnected(pageB);
  await waitPageBlk(pageA, 5);
  await waitPageBlk(pageB, 7);

  const shared = pageA.url();
  const pageC = await context.newPage();
  await pageC.goto(shared);
  await waitConnected(pageC);
  await waitPageBlk(pageC, 5);
  await waitPageBlk(pageA, 5);
  await waitPageBlk(pageB, 7);
  await pageA.close();
  await pageB.close();
  await pageC.close();
});
