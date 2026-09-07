import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { departments, paymentModes, expenseHeads } from "@/db/schema";
import MasterDataManager from "@/components/MasterDataManager";

export default async function MasterDataPage() {
  const [depts, modes, heads] = await Promise.all([
    db.select().from(departments).orderBy(desc(departments.isActive), departments.name),
    db.select().from(paymentModes).orderBy(desc(paymentModes.isActive), paymentModes.name),
    db
      .select({
        id: expenseHeads.id,
        name: expenseHeads.name,
        isActive: expenseHeads.isActive,
        departmentId: expenseHeads.departmentId,
        departmentName: departments.name,
      })
      .from(expenseHeads)
      .innerJoin(departments, eq(expenseHeads.departmentId, departments.id))
      .orderBy(desc(expenseHeads.isActive), expenseHeads.name),
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Master Data</h1>
          <p>
            Reference lists used across transactions and cash entries. Deactivating something hides it from new
            entries without touching existing records that already reference it.
          </p>
        </div>
      </div>
      <MasterDataManager
        initialDepartments={depts}
        initialPaymentModes={modes}
        initialExpenseHeads={heads}
      />
    </>
  );
}
