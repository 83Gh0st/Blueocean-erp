import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { purchaseOrders, purchaseOrderItems, inventoryItems, inventoryMovements } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { round2 } from "@/lib/money";

type ReceiveLine = { poItemId: number; quantityReceived: number };

/**
 * Recording a delivery against a PO. This is the one place Procurement
 * and Inventory actually meet: a line that's linked to a tracked
 * inventory item gets a real Receipt movement out of this, at the PO
 * line's own price — not a separate manual inventory entry someone has
 * to remember to make and keep in sync by hand.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const poId = Number(id);
  const body = await request.json().catch(() => null);
  const lines = body?.lines as ReceiveLine[] | undefined;

  if (!Array.isArray(lines) || lines.length === 0) {
    return NextResponse.json({ error: "At least one line with a received quantity is required." }, { status: 400 });
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [po] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId)).limit(1);
      if (!po) throw new Error("NOT_FOUND");
      if (po.status === "received" || po.status === "cancelled") {
        throw new Error(`BAD_STATUS:${po.status}`);
      }

      const existingItems = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.poId, poId));
      const itemById = new Map(existingItems.map((it) => [it.id, it]));

      for (const line of lines) {
        const poItem = itemById.get(line.poItemId);
        if (!poItem) throw new Error("LINE_NOT_FOUND");

        const qty = Number(line.quantityReceived);
        if (!Number.isFinite(qty) || qty <= 0) continue; // skip lines left at 0 — not every line has to be received in one shipment

        const remaining = round2(Number(poItem.quantityOrdered) - Number(poItem.quantityReceived));
        if (qty > remaining) {
          throw new Error(`OVER_RECEIPT:${poItem.description}:${remaining}`);
        }

        await tx
          .update(purchaseOrderItems)
          .set({ quantityReceived: round2(Number(poItem.quantityReceived) + qty).toFixed(2) })
          .where(eq(purchaseOrderItems.id, poItem.id));

        // Only lines linked to a tracked inventory item create a stock
        // movement — a PO line for a one-off service has nothing to
        // receive into inventory.
        if (poItem.itemId) {
          const [invItem] = await tx.select().from(inventoryItems).where(eq(inventoryItems.id, poItem.itemId)).limit(1);
          if (invItem) {
            const opening = Number(invItem.currentStock);
            const closing = round2(opening + qty);
            const price = Number(poItem.unitPrice);
            const totalPrice = round2(qty * price);
            const vatAmount = round2(totalPrice * Number(poItem.vatRate));

            await tx
              .update(inventoryItems)
              .set({ currentStock: closing.toFixed(2), unitPrice: price.toFixed(2) })
              .where(eq(inventoryItems.id, invItem.id));

            await tx.insert(inventoryMovements).values({
              itemId: invItem.id,
              date: new Date().toISOString().slice(0, 10),
              movementType: "receipt",
              quantity: qty.toFixed(2),
              openingStock: opening.toFixed(2),
              closingStock: closing.toFixed(2),
              unitPrice: price.toFixed(2),
              totalPrice: totalPrice.toFixed(2),
              vatAmount: vatAmount.toFixed(2),
              grandTotal: round2(totalPrice + vatAmount).toFixed(2),
              notes: `Received against ${po.poNumber}`,
              createdBy: user.id,
            });
          }
        }
      }

      const refreshedItems = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.poId, poId));
      const allReceived = refreshedItems.every((it) => Number(it.quantityReceived) >= Number(it.quantityOrdered));
      const anyReceived = refreshedItems.some((it) => Number(it.quantityReceived) > 0);
      const newStatus = allReceived ? "received" : anyReceived ? "partially_received" : po.status;

      const [updatedPo] = await tx.update(purchaseOrders).set({ status: newStatus }).where(eq(purchaseOrders.id, poId)).returning();
      return updatedPo;
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") return NextResponse.json({ error: "Purchase order not found." }, { status: 404 });
    if (err instanceof Error && err.message === "LINE_NOT_FOUND") return NextResponse.json({ error: "One of the line items doesn't belong to this PO." }, { status: 400 });
    if (err instanceof Error && err.message.startsWith("BAD_STATUS:")) {
      return NextResponse.json({ error: `This PO is already ${err.message.split(":")[1]} — nothing left to receive.` }, { status: 400 });
    }
    if (err instanceof Error && err.message.startsWith("OVER_RECEIPT:")) {
      const [, desc, remaining] = err.message.split(":");
      return NextResponse.json({ error: `Can't receive more than ordered for "${desc}" — ${remaining} remaining.` }, { status: 400 });
    }
    throw err;
  }
}
