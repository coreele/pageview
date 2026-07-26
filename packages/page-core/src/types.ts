export type ByteRange = { start: number; end: number };

export type LpStatus = "UNUSED" | "NORMAL" | "REDIRECT" | "DEAD";

export type ItemId = {
  index: number;
  offset: number;
  length: number;
  flags: number;
  status: LpStatus;
  range: ByteRange;
  /** For REDIRECT: offset number of redirect target within page */
  redirectOffset?: number;
};

export type PageHeader = {
  pd_lsn: string;
  pd_checksum: number;
  pd_flags: number;
  pd_lower: number;
  pd_upper: number;
  pd_special: number;
  pd_pagesize_version: number;
  pageSize: number;
  pageVersion: number;
  pd_prune_xid: number;
  range: ByteRange;
};

export type ItemPointer = {
  blockNumber: number;
  offsetNumber: number;
};

export type HeapTupleHeader = {
  t_xmin: number;
  t_xmax: number;
  t_cid: number;
  t_ctid: ItemPointer;
  t_infomask: number;
  t_infomask2: number;
  t_hoff: number;
  natts: number;
  range: ByteRange;
};

export type DecodedColumn = {
  attnum: number;
  name: string;
  typeName: string;
  dropped: boolean;
  null: boolean;
  value: unknown;
  display: string;
  rawHex?: string;
  toasted?: boolean;
  range?: ByteRange;
};

export type HeapTuple = {
  itemIndex: number;
  range: ByteRange;
  header: HeapTupleHeader;
  dataRange: ByteRange;
  columns?: DecodedColumn[];
  hotUpdated: boolean;
  heapOnlyTuple: boolean;
  ctidCrossBlock: boolean;
};

export type PageStats = {
  pageSize: number;
  pd_lower: number;
  pd_upper: number;
  freeBytes: number;
  itemIdTotal: number;
  lpUnused: number;
  lpNormal: number;
  lpRedirect: number;
  lpDead: number;
  tupleCount: number;
};

export type ParsedPage = {
  header: PageHeader;
  itemIds: ItemId[];
  freeSpace: { range: ByteRange; bytes: number };
  tuples: HeapTuple[];
  stats: PageStats;
  raw: Uint8Array;
};

export type ColumnMeta = {
  attnum: number;
  name: string;
  typname: string;
  typlen: number;
  attlen: number;
  attalign: string;
  attisdropped: boolean;
  typoid?: number;
};

export type FlagBit = {
  bit: number;
  name: string;
  set: boolean;
  meaning: string;
};
