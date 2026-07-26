import { config } from "dotenv";
import { resolve } from "node:path";
import { emptySession } from "./session.js";
import { buildApp, tryAutoConnectFromEnv } from "./app.js";

// Load root .env if present (keys only in example; real values stay local)
config({ path: resolve(process.cwd(), "../../.env") });
config();

const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 8787);

const session = emptySession();
await tryAutoConnectFromEnv(session);

const { app } = await buildApp(session);
await app.listen({ host, port });
app.log.info(`Listening on http://${host}:${port}`);
