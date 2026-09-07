import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

// This script runs standalone via `tsx`, outside of Next.js entirely —
// Next.js auto-loads .env.local for `next dev`/`build`/`start`, but that
// only applies to Next.js's own process. A plain tsx/node script never
// sees .env.local unless something explicitly loads it, which is exactly
// why this previously failed with "DATABASE_URL is not set" even right
// after `next dev` had picked it up fine.
config({ path: ".env.local" });

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  }
  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);
  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
