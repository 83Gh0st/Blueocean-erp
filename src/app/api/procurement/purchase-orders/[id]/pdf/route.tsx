import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";
import { db } from "@/db";
import { purchaseOrders, purchaseOrderItems, suppliers } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { PurchaseOrderDocument } from "@/lib/pdf/PurchaseOrderDocument";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const rows = await db
    .select({
      poNumber: purchaseOrders.poNumber,
      date: purchaseOrders.date,
      expectedDate: purchaseOrders.expectedDate,
      notes: purchaseOrders.notes,
      baseAmount: purchaseOrders.baseAmount,
      vatAmount: purchaseOrders.vatAmount,
      totalAmount: purchaseOrders.totalAmount,
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

  const items = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.poId, Number(id)));
  const buffer = await renderToBuffer(<PurchaseOrderDocument po={{ ...po, items }} />);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${po.poNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
