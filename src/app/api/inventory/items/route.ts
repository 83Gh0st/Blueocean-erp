import { NextResponse, type NextRequest } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { inventoryItems } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await db.select().from(inventoryItems).orderBy(asc(inventoryItems.itemName));
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const itemName = typeof body?.itemName === "string" ? body.itemName.trim() : "";
  const category = typeof body?.category === "string" ? body.category.trim() : "";
  const unit = typeof body?.unit === "string" && body.unit.trim() ? body.unit.trim() : "PCS";
  const minStock = Number(body?.minStock) || 0;
  const maxStock = Number(body?.maxStock) || 0;
  const openingStock = Number(body?.openingStock) || 0;

  if (!itemName) return NextResponse.json({ error: "Item name is required." }, { status: 400 });
  if (minStock < 0 || maxStock < 0 || openingStock < 0) {
    return NextResponse.json({ error: "Stock levels can't be negative." }, { status: 400 });
  }

  try {
    const [row] = await db
      .insert(inventoryItems)
      .values({ itemName, category, unit, minStock: minStock.toFixed(2), maxStock: maxStock.toFixed(2), currentStock: openingStock.toFixed(2) })
      .returning();
    return NextResponse.json(row, { status: 201 });
  } catch {
    return NextResponse.json({ error: "An item with that name already exists." }, { status: 409 });
  }
}
