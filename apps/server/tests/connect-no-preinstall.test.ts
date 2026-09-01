import { describe, expect, it, vi } from "vitest";

/**
 * P1-4 (plan task 2, optional case): POST /api/connect must not pre-install
 * extensions — connection only proves connectivity + version. Intercepts the
 * real `pg` module so every SQL statement issued on the connect path is
 * captured, proving the connect flow stays extension-agnostic.
 */

const poolInstances = vi.hoisted(() => [] as Array<{ queries: string[] }>);

vi.mock("pg", () => {
  const Pool = vi.fn().mockImplementation(() => {
    const inst = { queries: [] as string[] };
    poolInstances.push(inst);
    const client = {
      query: async (sql: string) => {
        inst.queries.push(sql);
        if (/select\s+version\(\)/i.test(sql)) {
          return { rows: [{ v: "PostgreSQL 16.1" }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      },
      release: () => {},
    };
    return {
      connect: async () => client,
      query: async (sql: string) => client.query(sql),
      end: async () => {},
    };
  });
  return { default: { Pool } };
});

import { buildApp } from "../src/app.js";

describe("POST /api/connect does not pre-install extensions (P1-4)", () => {
  it("connect succeeds with both extensions missing, issuing only SELECT version()", async () => {
    const { app } = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/connect",
      payload: { host: "h", port: 5432, database: "d", user: "u", password: "p" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().connected).toBe(true);
    expect(res.json().serverVersion).toBe("PostgreSQL 16.1");

    const inst = poolInstances[poolInstances.length - 1]!;
    expect(inst.queries).toHaveLength(1);
    expect(inst.queries[0]).toMatch(/SELECT version\(\)/i);
    expect(inst.queries.join(" ")).not.toMatch(/pg_extension|create extension/i);
  });
});
