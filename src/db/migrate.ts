import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

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
  // max: 1 — migrations run as a strict sequence of DDL statements; a
  // single connection avoids any chance of two of them racing over a
  // pooled connection.
  const client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
  const db = drizzle(client);
  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  await client.end();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
