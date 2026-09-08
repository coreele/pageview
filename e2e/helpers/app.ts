import { expect, type Page } from "@playwright/test";
import { buildUrlState, defaultUrlState, type UrlState } from "./url.ts";

export function hrefFor(baseURL: string, state: Partial<UrlState>): string {
  const full: UrlState = { ...defaultUrlState(), ...state };
  const u = new URL(baseURL.endsWith("/") ? baseURL : `${baseURL}/`);
  const search = buildUrlState(full);
  u.search = search.startsWith("?") ? search.slice(1) : search;
  return u.href;
}

export function searchFor(state: Partial<UrlState>): string {
  return buildUrlState({ ...defaultUrlState(), ...state });
}

export async function expectSearch(page: Page, search: string): Promise<void> {
  await expect(page).toHaveURL((url) => {
    const u = new URL(url);
    return u.pathname === "/" && u.search === search;
  });
}

export async function waitConnected(page: Page): Promise<void> {
  await expect(page.locator(".chrome-badge.badge-conn")).toBeVisible({ timeout: 15_000 });
}

export async function waitDisconnected(page: Page): Promise<void> {
  await expect(page.locator(".chrome-badge")).toHaveText("disconnected", { timeout: 15_000 });
}

export function tableSelect(page: Page) {
  return page.locator("select.table-select");
}

export async function waitTableListed(page: Page, name: string): Promise<void> {
  const leaf = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : name;
  await expect(page.locator("#btree-tree-panel .btree-tree-blk", { hasText: leaf })).toHaveCount(1, {
    timeout: 15_000,
  });
}

export async function selectTableOid(page: Page, oid: number): Promise<void> {
  await page.locator(`#btree-tree-panel [data-row="table:${oid}"] .btree-tree-label`).click();
}

export async function selectIndexOid(page: Page, oid: number): Promise<void> {
  await page.locator(`#btree-tree-panel [data-row="index:${oid}"] .btree-tree-label`).click();
}

export async function waitPageBlk(page: Page, blkno: number): Promise<void> {
  const stats = page.getByLabel("Page statistics");
  await expect(stats).toBeVisible({ timeout: 15_000 });
  await expect(
    stats.locator(".meta-item").filter({ has: page.locator(".label", { hasText: /^blkno$/ }) }).locator(".value"),
  ).toHaveText(String(blkno));
}

export async function waitIndexBlk(page: Page, blkno: number): Promise<void> {
  const stats = page.getByLabel("Index page statistics");
  await expect(stats).toBeVisible({ timeout: 15_000 });
  await expect(stats.locator(".meta-item", { hasText: "blkno" }).locator(".value")).toHaveText(
    String(blkno),
  );
}

export async function waitWalLoaded(page: Page): Promise<void> {
  const stats = page.getByLabel("WAL context");
  await expect(stats).toBeVisible({ timeout: 15_000 });
  await expect(stats.getByText("not loaded")).toHaveCount(0);
}

export async function selectPageBrowseMode(page: Page, mode: "tree" | "single"): Promise<void> {
  const label = mode === "tree" ? "Tree" : "Single";
  await page.getByRole("group", { name: "Page browse mode" }).getByRole("button", { name: label, exact: true }).click();
}

export function pageLoadButton(page: Page) {
  return page.locator(".chrome-controls").getByRole("button", { name: "Load", exact: true });
}

export function alertPanel(page: Page) {
  return page.getByRole("alert");
}
