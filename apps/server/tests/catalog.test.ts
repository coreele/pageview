import { describe, expect, it } from "vitest";
import {
  LIST_TABLES_SQL,
  PAGE_RELATION_SQL,
  SCHEMA_COLUMNS_SQL,
  mapSchemaColumnRow,
  relationBlocksFromSize,
} from "../src/catalog.js";

describe("catalog SQL contracts", () => {
  it("schema query LEFT JOINs pg_type so attisdropped rows are kept", () => {
    const sql = SCHEMA_COLUMNS_SQL.replace(/\s+/g, " ").toLowerCase();
    expect(sql).toContain("left join pg_type");
    // No bare INNER JOIN on atttypid (atttypid=0 rows would vanish).
    expect(sql.replaceAll("left join pg_type", "")).not.toMatch(/\bjoin pg_type\b/);
  });

  it("table list and page bounds use on-disk relation size, not stale relpages", () => {
    expect(LIST_TABLES_SQL.toLowerCase()).toContain("pg_relation_size");
    expect(LIST_TABLES_SQL.toLowerCase()).not.toContain("relpages");
    expect(PAGE_RELATION_SQL.toLowerCase()).toContain("pg_relation_size");
    expect(PAGE_RELATION_SQL.toLowerCase()).not.toContain("relpages");
  });

  it("maps dropped columns with null typoid as placeholders", () => {
    const col = mapSchemaColumnRow({
      attnum: 2,
      name: "........pg.dropped.2........",
      typname: null,
      attlen: -1,
      attalign: "i",
      attisdropped: true,
      typoid: null,
    });
    expect(col.attisdropped).toBe(true);
    expect(col.typoid).toBe(0);
    expect(col.typname).toBe("dropped");
  });

  it("computes block count from byte size", () => {
    expect(relationBlocksFromSize(0)).toBe(0);
    expect(relationBlocksFromSize(8192)).toBe(1);
    expect(relationBlocksFromSize(16384)).toBe(2);
  });
});
