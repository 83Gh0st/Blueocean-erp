import { desc } from "drizzle-orm";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { requireUser } from "@/lib/require-user";
import BillingManager from "@/components/BillingManager";

export default async function BillingPage() {
  const user = await requireUser();
  const rows = await db.select().from(invoices).orderBy(desc(invoices.date), desc(invoices.id));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Billing</h1>
          <p>Customer invoices — draft, send, and track payment status. Every invoice gets a real UAE tax-invoice PDF.</p>
        </div>
      </div>
      <BillingManager initialInvoices={rows} currentUserRole={user.role} />
    </>
  );
}
