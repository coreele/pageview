import { describe, expect, it } from "vitest";
import {
  PAGEINSPECT_NEXT,
  WALINSPECT_NEXT,
  PG_VERSION_WAL_MIN,
  parsePgMajorVersion,
  isWalPgVersionSupported,
} from "../src/session.js";

describe("extension gate messages", () => {
  it("keeps pageinspect manual-enable guidance for failed auto-install", () => {
    expect(PAGEINSPECT_NEXT).toMatch(/CREATE EXTENSION pageinspect/i);
    expect(PAGEINSPECT_NEXT).toMatch(/superuser/i);
    expect(PAGEINSPECT_NEXT).not.toMatch(/will not run CREATE EXTENSION/i);
  });

  it("documents walinspect manual-enable guidance for failed auto-install", () => {
    expect(WALINSPECT_NEXT).toMatch(/CREATE EXTENSION pg_walinspect/i);
    expect(WALINSPECT_NEXT).toMatch(/superuser/i);
    expect(WALINSPECT_NEXT).not.toMatch(/will not run CREATE EXTENSION/i);
  });
});

describe("PostgreSQL version for WAL", () => {
  it("requires major >= 15", () => {
    expect(PG_VERSION_WAL_MIN).toBe(15);
    expect(parsePgMajorVersion("PostgreSQL 14.12 on x86_64-pc-linux-gnu")).toBe(14);
    expect(parsePgMajorVersion("PostgreSQL 15.4 on x86_64")).toBe(15);
    expect(parsePgMajorVersion("PostgreSQL 16.1")).toBe(16);
    expect(isWalPgVersionSupported(14)).toBe(false);
    expect(isWalPgVersionSupported(15)).toBe(true);
  });
});
