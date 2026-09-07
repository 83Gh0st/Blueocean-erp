import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Explicit, not relying on drizzle-kit's own default .env auto-loading:
// that default looks for a file literally named .env, but this project
// (matching Next.js convention) uses .env.local — relying on the
// implicit behavior of a different, undocumented filename is exactly
// the kind of mismatch that caused DATABASE_URL to silently not be
// picked up before.
config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
