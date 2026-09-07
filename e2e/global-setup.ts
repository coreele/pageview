import { seedDatabase } from "./helpers/db.ts";

export default async function globalSetup(): Promise<void> {
  try {
    await seedDatabase();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(msg.startsWith("E2E blocked:") ? msg : `E2E blocked: ${msg}`);
    process.exit(1);
  }
}
