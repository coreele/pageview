export type PublicSession = {
  connected: boolean;
  host: string | null;
  port: number | null;
  database: string | null;
  user: string | null;
  serverVersion: string | null;
  error?: { code: string; message: string; nextStep: string } | null;
};

export type AppError = { code: string; message: string; nextStep: string };

export type TableRow = {
  oid: number;
  schema: string;
  name: string;
  qualifiedName: string;
  blocks: number;
};

export type SchemaResponse = {
  oid: number;
  schema: string;
  name: string;
  qualifiedName: string;
  columns: Array<{
    attnum: number;
    name: string;
    typname: string;
    typlen: number;
    attlen: number;
    attalign: string;
    attisdropped: boolean;
    typoid: number;
  }>;
};

export type WalRecordDto = {
  startLsn: string;
  endLsn: string | null;
  prevLsn: string | null;
  xid: string | null;
  resourceManager: string;
  recordType: string;
  recordLength: number;
  mainDataLength: number | null;
  fpiLength: number;
  description: string | null;
  blockRef: string | null;
};

async function parseError(res: Response): Promise<AppError> {
  try {
    const body = (await res.json()) as AppError;
    if (body?.message) return body;
  } catch {
    /* fall through */
  }
  return {
    code: "HTTP_" + res.status,
    message: `Request failed (${res.status})`,
    nextStep: "Check the server is running on 127.0.0.1 and retry.",
  };
}

export async function getSession(): Promise<PublicSession> {
  const res = await fetch("/api/session");
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function connect(body: Record<string, unknown>): Promise<PublicSession> {
  const res = await fetch("/api/connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function listTables(): Promise<TableRow[]> {
  const res = await fetch("/api/tables");
  if (!res.ok) throw await parseError(res);
  const data = await res.json();
  return data.tables;
}

export async function fetchSchema(oid: number): Promise<SchemaResponse> {
  const res = await fetch(`/api/tables/${oid}/schema`);
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function fetchPage(
  oid: number,
  blkno: number,
): Promise<{ pageBase64: string; byteLength: number; qualifiedName: string; blkno: number }> {
  const res = await fetch(`/api/tables/${oid}/pages/${blkno}`);
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function fetchCurrentWalLsn(): Promise<string> {
  const res = await fetch("/api/wal/current-lsn");
  if (!res.ok) throw await parseError(res);
  const data = (await res.json()) as { lsn: string };
  return data.lsn;
}

export async function fetchRecentWalWindow(
  limit = 20,
): Promise<{ startLsn: string; endLsn: string; count: number }> {
  const qs = new URLSearchParams({ limit: String(limit) });
  const res = await fetch(`/api/wal/recent-window?${qs}`);
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function fetchWalRecords(
  startLsn: string,
  endLsn: string,
): Promise<{ records: WalRecordDto[]; startLsn: string; endLsn: string; count: number }> {
  const qs = new URLSearchParams({ startLsn, endLsn });
  const res = await fetch(`/api/wal/records?${qs}`);
  if (!res.ok) throw await parseError(res);
  return res.json();
}
