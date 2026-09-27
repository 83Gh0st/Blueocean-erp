import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { purchaseOrders, purchaseOrderItems, suppliers } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const rows = await db
    .select({
      id: purchaseOrders.id,
      poNumber: purchaseOrders.poNumber,
      date: purchaseOrders.date,
      expectedDate: purchaseOrders.expectedDate,
      notes: purchaseOrders.notes,
      status: purchaseOrders.status,
      baseAmount: purchaseOrders.baseAmount,
      vatAmount: purchaseOrders.vatAmount,
      totalAmount: purchaseOrders.totalAmount,
      supplierId: purchaseOrders.supplierId,
      supplierName: suppliers.name,
      supplierAddress: suppliers.address,
      supplierEmail: suppliers.email,
      supplierPhone: suppliers.phone,
    })
    .from(purchaseOrders)
    .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .where(eq(purchaseOrders.id, Number(id)))
    .limit(1);

  const po = rows[0];
  if (!po) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const items = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.poId, po.id));
  return NextResponse.json({ ...po, items });
}

const VALID_STATUSES = ["draft", "sent", "cancelled"] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const status = body?.status;
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: `Status must be one of: ${VALID_STATUSES.join(", ")}.` }, { status: 400 });
  }

  const [row] = await db.update(purchaseOrders).set({ status }).where(eq(purchaseOrders.id, Number(id))).returning();
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Only an admin can delete a purchase order." }, { status: 403 });

  const { id } = await params;
  const [existing] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, Number(id))).limit(1);
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (existing.status !== "draft") {
    return NextResponse.json({ error: "Only a draft PO can be deleted. Cancel it instead." }, { status: 400 });
  }

  await db.delete(purchaseOrders).where(eq(purchaseOrders.id, Number(id)));
  return NextResponse.json({ ok: true });
}
