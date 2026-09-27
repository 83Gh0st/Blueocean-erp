import { and, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { purchaseOrders } from "@/db/schema";

/** PO-YYYYMM-XXXX, same pattern as invoice numbering — sequence resets each month. */
export async function nextPoNumber(): Promise<string> {
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(purchaseOrders)
    .where(and(gte(purchaseOrders.createdAt, monthStart), lt(purchaseOrders.createdAt, nextMonthStart)));

  const count = rows[0]?.count ?? 0;
  return `PO-${yyyymm}-${String(count + 1).padStart(4, "0")}`;
}
