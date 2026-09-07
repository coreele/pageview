import { dropSeed } from "./helpers/db.ts";

export default async function globalTeardown(): Promise<void> {
  await dropSeed();
}
