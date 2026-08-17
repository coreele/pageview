export type { ByteRange, ColumnMeta, DecodedColumn, FlagBit, HeapTuple, ItemId, PageStats, ParsedPage } from "./types.js";
export {
  annotateCtidBlocks,
  parsePage,
  PageParseError,
  STANDARD_PAGE_SIZE,
  PAGE_HEADER_SIZE,
} from "./parse.js";
export { decodeInfomask, decodeInfomask2, decodeItemIdFlags, decodePdFlags } from "./flags.js";
export { decodePageTuples, decodeTupleColumns } from "./decode.js";
export {
  buildSparsePage,
  buildEmptyishPage,
  SPARSE_SCHEMA,
} from "./fixture-builder.js";
export type {
  StructureField,
  StructureFieldRegion,
  RowSegment,
  CellMetrics,
  CellContentChoice,
} from "./structure-fields.js";
export {
  STRUCTURE_BYTES_PER_ROW,
  deriveStructureFields,
  resolveFieldAt,
  splitFieldIntoRowSegments,
  selectionTargetForField,
  cellCapacityChars,
  chooseCellContent,
  computeHexScrollTarget,
} from "./structure-fields.js";
