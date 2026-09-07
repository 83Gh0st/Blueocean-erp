import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { departments, expenseHeads, paymentModes, transactions, users } from "@/db/schema";
import { requireUser } from "@/lib/require-user";
import TransactionsManager from "@/components/TransactionsManager";

export default async function TransactionsPage() {
  const user = await requireUser();
  const [depts, heads, modes, txns] = await Promise.all([
    db.select().from(departments).where(eq(departments.isActive, true)).orderBy(departments.name),
    db.select().from(expenseHeads).where(eq(expenseHeads.isActive, true)).orderBy(expenseHeads.name),
    db.select().from(paymentModes).where(eq(paymentModes.isActive, true)).orderBy(paymentModes.name),
    db
      .select({
        id: transactions.id,
        date: transactions.date,
        description: transactions.description,
        invoiceNo: transactions.invoiceNo,
        trn: transactions.trn,
        baseAmount: transactions.baseAmount,
        vatAmount: transactions.vatAmount,
        totalAmount: transactions.totalAmount,
        departmentId: transactions.departmentId,
        departmentName: departments.name,
        expenseHeadId: transactions.expenseHeadId,
        expenseHeadName: expenseHeads.name,
        paymentModeId: transactions.paymentModeId,
        paymentModeName: paymentModes.name,
        personId: transactions.personId,
        personName: users.name,
      })
      .from(transactions)
      .innerJoin(departments, eq(transactions.departmentId, departments.id))
      .innerJoin(expenseHeads, eq(transactions.expenseHeadId, expenseHeads.id))
      .innerJoin(paymentModes, eq(transactions.paymentModeId, paymentModes.id))
      .innerJoin(users, eq(transactions.personId, users.id))
      .orderBy(desc(transactions.date), desc(transactions.id))
      .limit(500),
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Transactions</h1>
          <p>Expense entries with automatic 5% VAT. Every entry is attributed to whoever's signed in when it's created.</p>
        </div>
      </div>
      <TransactionsManager
        departments={depts}
        expenseHeads={heads}
        paymentModes={modes}
        initialTransactions={txns}
        currentUserRole={user.role}
      />
    </>
  );
}
