import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { invoices, invoiceItems } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, Number(id))).limit(1);
  if (!invoice) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoice.id));
  return NextResponse.json({ ...invoice, items });
}

const VALID_STATUSES = ["draft", "sent", "paid", "cancelled"] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const status = body?.status;
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: `Status must be one of: ${VALID_STATUSES.join(", ")}.` }, { status: 400 });
  }

  const [row] = await db.update(invoices).set({ status }).where(eq(invoices.id, Number(id))).returning();
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Only an admin can delete an invoice." }, { status: 403 });

  const { id } = await params;
  const [existing] = await db.select().from(invoices).where(eq(invoices.id, Number(id))).limit(1);
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Only a draft should ever be deleted outright — once it's been sent to
  // a client, cancelling (not deleting) keeps the invoice number and
  // record intact, which matters once a number has potentially been
  // quoted to a customer or referenced in their own accounts.
  if (existing.status !== "draft") {
    return NextResponse.json({ error: "Only a draft invoice can be deleted. Cancel it instead." }, { status: 400 });
  }

  await db.delete(invoices).where(eq(invoices.id, Number(id)));
  return NextResponse.json({ ok: true });
}
