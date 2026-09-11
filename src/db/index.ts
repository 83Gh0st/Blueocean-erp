import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. See .env.example.");
}

// postgres-js over Neon's pooled connection, not the neon-http driver:
// invoices (header + line items) and inventory movements (stock update +
// movement row) both need real db.transaction() support so a failure
// partway through can't leave, say, an invoice with no line items or a
// stock count that's out of sync with its movement log. neon-http is a
// stateless one-request-at-a-time HTTP client — there's no persistent
// connection for a multi-statement transaction to live on, which is why
// db.transaction() threw "No transactions support in neon-http driver"
// rather than actually running the two inserts atomically.
//
// { prepare: false } is required specifically because DATABASE_URL should
// point at Neon's *pooled* connection string (the one with "-pooler" in
// the hostname) — that pool runs in PgBouncer transaction mode, which
// doesn't support prepared statements persisting across queries.
const client = postgres(process.env.DATABASE_URL, { prepare: false });
export const db = drizzle(client, { schema });
