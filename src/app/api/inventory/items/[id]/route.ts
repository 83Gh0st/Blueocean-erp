import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { inventoryItems } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const update: Partial<{ category: string; unit: string; minStock: string; maxStock: string; unitPrice: string }> = {};
  if (typeof body?.category === "string") update.category = body.category.trim();
  if (typeof body?.unit === "string" && body.unit.trim()) update.unit = body.unit.trim();
  if (body?.minStock !== undefined) update.minStock = Number(body.minStock).toFixed(2);
  if (body?.maxStock !== undefined) update.maxStock = Number(body.maxStock).toFixed(2);
  if (body?.unitPrice !== undefined) update.unitPrice = Number(body.unitPrice).toFixed(2);

  if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const [row] = await db.update(inventoryItems).set(update).where(eq(inventoryItems.id, Number(id))).returning();
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(row);
}
