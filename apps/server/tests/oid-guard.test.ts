import { describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { buildApp } from "../src/app.js";
import { emptySession, type SessionState } from "../src/session.js";

type QueryResult = { rows: Record<string, unknown>[]; rowCount: number };

const HEAP_ROW = {
  oid: "16384",
  relkind: "r",
  nspname: "public",
  relname: "orders",
  blocks: "12",
};

const BTREE_ROW = {
  oid: "24576",
  relkind: "i",
  access_method: "btree",
  nspname: "public",
  relname: "orders_oid_idx",
  blocks: "12",
};

const COLUMN_ROW = {
  attnum: 1,
  name: "id",
  typname: "int4",
  attlen: 4,
  attalign: "i",
  attisdropped: false,
  typoid: "23",
};

const PAGE = Buffer.alloc(8192, 0x5a);

/**
 * Stub pg Pool modeled on indexes.test.ts: requirePageinspect uses
 * pool.connect(); routes use pool.query(). pool.query therefore only sees
 * catalog SQL, so the recorded log proves whether a route ever reached a
 * catalog lookup (the BAD_OID guard must fire before any of them).
 */
function stubPool(
  log: string[] = [],
  opts: { pageinspectMissing?: boolean; missingRelation?: boolean } = {},
): Pool {
  const dispatch = (sql: string): QueryResult => {
    const s = sql.toLowerCase();
    if (s.includes("pg_extension")) {
      if (opts.pageinspectMissing) return { rows: [], rowCount: 0 };
      return { rows: [{ ok: 1 }], rowCount: 1 };
    }
    if (s.includes("to_regprocedure")) return { rows: [{ ok: true }], rowCount: 1 };
    if (s.includes("pg_attribute")) return { rows: [COLUMN_ROW], rowCount: 1 }; // SCHEMA_COLUMNS_SQL
    if (opts.missingRelation) return { rows: [], rowCount: 0 };
    // INDEX_RELATION_SQL joins pg_am; PAGE_RELATION_SQL does not.
    if (s.includes("pg_relation_size") && s.includes("pg_am"))
      return { rows: [BTREE_ROW], rowCount: 1 };
    if (s.includes("pg_relation_size")) return { rows: [HEAP_ROW], rowCount: 1 }; // PAGE_RELATION_SQL
    if (s.includes("pg_namespace")) return { rows: [HEAP_ROW], rowCount: 1 }; // schema pg_class lookup
    if (s.includes("get_raw_page")) return { rows: [{ page: PAGE }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  };
  const client = {
    query: async (sql: string) => dispatch(sql),
    release: () => {},
  };
  return {
    connect: async () => client,
    query: async (sql: string, _params?: unknown[]) => {
      log.push(sql);
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

/** Routes with an :oid param, paired with the nextStep family they must point to. */
const OID_ROUTES: Array<{ route: string; nextStep: RegExp }> = [
  { route: "/api/tables/:oid/pages/0", nextStep: /table list/i },
  { route: "/api/indexes/:oid/pages/0", nextStep: /index list/i },
  { route: "/api/tables/:oid/schema", nextStep: /table list/i },
];

/** Invalid oid inputs: non-numeric, fractional, negative, InvalidOid 0, > uint32 max. */
const BAD_OIDS = ["abc", "1.5", "-1", "0", "4294967296", "99999999999999999999"];

describe("oid param guard — 400 BAD_OID (before any catalog query)", () => {
  for (const { route, nextStep } of OID_ROUTES) {
    describe(route, () => {
      for (const bad of BAD_OIDS) {
        it(`returns 400 BAD_OID for oid=${bad} with the raw input in message`, async () => {
          const { app } = await appWithPool(stubPool());
          const res = await app.inject({ method: "GET", url: route.replace(":oid", bad) });
          expect(res.statusCode).toBe(400);
          const body = res.json();
          expect(body.code).toBe("BAD_OID");
          expect(body.message).toContain(bad);
          expect(body.nextStep).toMatch(nextStep);
        });
      }
    });
  }

  it("BAD_OID fires before the index relation lookup (no catalog SQL issued)", async () => {
    const log: string[] = [];
    const { app } = await appWithPool(stubPool(log));
    const res = await app.inject({ method: "GET", url: "/api/indexes/abc/pages/0" });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("BAD_OID");
    expect(log).toHaveLength(0);
  });

  it("gateway still first: 401 NOT_CONNECTED for /api/tables/abc/pages/0 when not connected", async () => {
    const { app } = await appWithPool(null);
    const res = await app.inject({ method: "GET", url: "/api/tables/abc/pages/0" });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe("NOT_CONNECTED");
  });

  it("gateway still first: 400 PAGEINSPECT_MISSING beats BAD_OID", async () => {
    const { app } = await appWithPool(stubPool([], { pageinspectMissing: true }));
    const res = await app.inject({ method: "GET", url: "/api/indexes/abc/pages/0" });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("PAGEINSPECT_MISSING");
  });
});

describe("table page endpoint regression — legacy order unchanged for numeric oids", () => {
  it("unknown numeric oid still 404 NOT_HEAP_TABLE", async () => {
    const { app } = await appWithPool(stubPool([], { missingRelation: true }));
    const res = await app.inject({ method: "GET", url: "/api/tables/99999/pages/0" });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("NOT_HEAP_TABLE");
    expect(res.json()).toHaveProperty("nextStep");
  });

  it("non-integer or negative blkno still 400 BAD_BLKNO", async () => {
    const { app } = await appWithPool(stubPool());
    for (const blkno of ["abc", "-1", "1.5"]) {
      const res = await app.inject({ method: "GET", url: `/api/tables/16384/pages/${blkno}` });
      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe("BAD_BLKNO");
    }
  });

  it("blkno >= blocks still 400 BLKNO_OUT_OF_RANGE", async () => {
    const { app } = await appWithPool(stubPool());
    const res = await app.inject({ method: "GET", url: "/api/tables/16384/pages/12" });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("BLKNO_OUT_OF_RANGE");
    expect(res.json()).toHaveProperty("nextStep");
  });
});
