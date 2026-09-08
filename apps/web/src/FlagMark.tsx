export function flagMarkClass(set: boolean): string {
  return set ? "flag-mark flag-mark--set" : "flag-mark flag-mark--unset";
}

/** Shared set/unset disc for flag lists (ItemId, t_info, bit-strip reference). */
export function FlagMark({ set }: { set: boolean }) {
  return <span className={flagMarkClass(set)} aria-hidden="true" />;
}
