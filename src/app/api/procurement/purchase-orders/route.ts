import { NextResponse, type NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { purchaseOrders, purchaseOrderItems, suppliers } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { nextPoNumber } from "@/lib/po-number";
import { round2 } from "@/lib/money";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = new URL(request.url).searchParams.get("status");
  const rows = await db
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
    .where(status ? eq(purchaseOrders.status, status as "draft" | "sent" | "partially_received" | "received" | "cancelled") : undefined)
    .orderBy(desc(purchaseOrders.date), desc(purchaseOrders.id));

  return NextResponse.json(rows);
}

type LineItemInput = { itemId?: number; description: string; quantity: number; unitPrice: number; vatRate?: number };

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { supplierId, date, expectedDate, notes, items } = body ?? {};

  if (!supplierId || !date) return NextResponse.json({ error: "Supplier and date are required." }, { status: 400 });
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "At least one line item is required." }, { status: 400 });
  }

  const lines: (LineItemInput & { lineTotal: number })[] = [];
  let base = 0;
  let vat = 0;
  for (const raw of items as LineItemInput[]) {
    const qty = Number(raw.quantity);
    const unitPrice = Number(raw.unitPrice);
    const vatRate = raw.vatRate !== undefined ? Number(raw.vatRate) : 0.05;
    if (!raw.description || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      return NextResponse.json({ error: "Each line item needs a description, positive quantity, and non-negative unit price." }, { status: 400 });
    }
    const lineBase = round2(qty * unitPrice);
    const lineVat = round2(lineBase * vatRate);
    base = round2(base + lineBase);
    vat = round2(vat + lineVat);
    lines.push({ ...raw, quantity: qty, unitPrice, vatRate, lineTotal: round2(lineBase + lineVat) });
  }
  const total = round2(base + vat);
  const poNumber = await nextPoNumber();

  const result = await db.transaction(async (tx) => {
    const [po] = await tx
      .insert(purchaseOrders)
      .values({
        poNumber,
        supplierId: Number(supplierId),
        date,
        expectedDate: expectedDate || null,
        notes: notes ?? "",
        baseAmount: base.toFixed(2),
        vatAmount: vat.toFixed(2),
        totalAmount: total.toFixed(2),
        createdBy: user.id,
      })
      .returning();

    await tx.insert(purchaseOrderItems).values(
      lines.map((l) => ({
        poId: po.id,
        itemId: l.itemId ?? null,
        description: l.description,
        quantityOrdered: l.quantity.toFixed(2),
        unitPrice: l.unitPrice.toFixed(2),
        vatRate: (l.vatRate ?? 0.05).toFixed(3),
        lineTotal: l.lineTotal.toFixed(2),
      }))
    );

    return po;
  });

  return NextResponse.json(result, { status: 201 });
}
