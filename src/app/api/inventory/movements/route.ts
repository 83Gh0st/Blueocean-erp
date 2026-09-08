import { NextResponse, type NextRequest } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { inventoryItems, inventoryMovements, users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const itemId = new URL(request.url).searchParams.get("itemId");

  const rows = await db
    .select({
      id: inventoryMovements.id,
      date: inventoryMovements.date,
      quantity: inventoryMovements.quantity,
      movementType: inventoryMovements.movementType,
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
  const { itemId, date, quantity, movementType, notes } = body ?? {};

  if (!itemId || !date || !movementType) {
    return NextResponse.json({ error: "Item, date and movement type are required." }, { status: 400 });
  }
  if (movementType !== "in" && movementType !== "out") {
    return NextResponse.json({ error: "Movement type must be 'in' or 'out'." }, { status: 400 });
  }
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    return NextResponse.json({ error: "Quantity must be a positive number." }, { status: 400 });
  }

  const result = await db.transaction(async (tx) => {
    const [item] = await tx.select().from(inventoryItems).where(eq(inventoryItems.id, Number(itemId))).limit(1);
    if (!item) {
      throw new Error("NOT_FOUND");
    }

    const current = Number(item.currentStock);
    const newStock = movementType === "in" ? current + qty : current - qty;

    if (movementType === "out" && newStock < 0) {
      throw new Error(`INSUFFICIENT_STOCK:${current}`);
    }

    await tx.update(inventoryItems).set({ currentStock: newStock.toFixed(2) }).where(eq(inventoryItems.id, item.id));

    const [movement] = await tx
      .insert(inventoryMovements)
      .values({
        itemId: item.id,
        date,
        quantity: qty.toFixed(2),
        movementType,
        notes: notes ?? "",
        createdBy: user.id,
      })
      .returning();

    return { movement, newStock };
  }).catch((err) => {
    if (err instanceof Error && err.message === "NOT_FOUND") return { error: "Item not found.", status: 404 };
    if (err instanceof Error && err.message.startsWith("INSUFFICIENT_STOCK:")) {
      const available = err.message.split(":")[1];
      return { error: `Not enough stock — only ${available} available.`, status: 400 };
    }
    throw err;
  });

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.movement, { status: 201 });
}
