import { sql, eq, gte, and, lt } from "drizzle-orm";
import { db } from "@/db";
import { transactions, expenseHeads, invoices, purchaseOrders, inventoryItems } from "@/db/schema";
import { formatMoney } from "@/lib/money";
import MonthlyTrendChart from "@/components/MonthlyTrendChart";

export default async function ReportsPage() {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);
  const rangeStart = twelveMonthsAgo.toISOString().slice(0, 10);

  const today = new Date().toISOString().slice(0, 10);

  const [
    monthlyExpenses,
    monthlyRevenue,
    topExpenseHeads,
    outstandingInvoices,
    inventoryValuation,
    outputVat,
    inputVatTransactions,
    inputVatPurchases,
  ] = await Promise.all([
    db
      .select({ month: sql<string>`to_char(date_trunc('month', ${transactions.date}), 'YYYY-MM')`, total: sql<string>`sum(${transactions.totalAmount})` })
      .from(transactions)
      .where(gte(transactions.date, rangeStart))
      .groupBy(sql`1`)
      .orderBy(sql`1`),
    db
      .select({ month: sql<string>`to_char(date_trunc('month', ${invoices.date}), 'YYYY-MM')`, total: sql<string>`sum(${invoices.totalAmount})` })
      .from(invoices)
      .where(and(gte(invoices.date, rangeStart), sql`${invoices.status} in ('sent','paid')`))
      .groupBy(sql`1`)
      .orderBy(sql`1`),
    db
      .select({ name: expenseHeads.name, total: sql<string>`sum(${transactions.totalAmount})` })
      .from(transactions)
      .innerJoin(expenseHeads, eq(transactions.expenseHeadId, expenseHeads.id))
      .where(gte(transactions.date, rangeStart))
      .groupBy(expenseHeads.name)
      .orderBy(sql`sum(${transactions.totalAmount}) desc`)
      .limit(8),
    db
      .select({ id: invoices.id, invoiceNo: invoices.invoiceNo, clientName: invoices.clientName, dueDate: invoices.dueDate, totalAmount: invoices.totalAmount })
      .from(invoices)
      .where(eq(invoices.status, "sent"))
      .orderBy(invoices.dueDate),
    db
      .select({ totalValue: sql<string>`coalesce(sum(${inventoryItems.currentStock} * ${inventoryItems.unitPrice}), 0)` })
      .from(inventoryItems),
    db.select({ total: sql<string>`coalesce(sum(${invoices.vatAmount}), 0)` }).from(invoices).where(and(gte(invoices.date, rangeStart), sql`${invoices.status} in ('sent','paid')`)),
    db.select({ total: sql<string>`coalesce(sum(${transactions.vatAmount}), 0)` }).from(transactions).where(gte(transactions.date, rangeStart)),
    db.select({ total: sql<string>`coalesce(sum(${purchaseOrders.vatAmount}), 0)` }).from(purchaseOrders).where(and(gte(purchaseOrders.date, rangeStart), sql`${purchaseOrders.status} != 'cancelled'`)),
  ]);

  // Build a full 12-month series (months with no activity show as 0, not missing).
  const monthKeys: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(twelveMonthsAgo);
    d.setMonth(d.getMonth() + i);
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const expenseByMonth = new Map(monthlyExpenses.map((r) => [r.month, Number(r.total)]));
  const revenueByMonth = new Map(monthlyRevenue.map((r) => [r.month, Number(r.total)]));
  const trend = monthKeys.map((m) => ({ month: m, expenses: expenseByMonth.get(m) ?? 0, revenue: revenueByMonth.get(m) ?? 0 }));

  const outVat = Number(outputVat[0]?.total ?? 0);
  const inVatTxn = Number(inputVatTransactions[0]?.total ?? 0);
  const inVatPo = Number(inputVatPurchases[0]?.total ?? 0);
  const netVat = outVat - inVatTxn - inVatPo;

  const overdueCount = outstandingInvoices.filter((inv) => inv.dueDate && inv.dueDate < today).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reports &amp; Analytics</h1>
          <p>Last 12 months. Figures pull directly from Transactions, Billing, Procurement and Inventory — nothing here is entered separately.</p>
        </div>
        <a className="btn btn-secondary btn-sm" href="/api/reports/transactions-export">
          Export transactions (Excel)
        </a>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card-label">Output VAT (sales)</div>
          <div className="stat-card-value">{formatMoney(outVat)} AED</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Input VAT (expenses + purchases)</div>
          <div className="stat-card-value">{formatMoney(inVatTxn + inVatPo)} AED</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Net VAT position</div>
          <div className={`stat-card-value ${netVat < 0 ? "neg" : ""}`}>{formatMoney(netVat)} AED</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Inventory value on hand</div>
          <div className="stat-card-value">{formatMoney(inventoryValuation[0]?.totalValue ?? 0)} AED</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Revenue vs. expenses, last 12 months</h2>
        </div>
        <MonthlyTrendChart data={trend} />
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Top expense categories</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Expense head</th>
                <th className="num">Total (last 12 months)</th>
              </tr>
            </thead>
            <tbody>
              {topExpenseHeads.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td className="num">{formatMoney(row.total)}</td>
                </tr>
              ))}
              {topExpenseHeads.length === 0 && (
                <tr>
                  <td colSpan={2} className="empty-state">
                    No expenses logged in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Outstanding invoices</h2>
          {overdueCount > 0 && <span className="badge" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>{overdueCount} overdue</span>}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Invoice No.</th>
                <th>Client</th>
                <th>Due Date</th>
                <th className="num">Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {outstandingInvoices.map((inv) => {
                const overdue = !!inv.dueDate && inv.dueDate < today;
                return (
                  <tr key={inv.id}>
                    <td>{inv.invoiceNo}</td>
                    <td>{inv.clientName}</td>
                    <td>{inv.dueDate ?? "—"}</td>
                    <td className="num">{formatMoney(inv.totalAmount)}</td>
                    <td>
                      <span className="badge" style={overdue ? { background: "var(--danger-bg)", color: "var(--danger)" } : { background: "var(--warn-bg)", color: "var(--warn)" }}>
                        {overdue ? "Overdue" : "Awaiting payment"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {outstandingInvoices.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-state">
                    Nothing outstanding.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
