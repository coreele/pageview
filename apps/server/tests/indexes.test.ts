import { describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { buildApp } from "../src/app.js";
import { emptySession, type SessionState } from "../src/session.js";

type QueryResult = { rows: Record<string, unknown>[]; rowCount: number };

type ScriptedReply =
  | { kind: "pageinspect-ok" }
  | { kind: "pageinspect-missing" }
  | { kind: "index-relation"; row?: Record<string, unknown> }
  | { kind: "list-indexes"; rows: Record<string, unknown>[] }
  | { kind: "raw-page"; page: Buffer }
  | { kind: "error"; err: Error };

/**
 * Stub pg Pool: requirePageinspect uses pool.connect(); routes use
 * pool.query(). Both funnel into the same script keyed by SQL text.
 */
function stubPool(script: ScriptedReply): Pool {
  const dispatch = (sql: string): QueryResult => {
    const s = sql.toLowerCase();
    if (s.includes("pg_extension")) {
      if (script.kind === "pageinspect-missing") return { rows: [], rowCount: 0 };
      return { rows: [{ ok: 1 }], rowCount: 1 };
    }
    if (s.includes("to_regprocedure")) return { rows: [{ ok: true }], rowCount: 1 };
    if (s.includes("pg_relation_size") && s.includes("pg_index")) {
      return {
        rows: (script as { rows?: Record<string, unknown>[] }).rows ?? [],
        rowCount: ((script as { rows?: Record<string, unknown>[] }).rows ?? []).length,
      };
    }
    if (s.includes("pg_relation_size")) {
      const row = (script as { row?: Record<string, unknown> }).row;
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }
    if (s.includes("get_raw_page")) {
      return { rows: [{ page: (script as { page?: Buffer }).page }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };
  const client = {
    query: async (sql: string) => dispatch(sql),
    release: () => {},
  };
  return {
    connect: async () => client,
    query: async (sql: string, _params?: unknown[]) => {
      if (script.kind === "error") throw script.err;
      return dispatch(sql);
    },
    end: async () => {},
  } as unknown as Pool;
}

async function appWithPool(pool: Pool | null) {
  const session: SessionState = emptySession();
  const built = await buildApp(session);
  session.connected = pool !== null;
  session.pool = pool;
  return built;
}

const BTREE_ROW = {
  oid: "24576",
  relkind: "i",
  access_method: "btree",
  nspname: "public",
  relname: "orders_oid_idx",
  blocks: "12",
};

const PAGE = Buffer.alloc(8192, 0x5a);

describe("GET /api/indexes", () => {
  it("returns 401 NOT_CONNECTED when not connected", async () => {
    const { app } = await appWithPool(null);
    const res = await app.inject({ method: "GET", url: "/api/indexes" });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe("NOT_CONNECTED");
    expect(res.json()).toHaveProperty("nextStep");
  });

  it("returns 400 PAGEINSPECT_MISSING when the extension gate fails", async () => {
    const { app } = await appWithPool(stubPool({ kind: "pageinspect-missing" }));
    const res = await app.inject({ method: "GET", url: "/api/indexes" });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("PAGEINSPECT_MISSING");
  });

  it("maps catalog rows to the index list shape", async () => {
    const { app } = await appWithPool(
      stubPool({
        kind: "list-indexes",
        rows: [
          {
            oid: "24576",
            schema: "public",
            name: "orders_oid_idx",
            access_method: "btree",
            blocks: "12",
            table_oid: "16384",
            table_schema: "public",
            table_name: "orders",
            valid: true,
          },
          {
            oid: "24577",
            schema: "public",
            name: "orders_h_idx",
            access_method: "hash",
            blocks: "2",
            table_oid: "16384",
            table_schema: "public",
            table_name: "orders",
            valid: false,
          },
        ],
      }),
    );
    const res = await app.inject({ method: "GET", url: "/api/indexes" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.indexes).toHaveLength(2);
    expect(body.indexes[0]).toEqual({
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
    expect(body.indexes[1]).toMatchObject({ accessMethod: "hash", valid: false });
  });
});

describe("GET /api/indexes/:oid/pages/:blkno — guard order", () => {
  it("① 404 NOT_INDEX when oid is unknown (takes precedence over bad blkno)", async () => {
    const { app } = await appWithPool(stubPool({ kind: "index-relation", row: undefined }));
    const res = await app.inject({ method: "GET", url: "/api/indexes/99999/pages/abc" });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("NOT_INDEX");
    expect(res.json()).toHaveProperty("nextStep");
  });

  it("① 404 NOT_INDEX when relkind is not 'i'", async () => {
    const { app } = await appWithPool(
      stubPool({ kind: "index-relation", row: { ...BTREE_ROW, relkind: "r" } }),
    );
    const res = await app.inject({ method: "GET", url: "/api/indexes/16384/pages/0" });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("NOT_INDEX");
  });

  it("② 400 INDEX_NOT_BTREE with the access method name, before blkno checks", async () => {
    const { app } = await appWithPool(
      stubPool({ kind: "index-relation", row: { ...BTREE_ROW, access_method: "hash" } }),
    );
    const res = await app.inject({ method: "GET", url: "/api/indexes/24577/pages/abc" });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("INDEX_NOT_BTREE");
    expect(res.json().message).toContain("hash");
    expect(res.json().nextStep).toMatch(/btree/i);
  });

  it("③ 400 BAD_BLKNO for non-integer or negative blkno", async () => {
    const { app } = await appWithPool(stubPool({ kind: "index-relation", row: BTREE_ROW }));
    for (const blkno of ["abc", "-1", "1.5"]) {
      const res = await app.inject({ method: "GET", url: `/api/indexes/24576/pages/${blkno}` });
      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe("BAD_BLKNO");
    }
  });

  it("④ 400 BLKNO_OUT_OF_RANGE when blkno >= blocks", async () => {
    const { app } = await appWithPool(stubPool({ kind: "index-relation", row: BTREE_ROW }));
    const res = await app.inject({ method: "GET", url: "/api/indexes/24576/pages/12" });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("BLKNO_OUT_OF_RANGE");
    expect(res.json()).toHaveProperty("nextStep");
  });

  it("401 NOT_CONNECTED and 400 PAGEINSPECT_MISSING gates apply first", async () => {
    const off = await appWithPool(null);
    const resOff = await off.app.inject({ method: "GET", url: "/api/indexes/24576/pages/0" });
    expect(resOff.statusCode).toBe(401);
    expect(resOff.json().code).toBe("NOT_CONNECTED");

    const missing = await appWithPool(stubPool({ kind: "pageinspect-missing" }));
    const resMissing = await missing.app.inject({
      method: "GET",
      url: "/api/indexes/24576/pages/0",
    });
    expect(resMissing.statusCode).toBe(400);
    expect(resMissing.json().code).toBe("PAGEINSPECT_MISSING");
  });

  it("serves the raw page in the same shape as the table page endpoint", async () => {
    const { app } = await appWithPool(combinedRelationAndPagePool());
    const res = await app.inject({ method: "GET", url: "/api/indexes/24576/pages/3" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toEqual({
      oid: 24576,
      blkno: 3,
      qualifiedName: "public.orders_oid_idx",
      byteLength: 8192,
      pageBase64: PAGE.toString("base64"),
    });
  });
});

/** Stub whose INDEX_RELATION_SQL returns the btree row and get_raw_page a page. */
function combinedRelationAndPagePool(): Pool {
  const client = {
    query: async (sql: string): Promise<QueryResult> => {
      const s = sql.toLowerCase();
      if (s.includes("pg_extension")) return { rows: [{ ok: 1 }], rowCount: 1 };
      if (s.includes("to_regprocedure")) return { rows: [{ ok: true }], rowCount: 1 };
      if (s.includes("pg_relation_size")) return { rows: [BTREE_ROW], rowCount: 1 };
      if (s.includes("get_raw_page")) return { rows: [{ page: PAGE }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    },
    release: () => {},
  };
  return {
    connect: async () => client,
    query: async (sql: string): Promise<QueryResult> => client.query(sql),
    end: async () => {},
  } as unknown as Pool;
}
