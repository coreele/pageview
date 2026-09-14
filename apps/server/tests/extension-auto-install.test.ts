import { describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { buildApp } from "../src/app.js";
import {
  emptySession,
  requirePageinspect,
  requirePgVisibility,
  type SessionState,
} from "../src/session.js";

/**
 * Guard auto-install contract (spec): check → missing ⇒ one bare
 * `CREATE EXTENSION IF NOT EXISTS <ext>` → recheck → gate error only when the
 * automatic install failed. The stub pool records the full SQL sequence so
 * assertions cover statement order, zero-DDL on the installed path, in-place
 * error conversion (never leaking through mapPgError as PERMISSION/INTERNAL),
 * and concurrent-idempotency (P0-1..P0-6, P1-1..P1-3).
 */

type QueryResult = { rows: Record<string, unknown>[]; rowCount: number };

type StubPlan = {
  /** Answer for the Nth existence check (1-based); default: always present. */
  exists?: (callIndex: number) => boolean;
  /** Behavior when the guard issues CREATE EXTENSION (throw to simulate PG errors). */
  onInstall?: (sql: string) => void;
  /** PAGE_RELATION_SQL / LIST_TABLES_SQL row (default: heap TABLE_ROW). */
  relationRow?: Record<string, unknown>;
  /** pg_visibility result: undefined → happy row; null → zero rows; object → that row. */
  visibilityRow?: Record<string, unknown> | null;
};

const TABLE_ROW = {
  oid: "16384",
  schema: "public",
  name: "orders",
  blocks: "3",
  relkind: "r",
  nspname: "public",
  relname: "orders",
};

function pgErr(code: string, message: string): Error & { code: string } {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  return err;
}

function recordingPool(plan: StubPlan): {
  pool: Pool;
  sqlLog: string[];
  connects: () => number;
} {
  const sqlLog: string[] = [];
  let existsCalls = 0;
  let connectCalls = 0;

  const dispatch = (sql: string): QueryResult => {
    const s = sql.toLowerCase();
    if (s.includes("pg_extension") && s.includes("extname")) {
      existsCalls += 1;
      const present = plan.exists?.(existsCalls) ?? true;
      return { rows: present ? [{ "?column?": 1 }] : [], rowCount: present ? 1 : 0 };
    }
    if (s.includes("to_regprocedure")) return { rows: [{ ok: true }], rowCount: 1 };
    if (s.includes("pg_current_wal_lsn")) return { rows: [{ lsn: "0/16B3748" }], rowCount: 1 };
    if (s.includes("pg_relation_size") && s.includes("pg_class")) {
      return { rows: [plan.relationRow ?? TABLE_ROW], rowCount: 1 };
    }
    if (s.includes("from pg_visibility(")) {
      if (plan.visibilityRow === null) return { rows: [], rowCount: 0 };
      const row = plan.visibilityRow ?? {
        allVisible: true,
        allFrozen: false,
        pdAllVisible: true,
      };
      return { rows: [row], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  const client = {
    query: async (sql: string): Promise<QueryResult> => {
      sqlLog.push(sql);
      if (/^\s*CREATE EXTENSION/i.test(sql)) plan.onInstall?.(sql);
      return dispatch(sql);
    },
    release: () => {},
  };

  const pool = {
    connect: async () => {
      connectCalls += 1;
      return client;
    },
    query: async (sql: string): Promise<QueryResult> => {
      sqlLog.push(sql);
      return dispatch(sql);
    },
    end: async () => {},
  } as unknown as Pool;

  return { pool, sqlLog, connects: () => connectCalls };
}

async function appWith(
  pool: Pool | null,
  serverVersion: string | null = "PostgreSQL 16.1",
) {
  const session: SessionState = emptySession();
  const built = await buildApp(session);
  session.connected = pool !== null;
  session.pool = pool;
  session.serverVersion = serverVersion;
  return { app: built.app, session };
}

const createStatements = (sqlLog: string[]) =>
  sqlLog.filter((s) => /create extension/i.test(s));

describe("guard auto-install: missing → CREATE EXTENSION IF NOT EXISTS → recheck (P0-1/P0-2)", () => {
  it("P0-1 pageinspect missing → bare install statement → recheck passes → /api/tables 200 with data", async () => {
    const rec = recordingPool({ exists: (i) => i > 1 });
    const { app } = await appWith(rec.pool);
    const res = await app.inject({ method: "GET", url: "/api/tables" });
    expect(res.statusCode).toBe(200);
    expect(res.json().tables).toEqual([
      {
        oid: 16384,
        schema: "public",
        name: "orders",
        qualifiedName: "public.orders",
        blocks: 3,
      },
    ]);
    // SQL sequence: existence check → bare install (no SCHEMA/VERSION) → recheck → callability
    expect(rec.sqlLog[0]).toMatch(/pg_extension.*pageinspect/i);
    expect(rec.sqlLog[1]).toBe("CREATE EXTENSION IF NOT EXISTS pageinspect");
    expect(rec.sqlLog[2]).toMatch(/pg_extension.*pageinspect/i);
    expect(rec.sqlLog[3]).toMatch(/to_regprocedure.*get_raw_page/i);
  });

  it("P0-2 pg_walinspect missing on PG16 → auto-install → recheck passes → /api/wal/current-lsn 200", async () => {
    const rec = recordingPool({ exists: (i) => i > 1 });
    const { app } = await appWith(rec.pool);
    const res = await app.inject({ method: "GET", url: "/api/wal/current-lsn" });
    expect(res.statusCode).toBe(200);
    expect(res.json().lsn).toBe("0/16B3748");
    expect(rec.sqlLog[0]).toMatch(/pg_extension.*pg_walinspect/i);
    expect(rec.sqlLog[1]).toBe("CREATE EXTENSION IF NOT EXISTS pg_walinspect");
    expect(rec.sqlLog[2]).toMatch(/pg_extension.*pg_walinspect/i);
  });
});

describe("guard auto-install: in-place error conversion (P0-3/P0-4/P0-7)", () => {
  it("P0-3 install denied (42501) → 400 PAGEINSPECT_MISSING with PG reason — not 403 PERMISSION", async () => {
    const rec = recordingPool({
      exists: () => false,
      onInstall: () => {
        throw pgErr("42501", 'permission denied to create extension "pageinspect"');
      },
    });
    const { app } = await appWith(rec.pool);
    const res = await app.inject({ method: "GET", url: "/api/tables" });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe("PAGEINSPECT_MISSING");
    expect(body.message).toContain("permission denied to create extension");
    expect(body.nextStep).toMatch(/CREATE EXTENSION pageinspect/i);
    expect(body.nextStep).toMatch(/superuser/i);
    expect(body.nextStep).not.toMatch(/will not run/i);
    expect(Object.keys(body).sort()).toEqual(["code", "message", "nextStep"]);
    expect(createStatements(rec.sqlLog)).toHaveLength(1);
  });

  it("P0-4 extension files missing (not available) → 400 WALINSPECT_MISSING with PG reason", async () => {
    const rec = recordingPool({
      exists: () => false,
      onInstall: () => {
        throw pgErr("58P01", 'extension "pg_walinspect" is not available');
      },
    });
    const { app } = await appWith(rec.pool);
    const res = await app.inject({ method: "GET", url: "/api/wal/current-lsn" });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe("WALINSPECT_MISSING");
    expect(body.message).toContain('extension "pg_walinspect" is not available');
    expect(body.nextStep).toMatch(/CREATE EXTENSION pg_walinspect/i);
    expect(Object.keys(body).sort()).toEqual(["code", "message", "nextStep"]);
  });
});

describe("guard auto-install: installed path and version gate (P0-5/P0-6)", () => {
  it("P0-5 both extensions installed → zero DDL across Page and WAL routes", async () => {
    const rec = recordingPool({ exists: () => true });
    const { app } = await appWith(rec.pool);
    const pageRes = await app.inject({ method: "GET", url: "/api/tables" });
    const walRes = await app.inject({ method: "GET", url: "/api/wal/current-lsn" });
    expect(pageRes.statusCode).toBe(200);
    expect(walRes.statusCode).toBe(200);
    expect(createStatements(rec.sqlLog)).toEqual([]);
    // Each guard ran exactly: existence check + callability probe (status quo).
    expect(rec.sqlLog.filter((s) => /pg_extension/.test(s))).toHaveLength(2);
    expect(rec.sqlLog.filter((s) => /to_regprocedure/.test(s))).toHaveLength(2);
  });

  it("P0-6 PG14 → PG_VERSION_UNSUPPORTED before any pool use: no extension query, no DDL, no connect", async () => {
    const rec = recordingPool({});
    const { app } = await appWith(rec.pool, "PostgreSQL 14.12 on x86_64-pc-linux-gnu");
    const res = await app.inject({ method: "GET", url: "/api/wal/current-lsn" });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("PG_VERSION_UNSUPPORTED");
    expect(rec.sqlLog).toEqual([]);
    expect(rec.connects()).toBe(0);
  });
});

describe("guard auto-install: retry and concurrency semantics (P1-1/P1-2/P1-3)", () => {
  it("P1-1 install fails once, next request in the same session succeeds (no negative caching)", async () => {
    let attempts = 0;
    const rec = recordingPool({
      exists: (i) => i > 2,
      onInstall: () => {
        attempts += 1;
        if (attempts === 1) {
          throw pgErr("42501", "permission denied to create extension");
        }
      },
    });
    const { app } = await appWith(rec.pool);
    const first = await app.inject({ method: "GET", url: "/api/tables" });
    expect(first.statusCode).toBe(400);
    expect(first.json().code).toBe("PAGEINSPECT_MISSING");
    const second = await app.inject({ method: "GET", url: "/api/tables" });
    expect(second.statusCode).toBe(200);
  });

  it("P1-2 concurrent guards: one CREATE succeeds, the other throws 42710 → both pass, no spurious error", async () => {
    let installs = 0;
    const rec = recordingPool({
      exists: (i) => i > 2, // both initial checks missing; both rechecks present
      onInstall: () => {
        installs += 1;
        if (installs === 2) {
          throw pgErr("42710", 'extension "pageinspect" already exists');
        }
      },
    });
    await Promise.all([requirePageinspect(rec.pool), requirePageinspect(rec.pool)]);
    expect(createStatements(rec.sqlLog)).toHaveLength(2);
  });

  it("P1-2 concurrent guards: both CREATEs succeed (idempotent) → both pass", async () => {
    const rec = recordingPool({ exists: (i) => i > 2 });
    await Promise.all([requirePageinspect(rec.pool), requirePageinspect(rec.pool)]);
    expect(createStatements(rec.sqlLog)).toHaveLength(2);
  });

  it("P1-2 repeated route requests: first installs, second reuses without DDL and stays 200", async () => {
    const rec = recordingPool({ exists: (i) => i > 1 });
    const { app } = await appWith(rec.pool);
    const first = await app.inject({ method: "GET", url: "/api/tables" });
    const second = await app.inject({ method: "GET", url: "/api/tables" });
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(createStatements(rec.sqlLog)).toHaveLength(1);
  });

  it("P1-3 install statement succeeds but recheck still missing → 400 PAGEINSPECT_MISSING", async () => {
    const rec = recordingPool({ exists: () => false });
    const { app } = await appWith(rec.pool);
    const res = await app.inject({ method: "GET", url: "/api/tables" });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe("PAGEINSPECT_MISSING");
    expect(body.message).toMatch(/missing|not (take effect|installed)/i);
    expect(body.nextStep).toMatch(/CREATE EXTENSION pageinspect/i);
    // Sequence stopped after the failed recheck: check → CREATE → recheck, no callability probe.
    expect(rec.sqlLog).toHaveLength(3);
    expect(rec.sqlLog[2]).toMatch(/pg_extension/i);
  });
});

describe("pg_visibility guard: auto-install + error conversion (P0-2/P0-3/P0-6/P1-1/P1-2/P1-3)", () => {
  it("P0-2 pg_visibility missing → bare install → recheck → visibility endpoint 200", async () => {
    const rec = recordingPool({ exists: (i) => i > 1 });
    const { app } = await appWith(rec.pool);
    const res = await app.inject({ method: "GET", url: "/api/tables/16384/pages/0/visibility" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      oid: 16384,
      blkno: 0,
      qualifiedName: "public.orders",
      allVisible: true,
      allFrozen: false,
      pdAllVisible: true,
    });
    expect(createStatements(rec.sqlLog)).toEqual(["CREATE EXTENSION IF NOT EXISTS pg_visibility"]);
    expect(rec.sqlLog.filter((s) => /pg_extension.*pg_visibility/i.test(s))).toHaveLength(2);
    expect(rec.sqlLog.some((s) => /to_regprocedure.*pg_visibility/i.test(s))).toBe(true);
  });

  it("P0-3 install denied (42501) → 400 VISIBILITY_MISSING with PG reason — not 403 PERMISSION", async () => {
    const rec = recordingPool({
      exists: () => false,
      onInstall: () => {
        throw pgErr("42501", 'permission denied to create extension "pg_visibility"');
      },
    });
    const { app } = await appWith(rec.pool);
    const res = await app.inject({ method: "GET", url: "/api/tables/16384/pages/0/visibility" });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe("VISIBILITY_MISSING");
    expect(body.message).toContain("permission denied to create extension");
    expect(body.nextStep).toMatch(/CREATE EXTENSION pg_visibility/i);
    expect(body.nextStep).toMatch(/superuser/i);
    expect(Object.keys(body).sort()).toEqual(["code", "message", "nextStep"]);
  });

  it("P0-6 pg_visibility installed → zero DDL on the visibility endpoint", async () => {
    const rec = recordingPool({ exists: () => true });
    const { app } = await appWith(rec.pool);
    const res = await app.inject({ method: "GET", url: "/api/tables/16384/pages/0/visibility" });
    expect(res.statusCode).toBe(200);
    expect(createStatements(rec.sqlLog)).toEqual([]);
    expect(rec.sqlLog.filter((s) => /pg_extension.*pg_visibility/i.test(s))).toHaveLength(1);
  });

  it("P1-1 install fails once, next request in the same session succeeds (no negative caching)", async () => {
    let attempts = 0;
    const rec = recordingPool({
      exists: (i) => i > 2,
      onInstall: () => {
        attempts += 1;
        if (attempts === 1) throw pgErr("42501", "permission denied to create extension");
      },
    });
    const { app } = await appWith(rec.pool);
    const first = await app.inject({ method: "GET", url: "/api/tables/16384/pages/0/visibility" });
    expect(first.statusCode).toBe(400);
    expect(first.json().code).toBe("VISIBILITY_MISSING");
    const second = await app.inject({ method: "GET", url: "/api/tables/16384/pages/0/visibility" });
    expect(second.statusCode).toBe(200);
  });

  it("P1-2 concurrent guards: one CREATE succeeds, the other throws 42710 → both pass", async () => {
    let installs = 0;
    const rec = recordingPool({
      exists: (i) => i > 2,
      onInstall: () => {
        installs += 1;
        if (installs === 2) throw pgErr("42710", 'extension "pg_visibility" already exists');
      },
    });
    await Promise.all([requirePgVisibility(rec.pool), requirePgVisibility(rec.pool)]);
    expect(createStatements(rec.sqlLog)).toHaveLength(2);
  });

  it("P1-3 install statement succeeds but recheck still missing → 400 VISIBILITY_MISSING", async () => {
    const rec = recordingPool({ exists: () => false });
    const { app } = await appWith(rec.pool);
    const res = await app.inject({ method: "GET", url: "/api/tables/16384/pages/0/visibility" });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe("VISIBILITY_MISSING");
    expect(body.message).toMatch(/missing|not (take effect|installed)/i);
    expect(body.nextStep).toMatch(/CREATE EXTENSION pg_visibility/i);
  });
});

describe("visibility endpoint guards: input validation precedes extension use (P1-4/P1-5/P1-6)", () => {
  it("P1-4 blkno out of range → 400 BLKNO_OUT_OF_RANGE without touching pg_visibility", async () => {
    const rec = recordingPool({ exists: () => true });
    const { app } = await appWith(rec.pool);
    const res = await app.inject({ method: "GET", url: "/api/tables/16384/pages/3/visibility" });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("BLKNO_OUT_OF_RANGE");
    expect(rec.sqlLog.some((s) => /pg_visibility|pg_extension|create extension/i.test(s))).toBe(false);
  });

  it("P1-4 non-heap relation → 404 NOT_HEAP_TABLE without touching pg_visibility", async () => {
    const rec = recordingPool({
      exists: () => true,
      relationRow: { oid: "16384", relkind: "i", nspname: "public", relname: "orders", blocks: "3" },
    });
    const { app } = await appWith(rec.pool);
    const res = await app.inject({ method: "GET", url: "/api/tables/16384/pages/0/visibility" });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("NOT_HEAP_TABLE");
    expect(rec.sqlLog.some((s) => /pg_visibility|pg_extension|create extension/i.test(s))).toBe(false);
  });

  it("P1-5 zero-row pg_visibility result → 200 with all-false booleans", async () => {
    const rec = recordingPool({ exists: () => true, visibilityRow: null });
    const { app } = await appWith(rec.pool);
    const res = await app.inject({ method: "GET", url: "/api/tables/16384/pages/0/visibility" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      allVisible: false,
      allFrozen: false,
      pdAllVisible: false,
    });
  });

  it("P1-6 no VM fork (all-false row) → 200 with false allVisible/allFrozen", async () => {
    const rec = recordingPool({
      exists: () => true,
      visibilityRow: { allVisible: false, allFrozen: false, pdAllVisible: true },
    });
    const { app } = await appWith(rec.pool);
    const res = await app.inject({ method: "GET", url: "/api/tables/16384/pages/0/visibility" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      allVisible: false,
      allFrozen: false,
      pdAllVisible: true,
    });
  });
});

describe("POST /api/extensions/install (P0-7)", () => {
  it("installs a missing whitelisted extension and returns { installed: true }", async () => {
    const rec = recordingPool({ exists: (i) => i > 1 });
    const { app } = await appWith(rec.pool);
    const res = await app.inject({
      method: "POST",
      url: "/api/extensions/install",
      payload: { ext: "pg_visibility" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ installed: true, ext: "pg_visibility" });
    expect(createStatements(rec.sqlLog)).toEqual(["CREATE EXTENSION IF NOT EXISTS pg_visibility"]);
  });

  it("unknown ext → 400 BAD_REQUEST with no SQL issued", async () => {
    const rec = recordingPool({});
    const { app } = await appWith(rec.pool);
    const res = await app.inject({
      method: "POST",
      url: "/api/extensions/install",
      payload: { ext: "pg_stat_statements" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("BAD_REQUEST");
    expect(rec.sqlLog).toEqual([]);
  });

  it("install failure surfaces the extension gate error (400, not 403)", async () => {
    const rec = recordingPool({
      exists: () => false,
      onInstall: () => {
        throw pgErr("42501", "permission denied to create extension");
      },
    });
    const { app } = await appWith(rec.pool);
    const res = await app.inject({
      method: "POST",
      url: "/api/extensions/install",
      payload: { ext: "pg_visibility" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("VISIBILITY_MISSING");
  });
});
