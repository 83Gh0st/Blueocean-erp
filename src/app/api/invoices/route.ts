import { NextResponse, type NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { invoices, invoiceItems } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { nextInvoiceNumber } from "@/lib/invoice-number";
import { round2 } from "@/lib/money";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = new URL(request.url).searchParams.get("status");
  const rows = await db
    .select()
    .from(invoices)
    .where(status ? eq(invoices.status, status as "draft" | "sent" | "paid" | "cancelled") : undefined)
    .orderBy(desc(invoices.date), desc(invoices.id));

  return NextResponse.json(rows);
}

type LineItemInput = { description: string; quantity: number; unitPrice: number; vatRate?: number };

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { date, clientName, clientEmail, clientPhone, clientAddr, notes, dueDate, items } = body ?? {};

  if (!date || !clientName) {
    return NextResponse.json({ error: "Date and client name are required." }, { status: 400 });
  }
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
    lines.push({ description: raw.description, quantity: qty, unitPrice, vatRate, lineTotal: round2(lineBase + lineVat) });
  }
  const total = round2(base + vat);

  const invoiceNo = await nextInvoiceNumber();

  const result = await db.transaction(async (tx) => {
    const [invoice] = await tx
      .insert(invoices)
      .values({
        invoiceNo,
        date,
        clientName,
        clientEmail: clientEmail ?? "",
        clientPhone: clientPhone ?? "",
        clientAddr: clientAddr ?? "",
        notes: notes ?? "",
        baseAmount: base.toFixed(2),
        vatAmount: vat.toFixed(2),
        totalAmount: total.toFixed(2),
        dueDate: dueDate || null,
        createdBy: user.id,
      })
      .returning();

    await tx.insert(invoiceItems).values(
      lines.map((l) => ({
        invoiceId: invoice.id,
        description: l.description,
        quantity: String(l.quantity),
        unitPrice: l.unitPrice.toFixed(2),
        vatRate: (l.vatRate ?? 0.05).toFixed(3),
        lineTotal: l.lineTotal.toFixed(2),
      }))
    );

    return invoice;
  });

  return NextResponse.json(result, { status: 201 });
}
