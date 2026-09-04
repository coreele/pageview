/**
 * GET /api/indexes/:oid/columns — index column metadata endpoint
 * (index-key-decode T4; Spec API contract).
 */
import { describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { buildApp } from "../src/app.js";
import { emptySession, type SessionState } from "../src/session.js";
import { INDEX_COLUMNS_SQL, INDEX_META_SQL } from "../src/catalog.js";

type QueryResult = { rows: Record<string, unknown>[]; rowCount: number };

const BTREE_ROW = {
  oid: "24576",
  relkind: "i",
  access_method: "btree",
  nspname: "public",
  relname: "t_a_b_idx",
  blocks: "12",
};

const META_ROW = {
  indnatts: 3,
  indnkeyatts: 2,
  indkey: "1 2 3",
  indoption: "1 0",
};

const COLUMN_ROWS = [
  { attnum: 1, name: "a", typoid: 23, typname: "int4", typmod: -1 },
  { attnum: 2, name: "b", typoid: 25, typname: "text", typmod: -1 },
  { attnum: 3, name: "c", typoid: 23, typname: "int4", typmod: -1 },
];

/**
 * Stub pg Pool keyed by SQL shape: the columns endpoint issues
 * INDEX_RELATION_SQL (pg_relation_size), INDEX_META_SQL (pg_index/indkey),
 * INDEX_COLUMNS_SQL (pg_attribute + indnatts subquery).
 */
function stubPool(script: {
  relation?: Record<string, unknown> | null;
  meta?: Record<string, unknown> | null;
  columns?: Record<string, unknown>[] | null;
  pageinspectMissing?: boolean;
}): Pool {
  const dispatch = (sql: string): QueryResult => {
    const s = sql.toLowerCase();
    if (s.includes("pg_extension")) {
      if (script.pageinspectMissing) return { rows: [], rowCount: 0 };
      return { rows: [{ ok: 1 }], rowCount: 1 };
    }
    if (s.includes("to_regprocedure")) return { rows: [{ ok: true }], rowCount: 1 };
    if (s.includes("pg_relation_size")) {
      const row = script.relation === undefined ? BTREE_ROW : script.relation;
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }
    if (s.includes("pg_index") && s.includes("indkey")) {
      const row = script.meta === undefined ? META_ROW : script.meta;
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }
    if (s.includes("pg_attribute") && s.includes("indnatts")) {
      const rows = script.columns === undefined ? COLUMN_ROWS : script.columns;
      return { rows: rows ?? [], rowCount: rows?.length ?? 0 };
    }
    return { rows: [], rowCount: 0 };
  };
  const client = {
    query: async (sql: string): Promise<QueryResult> => dispatch(sql),
    release: () => {},
  };
  return {
    connect: async () => client,
    query: async (sql: string): Promise<QueryResult> => dispatch(sql),
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

describe("GET /api/indexes/:oid/columns — guard order", () => {
  it("401 NOT_CONNECTED before any catalog access", async () => {
    const { app } = await appWithPool(null);
    const res = await app.inject({ method: "GET", url: "/api/indexes/24576/columns" });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe("NOT_CONNECTED");
    expect(res.json()).toHaveProperty("nextStep");
  });

  it("400 PAGEINSPECT_MISSING after the connection gate", async () => {
    const { app } = await appWithPool(stubPool({ pageinspectMissing: true }));
    const res = await app.inject({ method: "GET", url: "/api/indexes/24576/columns" });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("PAGEINSPECT_MISSING");
  });

  it("400 BAD_OID for non-numeric / out-of-range oid", async () => {
    const { app } = await appWithPool(stubPool({}));
    for (const oid of ["abc", "-1", "0", "1.5", "4294967296"]) {
      const res = await app.inject({ method: "GET", url: `/api/indexes/${oid}/columns` });
      expect(res.statusCode, `oid=${oid}`).toBe(400);
      expect(res.json().code, `oid=${oid}`).toBe("BAD_OID");
    }
  });

  it("404 NOT_INDEX when relkind is not 'i' (table oid)", async () => {
    const { app } = await appWithPool(
      stubPool({ relation: { ...BTREE_ROW, relkind: "r" } }),
    );
    const res = await app.inject({ method: "GET", url: "/api/indexes/16384/columns" });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("NOT_INDEX");
    expect(res.json()).toHaveProperty("nextStep");
  });

  it("404 NOT_INDEX when the oid is unknown", async () => {
    const { app } = await appWithPool(stubPool({ relation: null }));
    const res = await app.inject({ method: "GET", url: "/api/indexes/99999/columns" });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("NOT_INDEX");
  });

  it("400 INDEX_NOT_BTREE for non-btree access methods (hash)", async () => {
    const { app } = await appWithPool(
      stubPool({ relation: { ...BTREE_ROW, access_method: "hash" } }),
    );
    const res = await app.inject({ method: "GET", url: "/api/indexes/24577/columns" });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("INDEX_NOT_BTREE");
    expect(res.json().message).toContain("hash");
    expect(res.json().nextStep).toMatch(/btree/i);
  });
});

describe("GET /api/indexes/:oid/columns — response shape (Spec API contract)", () => {
  it("maps indnatts/indnkeyatts/indkey/indoption to the frozen contract shape", async () => {
    const { app } = await appWithPool(stubPool({}));
    const res = await app.inject({ method: "GET", url: "/api/indexes/24576/columns" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      oid: 24576,
      schema: "public",
      name: "t_a_b_idx",
      qualifiedName: "public.t_a_b_idx",
      accessMethod: "btree",
      indnatts: 3,
      indnkeyatts: 2,
      hasExpression: false,
      columns: [
        {
          attnum: 1,
          name: "a",
          typoid: 23,
          typname: "int4",
          typmod: -1,
          kind: "key",
          isExpression: false,
          descending: true,
          nullsFirst: false,
        },
        {
          attnum: 2,
          name: "b",
          typoid: 25,
          typname: "text",
          typmod: -1,
          kind: "key",
          isExpression: false,
          descending: false,
          nullsFirst: false,
        },
        {
          attnum: 3,
          name: "c",
          typoid: 23,
          typname: "int4",
          typmod: -1,
          kind: "include",
          isExpression: false,
          // include columns never carry indoption bits
          descending: false,
          nullsFirst: false,
        },
      ],
    });
  });

  it("parses indoption DESC|NULLS_FIRST bits (PG records defaults explicitly)", async () => {
    const { app } = await appWithPool(
      stubPool({ meta: { indnatts: 2, indnkeyatts: 2, indkey: "1 2", indoption: "3 0" } }),
    );
    const res = await app.inject({ method: "GET", url: "/api/indexes/24576/columns" });
    expect(res.statusCode).toBe(200);
    const cols = res.json().columns;
    expect(cols[0]).toMatchObject({ descending: true, nullsFirst: true });
    expect(cols[1]).toMatchObject({ descending: false, nullsFirst: false });
  });

  it("marks expression indexes via indkey zero entries", async () => {
    const { app } = await appWithPool(
      stubPool({
        meta: { indnatts: 2, indnkeyatts: 2, indkey: "1 0", indoption: "0 0" },
        columns: [
          { attnum: 1, name: "a", typoid: 23, typname: "int4", typmod: -1 },
          { attnum: 2, name: "lower", typoid: 25, typname: "text", typmod: -1 },
        ],
      }),
    );
    const res = await app.inject({ method: "GET", url: "/api/indexes/24576/columns" });
    expect(res.statusCode).toBe(200);
    expect(res.json().hasExpression).toBe(true);
    expect(res.json().columns[0]).toMatchObject({ isExpression: false });
    expect(res.json().columns[1]).toMatchObject({ isExpression: true });
  });

  it("tolerates an empty indoption vector (indexes without options)", async () => {
    const { app } = await appWithPool(
      stubPool({ meta: { indnatts: 1, indnkeyatts: 1, indkey: "1", indoption: "" } }),
    );
    const res = await app.inject({ method: "GET", url: "/api/indexes/24576/columns" });
    expect(res.statusCode).toBe(200);
    expect(res.json().columns[0]).toMatchObject({ descending: false, nullsFirst: false });
  });
});

describe("catalog SQL contract", () => {
  it("INDEX_META_SQL reads indnatts/indnkeyatts/indkey/indoption by indexrelid", () => {
    expect(INDEX_META_SQL).toMatch(/pg_index/);
    expect(INDEX_META_SQL).toMatch(/indkey::text\s+AS\s+indkey/i);
    expect(INDEX_META_SQL).toMatch(/indoption::text\s+AS\s+indoption/i);
    expect(INDEX_META_SQL).toMatch(/indexrelid\s*=\s*\$1/);
  });

  it("INDEX_COLUMNS_SQL joins pg_attribute of the index with pg_type, attnum-bounded, ordered", () => {
    expect(INDEX_COLUMNS_SQL).toMatch(/pg_attribute\s+a/i);
    expect(INDEX_COLUMNS_SQL).toMatch(/JOIN\s+pg_type\s+t\s+ON\s+t\.oid\s*=\s*a\.atttypid/i);
    expect(INDEX_COLUMNS_SQL).toMatch(/a\.attrelid\s*=\s*\$1/);
    expect(INDEX_COLUMNS_SQL).toMatch(/a\.attnum\s*>\s*0/);
    expect(INDEX_COLUMNS_SQL).toMatch(/attnum\s*<=\s*\(SELECT\s+indnatts\s+FROM\s+pg_index/i);
    expect(INDEX_COLUMNS_SQL).toMatch(/ORDER BY a\.attnum/i);
  });
});
