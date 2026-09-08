import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { renderToBuffer } from "@react-pdf/renderer";
import { db } from "@/db";
import { invoices, invoiceItems } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { InvoiceDocument } from "@/lib/pdf/InvoiceDocument";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, Number(id))).limit(1);
  if (!invoice) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoice.id));

  const buffer = await renderToBuffer(<InvoiceDocument invoice={{ ...invoice, items }} />);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoiceNo}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
