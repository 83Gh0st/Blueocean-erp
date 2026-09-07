import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { cashEntries, users } from "@/db/schema";
import CashLedgerManager from "@/components/CashLedgerManager";

export default async function CashLedgerPage() {
  const [staff, entries] = await Promise.all([
    db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.isActive, true))
      .orderBy(users.name),
    db
      .select({
        id: cashEntries.id,
        date: cashEntries.date,
        openingBalance: cashEntries.openingBalance,
        received: cashEntries.received,
        spent: cashEntries.spent,
        closingBalance: cashEntries.closingBalance,
        description: cashEntries.description,
        personId: cashEntries.personId,
        personName: users.name,
      })
      .from(cashEntries)
      .innerJoin(users, eq(cashEntries.personId, users.id))
      .orderBy(desc(cashEntries.date), desc(cashEntries.id))
      .limit(500),
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Cash Ledger</h1>
          <p>Running cash balance per person. Opening balance carries forward automatically from each person's last entry.</p>
        </div>
      </div>
      <CashLedgerManager staff={staff} initialEntries={entries} />
    </>
  );
}
