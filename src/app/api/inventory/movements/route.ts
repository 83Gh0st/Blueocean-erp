import { NextResponse, type NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { inventoryItems, inventoryMovements, users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { round2 } from "@/lib/money";

const MOVEMENT_TYPES = ["receipt", "consumption", "production"] as const;
type MovementType = (typeof MOVEMENT_TYPES)[number];

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const itemId = new URL(request.url).searchParams.get("itemId");

  const rows = await db
    .select({
      id: inventoryMovements.id,
      date: inventoryMovements.date,
      movementType: inventoryMovements.movementType,
      quantity: inventoryMovements.quantity,
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
    .where(itemId ? eq(inventoryMovements.itemId, Number(itemId)) : undefined)
    .orderBy(desc(inventoryMovements.date), desc(inventoryMovements.id))
    .limit(300);

  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { itemId, date, quantity, movementType, unitPrice, vatRate, notes } = body ?? {};

  if (!itemId || !date || !movementType) {
    return NextResponse.json({ error: "Item, date and movement type are required." }, { status: 400 });
  }
  if (!MOVEMENT_TYPES.includes(movementType)) {
    return NextResponse.json({ error: `Movement type must be one of: ${MOVEMENT_TYPES.join(", ")}.` }, { status: 400 });
  }
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    return NextResponse.json({ error: "Quantity must be a positive number." }, { status: 400 });
  }
  const rate = vatRate !== undefined ? Number(vatRate) : 0;
  if (!Number.isFinite(rate) || rate < 0) {
    return NextResponse.json({ error: "VAT rate must be a non-negative number." }, { status: 400 });
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [item] = await tx.select().from(inventoryItems).where(eq(inventoryItems.id, Number(itemId))).limit(1);
      if (!item) throw new Error("NOT_FOUND");

      const opening = Number(item.currentStock);
      // Receipt and Production both add to stock (goods received from a
      // supplier, or goods coming out of manufacturing); Consumption is
      // the only direction that removes stock.
      const direction: MovementType = movementType;
      const closing = direction === "consumption" ? round2(opening - qty) : round2(opening + qty);

      if (direction === "consumption" && closing < 0) {
        throw new Error(`INSUFFICIENT_STOCK:${opening}`);
      }

      const price = unitPrice !== undefined && unitPrice !== "" ? Number(unitPrice) : Number(item.unitPrice);
      const totalPrice = round2(qty * price);
      const vatAmount = round2(totalPrice * rate);
      const grandTotal = round2(totalPrice + vatAmount);

      await tx
        .update(inventoryItems)
        .set({
          currentStock: closing.toFixed(2),
          // Only a Receipt updates the item's standard cost — a
          // Production or Consumption entry doesn't represent a new
          // purchase price, so it shouldn't overwrite the valuation rate
          // everything else defaults to.
          ...(direction === "receipt" && unitPrice !== undefined && unitPrice !== "" ? { unitPrice: price.toFixed(2) } : {}),
        })
        .where(eq(inventoryItems.id, item.id));

      const [movement] = await tx
        .insert(inventoryMovements)
        .values({
          itemId: item.id,
          date,
          movementType: direction,
          quantity: qty.toFixed(2),
          openingStock: opening.toFixed(2),
          closingStock: closing.toFixed(2),
          unitPrice: price.toFixed(2),
          totalPrice: totalPrice.toFixed(2),
          vatAmount: vatAmount.toFixed(2),
          grandTotal: grandTotal.toFixed(2),
          notes: notes ?? "",
          createdBy: user.id,
        })
        .returning();

      return movement;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Item not found." }, { status: 404 });
    }
    if (err instanceof Error && err.message.startsWith("INSUFFICIENT_STOCK:")) {
      const available = err.message.split(":")[1];
      return NextResponse.json({ error: `Not enough stock — only ${available} available.` }, { status: 400 });
    }
    throw err;
  }
}
