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
  buildBtreePage,
  SPARSE_SCHEMA,
} from "./fixture-builder.js";
export type {
  BuiltBtreeTuple,
  BuildBtreePageOptions,
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
// B-tree index page module (design §4; layout frozen vs pageinspect oracle)
export {
  BTREE_MAGIC,
  BTREE_VERSION,
  BTREE_SPECIAL_SIZE,
  BTPO_PREV_OFF,
  BTPO_NEXT_OFF,
  BTPO_LEVEL_OFF,
  BTPO_FLAGS_OFF,
  BTPO_CYCLEID_OFF,
  BTREE_METAPAGE_CONTENT_OFFSET,
  BTM_MAGIC_OFF,
  BTM_VERSION_OFF,
  BTM_ROOT_OFF,
  BTM_LEVEL_OFF,
  BTM_FASTROOT_OFF,
  BTM_FASTLEVEL_OFF,
  BTM_ALLEQUALIMAGE_OFF,
  INDEX_TID_SIZE,
  INDEX_INFO_SIZE,
  INDEX_TUPLE_HEADER_SIZE,
  INDEX_SIZE_MASK,
  INDEX_ALT_TID_MASK,
  INDEX_VAR_MASK,
  INDEX_NULL_MASK,
  BT_OFFSET_MASK,
  BT_STATUS_OFFSET_MASK,
  BT_PIVOT_HEAP_TID_ATTR,
  BT_IS_POSTING,
  BTP_LEAF,
  BTP_ROOT,
  BTP_DELETED,
  BTP_META,
  BTP_HALF_DEAD,
  BTP_HAS_GARBAGE,
  BTP_INCOMPLETE_SPLIT,
  P_NONE,
  parseBtreePage,
  decodeBtpoFlags,
} from "./btree.js";
export type {
  BtreePageType,
  BtreeSpecialSpace,
  BtreeMetapage,
  BtreeIndexTuple,
  BtreePageFlags,
  BtreePageStats,
  ParsedBtreePage,
} from "./btree.js";
export { deriveBtreeStructureFields } from "./btree-structure.js";
// Index tuple key decoding (index-key-decode design §3, oracle-frozen rules)
export {
  decodeIndexTupleKeys,
  KEY_COLUMN_SPECS,
  INDEX_NULL_BITMAP_BYTES,
  INDEX_NULL_DATA_OFFSET,
  INDEX_PIVOT_HEAP_TID_BYTES,
} from "./btree-decode.js";
export type {
  IndexColumnMeta,
  DecodedKeyColumn,
  DecodedKeyColumnStatus,
} from "./btree-decode.js";
