import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";

const repoRoot = process.cwd();

function withoutProxy(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const next: NodeJS.ProcessEnv = { ...env, NO_PROXY: "*" };
  for (const key of ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy", "ALL_PROXY", "all_proxy"]) {
    delete next[key];
  }
  return next;
}

const M3_SERVER = "http://127.0.0.1:8790";
const M3_PREVIEW = "http://127.0.0.1:4174";

async function waitFor(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  let last = "";
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
      last = `HTTP ${res.status}`;
    } catch (e) {
      last = e instanceof Error ? e.message : String(e);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`E2E blocked: timeout waiting for ${url} (${last})`);
}

function killTree(child: ChildProcess): Promise<void> {
  return new Promise((resolveExit) => {
    if (child.exitCode != null || child.signalCode != null) {
      resolveExit();
      return;
    }
    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* already gone */
      }
    }, 3000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolveExit();
    });
    try {
      child.kill("SIGTERM");
    } catch {
      clearTimeout(timer);
      resolveExit();
    }
  });
}

export type M3Stack = {
  baseURL: string;
  stop: () => Promise<void>;
};

export async function startM3Stack(): Promise<M3Stack> {
  const sanitized = {
    ...process.env,
    DATABASE_URL: "",
    PGHOST: "",
    PGDATABASE: "",
    PGUSER: "",
    PGPASSWORD: "",
    PORT: "8790",
    HOST: "127.0.0.1",
  };
  const server = spawn("node", ["dist/index.js"], {
    cwd: resolve(repoRoot, "apps/server"),
    env: withoutProxy(sanitized),
    stdio: ["ignore", "pipe", "pipe"],
  });
  const preview = spawn(
    "pnpm",
    ["exec", "vite", "preview", "--host", "127.0.0.1", "--port", "4174", "--strictPort"],
    {
      cwd: resolve(repoRoot, "apps/web"),
      env: withoutProxy({ ...process.env, PAGEVIEW_API_TARGET: M3_SERVER }),
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const stop = async () => {
    await Promise.all([killTree(server), killTree(preview)]);
  };

  try {
    await waitFor(`${M3_SERVER}/api/session`, 30_000);
    await waitFor(`${M3_PREVIEW}/`, 30_000);
  } catch (e) {
    await stop();
    throw e;
  }
  return { baseURL: M3_PREVIEW, stop };
}
