import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchIndexPage, listIndexes } from "./api";

const realFetch = globalThis.fetch;

type Stubbed = { status: number; body: unknown };

function stubFetch(handler: (url: string) => Stubbed) {
  const fn = vi.fn(async (input: RequestInfo | URL) => {
    const r = handler(String(input));
    return new Response(JSON.stringify(r.body), {
      status: r.status,
      headers: { "Content-Type": "application/json" },
    });
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("listIndexes", () => {
  it("GETs /api/indexes and maps the indexes array", async () => {
    const fn = stubFetch(() => ({
      status: 200,
      body: {
        indexes: [
          {
            oid: 24576,
            schema: "public",
            name: "orders_oid_idx",
            qualifiedName: "public.orders_oid_idx",
            accessMethod: "btree",
            blocks: 12,
            tableOid: 16384,
            tableQualifiedName: "public.orders",
            valid: true,
          },
          {
            oid: 24577,
            schema: "public",
            name: "orders_hash_idx",
            qualifiedName: "public.orders_hash_idx",
            accessMethod: "hash",
            blocks: 3,
            tableOid: 16384,
            tableQualifiedName: "public.orders",
            valid: false,
          },
        ],
      },
    }));
    const rows = await listIndexes();
    expect(fn.mock.calls[0]![0]).toBe("/api/indexes");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      oid: 24576,
      schema: "public",
      name: "orders_oid_idx",
      qualifiedName: "public.orders_oid_idx",
      accessMethod: "btree",
      blocks: 12,
      tableOid: 16384,
      tableQualifiedName: "public.orders",
      valid: true,
    });
    expect(rows[1]!.accessMethod).toBe("hash");
    expect(rows[1]!.valid).toBe(false);
  });

  it("propagates {code,message,nextStep} error bodies (e.g. PAGEINSPECT_MISSING)", async () => {
    stubFetch(() => ({
      status: 400,
      body: {
        code: "PAGEINSPECT_MISSING",
        message: "extension pageinspect is not installed",
        nextStep: "CREATE EXTENSION pageinspect;",
      },
    }));
    await expect(listIndexes()).rejects.toMatchObject({
      code: "PAGEINSPECT_MISSING",
      nextStep: "CREATE EXTENSION pageinspect;",
    });
  });
});

describe("fetchIndexPage", () => {
  it("GETs /api/indexes/:oid/pages/:blkno and returns the raw page envelope", async () => {
    const fn = stubFetch(() => ({
      status: 200,
      body: {
        oid: 24576,
        blkno: 0,
        qualifiedName: "public.orders_oid_idx",
        byteLength: 8192,
        pageBase64: "AAAA",
      },
    }));
    const res = await fetchIndexPage(24576, 0);
    expect(fn.mock.calls[0]![0]).toBe("/api/indexes/24576/pages/0");
    expect(res).toEqual({
      oid: 24576,
      blkno: 0,
      qualifiedName: "public.orders_oid_idx",
      byteLength: 8192,
      pageBase64: "AAAA",
    });
  });

  it("propagates INDEX_NOT_BTREE guard errors untouched", async () => {
    stubFetch(() => ({
      status: 400,
      body: {
        code: "INDEX_NOT_BTREE",
        message: 'Index access method "hash" is not supported; only B-tree index pages can be viewed',
        nextStep: "Pick a B-tree index (access method btree) or switch back to tables.",
      },
    }));
    await expect(fetchIndexPage(9999, 1)).rejects.toMatchObject({
      code: "INDEX_NOT_BTREE",
      message: expect.stringContaining("hash"),
    });
  });

  it("propagates BLKNO_OUT_OF_RANGE guard errors untouched", async () => {
    stubFetch(() => ({
      status: 400,
      body: {
        code: "BLKNO_OUT_OF_RANGE",
        message: "blkno 99999 out of range",
        nextStep: "Enter a blkno below the index block count.",
      },
    }));
    await expect(fetchIndexPage(24576, 99999)).rejects.toMatchObject({
      code: "BLKNO_OUT_OF_RANGE",
    });
  });
});
