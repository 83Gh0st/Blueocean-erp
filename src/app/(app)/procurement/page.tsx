import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { suppliers, purchaseOrders, inventoryItems } from "@/db/schema";
import { requireUser } from "@/lib/require-user";
import ProcurementManager from "@/components/ProcurementManager";

export default async function ProcurementPage() {
  const user = await requireUser();
  const [supplierRows, poRows, items] = await Promise.all([
    db.select().from(suppliers).orderBy(desc(suppliers.isActive), suppliers.name),
    db
      .select({
        id: purchaseOrders.id,
        poNumber: purchaseOrders.poNumber,
        date: purchaseOrders.date,
        expectedDate: purchaseOrders.expectedDate,
        status: purchaseOrders.status,
        totalAmount: purchaseOrders.totalAmount,
        supplierId: purchaseOrders.supplierId,
        supplierName: suppliers.name,
      })
      .from(purchaseOrders)
      .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .orderBy(desc(purchaseOrders.date), desc(purchaseOrders.id)),
    db.select().from(inventoryItems).orderBy(asc(inventoryItems.itemName)),
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Procurement</h1>
          <p>Suppliers and purchase orders. Receiving a PO line linked to a tracked inventory item creates the stock receipt automatically.</p>
        </div>
      </div>
      <ProcurementManager suppliers={supplierRows} initialPurchaseOrders={poRows} inventoryItems={items} currentUserRole={user.role} />
    </>
  );
}
