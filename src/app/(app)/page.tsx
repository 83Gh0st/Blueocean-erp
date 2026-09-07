import { and, desc, eq, gte, sql } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { transactions, cashEntries, users, departments } from "@/db/schema";
import { requireUser } from "@/lib/require-user";
import { formatMoney } from "@/lib/money";

export default async function DashboardPage() {
  const user = await requireUser();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  const [monthTxns, recentTxns, latestCashByPerson] = await Promise.all([
    db
      .select({ totalAmount: transactions.totalAmount })
      .from(transactions)
      .where(gte(transactions.date, monthStart)),
    db
      .select({
        id: transactions.id,
        date: transactions.date,
        description: transactions.description,
        totalAmount: transactions.totalAmount,
        departmentName: departments.name,
        personName: users.name,
      })
      .from(transactions)
      .innerJoin(departments, eq(transactions.departmentId, departments.id))
      .innerJoin(users, eq(transactions.personId, users.id))
      .orderBy(desc(transactions.date), desc(transactions.id))
      .limit(8),
    db
      .select({
        personId: cashEntries.personId,
        personName: users.name,
        closingBalance: cashEntries.closingBalance,
        date: cashEntries.date,
      })
      .from(cashEntries)
      .innerJoin(users, eq(cashEntries.personId, users.id))
      .orderBy(desc(cashEntries.date), desc(cashEntries.id))
      .limit(50),
  ]);

  const monthTotal = monthTxns.reduce((sum, t) => sum + Number(t.totalAmount), 0);

  const balanceByPerson = new Map<number, { name: string; balance: number }>();
  for (const c of latestCashByPerson) {
    if (!balanceByPerson.has(c.personId)) balanceByPerson.set(c.personId, { name: c.personName, balance: Number(c.closingBalance) });
  }
  const totalCash = Array.from(balanceByPerson.values()).reduce((sum, b) => sum + b.balance, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Welcome back, {user.name.split(" ")[0]}</h1>
          <p>A quick look at where things stand.</p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card-label">Spent this month</div>
          <div className="stat-card-value">{formatMoney(monthTotal)} AED</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Transactions this month</div>
          <div className="stat-card-value">{monthTxns.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Total cash on hand</div>
          <div className={`stat-card-value ${totalCash < 0 ? "neg" : ""}`}>{formatMoney(totalCash)} AED</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Recent transactions</h2>
          <Link href="/transactions" className="btn btn-secondary btn-sm">
            View all
          </Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Department</th>
                <th>By</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {recentTxns.map((t) => (
                <tr key={t.id}>
                  <td>{t.date}</td>
                  <td style={{ whiteSpace: "normal", minWidth: 180 }}>{t.description}</td>
                  <td>{t.departmentName}</td>
                  <td>{t.personName}</td>
                  <td className="num">{formatMoney(t.totalAmount)}</td>
                </tr>
              ))}
              {recentTxns.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-state">
                    No transactions logged yet.{" "}
                    <Link href="/transactions" style={{ color: "var(--sky)" }}>
                      Add the first one
                    </Link>
                    .
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
