import { sql, eq, gte, and, lt, desc } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/db";
import { transactions, invoices, inventoryItems, cashEntries, users } from "@/db/schema";
import { aiInsights } from "@/db/schema";

// Gathers a compact, human-readable text summary of the current
// financial picture — not a raw data dump — and asks Claude for a short,
// specific commentary. Kept as one function so what gets sent to the
// model is easy to audit and change without touching the API route.
async function buildFinancialSummary(): Promise<string> {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  const [thisMonthTxns, lastMonthTxns, lowStock, outstandingInvoices, cashPositions] = await Promise.all([
    db.select({ total: sql<string>`coalesce(sum(${transactions.totalAmount}), 0)`, count: sql<number>`count(*)::int` }).from(transactions).where(gte(transactions.date, thisMonthStart)),
    db
      .select({ total: sql<string>`coalesce(sum(${transactions.totalAmount}), 0)` })
      .from(transactions)
      .where(and(gte(transactions.date, lastMonthStart), lt(transactions.date, thisMonthStart))),
    db.select({ itemName: inventoryItems.itemName, currentStock: inventoryItems.currentStock, minStock: inventoryItems.minStock }).from(inventoryItems).where(sql`${inventoryItems.currentStock} <= ${inventoryItems.minStock}`),
    db
      .select({ invoiceNo: invoices.invoiceNo, clientName: invoices.clientName, totalAmount: invoices.totalAmount, dueDate: invoices.dueDate })
      .from(invoices)
      .where(eq(invoices.status, "sent")),
    db
      .select({ personName: users.name, closingBalance: cashEntries.closingBalance, date: cashEntries.date })
      .from(cashEntries)
      .innerJoin(users, eq(cashEntries.personId, users.id))
      .orderBy(desc(cashEntries.date), desc(cashEntries.id))
      .limit(50),
  ]);

  // Latest balance per person only.
  const latestByPerson = new Map<string, number>();
  for (const c of cashPositions) if (!latestByPerson.has(c.personName)) latestByPerson.set(c.personName, Number(c.closingBalance));

  const overdue = outstandingInvoices.filter((i) => i.dueDate && i.dueDate < today);
  const outstandingTotal = outstandingInvoices.reduce((s, i) => s + Number(i.totalAmount), 0);

  const lines = [
    `This month so far: ${thisMonthTxns[0]?.count ?? 0} transactions totalling ${thisMonthTxns[0]?.total ?? 0} AED.`,
    `Last month total: ${lastMonthTxns[0]?.total ?? 0} AED.`,
    `Cash on hand by person: ${Array.from(latestByPerson.entries()).map(([n, b]) => `${n}: ${b} AED`).join(", ") || "none recorded"}.`,
    `Outstanding customer invoices: ${outstandingInvoices.length}, totalling ${outstandingTotal.toFixed(2)} AED, of which ${overdue.length} are overdue.`,
    `Low-stock inventory items (at or below minimum): ${lowStock.map((i) => `${i.itemName} (${i.currentStock}/${i.minStock})`).join(", ") || "none"}.`,
  ];
  return lines.join("\n");
}

export async function generateAiInsight(): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set. Add it to your environment variables to use AI Insights.");
  }

  const summary = await buildFinancialSummary();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: process.env.AI_INSIGHTS_MODEL || "claude-sonnet-5",
    max_tokens: 600,
    messages: [
      {
        role: "user",
        content:
          "You are a financial analyst reviewing data for a small chemical manufacturing company in the UAE. " +
          "Based on the summary below, write a short, specific commentary (4-6 sentences or a short bulleted list) " +
          "highlighting what actually matters this period — real risks (overdue invoices, low stock, unusual spend " +
          "changes) and anything worth acting on. Do not restate every number back; interpret them. No generic advice.\n\n" +
          `Data:\n${summary}`,
      },
    ],
  });

  const text = response.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n");

  const period = new Date().toISOString().slice(0, 7);
  await db.insert(aiInsights).values({ period, insight: text });

  return text;
}
