import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { inventoryItems, inventoryMovements, users } from "@/db/schema";
import InventoryManager from "@/components/InventoryManager";

export default async function InventoryPage() {
  const [items, movements] = await Promise.all([
    db.select().from(inventoryItems).orderBy(asc(inventoryItems.itemName)),
    db
      .select({
        id: inventoryMovements.id,
        date: inventoryMovements.date,
        quantity: inventoryMovements.quantity,
        movementType: inventoryMovements.movementType,
        openingStock: inventoryMovements.openingStock,
        closingStock: inventoryMovements.closingStock,
        unitPrice: inventoryMovements.unitPrice,
        totalPrice: inventoryMovements.totalPrice,
        vatAmount: inventoryMovements.vatAmount,
        grandTotal: inventoryMovements.grandTotal,
        notes: inventoryMovements.notes,
        itemId: inventoryMovements.itemId,
        itemName: inventoryItems.itemName,
        unit: inventoryItems.unit,
        createdByName: users.name,
      })
      .from(inventoryMovements)
      .innerJoin(inventoryItems, eq(inventoryMovements.itemId, inventoryItems.id))
      .leftJoin(users, eq(inventoryMovements.createdBy, users.id))
      .orderBy(desc(inventoryMovements.date), desc(inventoryMovements.id))
      .limit(200),
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Inventory</h1>
          <p>Raw materials and finished goods across all six product lines. Stock updates automatically as you log movements.</p>
        </div>
      </div>
      <InventoryManager initialItems={items} initialMovements={movements} />
    </>
  );
}
