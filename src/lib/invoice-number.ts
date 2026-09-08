import { and, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { invoices } from "@/db/schema";

/**
 * INV-YYYYMM-XXXX, sequence reset each calendar month — same pattern as
 * the reference app. The sequence is "how many invoices already exist
 * this month, plus one," not a separately tracked counter, so it can
 * never drift out of sync with what's actually in the table.
 */
export async function nextInvoiceNumber(): Promise<string> {
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(invoices)
    .where(and(gte(invoices.createdAt, monthStart), lt(invoices.createdAt, nextMonthStart)));

  const count = rows[0]?.count ?? 0;
  return `INV-${yyyymm}-${String(count + 1).padStart(4, "0")}`;
}
