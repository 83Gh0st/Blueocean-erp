import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. See .env.example.");
}

// neon-http (not the websocket/pool driver): this app's queries are all
// short, independent requests from serverless functions, not long-lived
// connections or multi-statement transactions that need a persistent
// socket — the HTTP driver is the right fit for that and is what Neon's
// own docs recommend for Vercel deployments.
const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });
