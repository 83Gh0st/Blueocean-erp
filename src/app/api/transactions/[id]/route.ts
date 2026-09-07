import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { transactions, transactionAuditLog } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { calcVat } from "@/lib/money";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const transactionId = Number(id);

  const existingRows = await db.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
  const existing = existingRows[0];
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const { date, description, departmentId, expenseHeadId, paymentModeId, baseAmount, invoiceNo, trn } = body ?? {};

  if (!date || !description || !departmentId || !expenseHeadId || !paymentModeId || baseAmount === undefined) {
    return NextResponse.json({ error: "Date, description, department, expense head, payment mode and amount are required." }, { status: 400 });
  }
  const base = Number(baseAmount);
  if (!Number.isFinite(base) || base <= 0) {
    return NextResponse.json({ error: "Amount must be a positive number." }, { status: 400 });
  }
  const { vatAmount, totalAmount } = calcVat(base);

  const [row] = await db
    .update(transactions)
    .set({
      date,
      description,
      departmentId: Number(departmentId),
      expenseHeadId: Number(expenseHeadId),
      paymentModeId: Number(paymentModeId),
      invoiceNo: invoiceNo ?? "",
      trn: trn ?? "",
      baseAmount: base.toFixed(2),
      vatAmount: vatAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      updatedBy: user.id,
      updatedAt: new Date(),
    })
    .where(eq(transactions.id, transactionId))
    .returning();

  await db.insert(transactionAuditLog).values({
    transactionId,
    action: "update",
    changedBy: user.id,
    oldValues: existing,
    newValues: row,
  });

  return NextResponse.json(row);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Deletion is admin-only: staff can log and correct their own entries,
  // but removing a financial record outright needs a more deliberate gate
  // than any signed-in account being able to do it.
  if (user.role !== "admin") return NextResponse.json({ error: "Only an admin can delete a transaction." }, { status: 403 });

  const { id } = await params;
  const transactionId = Number(id);

  const existingRows = await db.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
  const existing = existingRows[0];
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await db.insert(transactionAuditLog).values({
    transactionId,
    action: "delete",
    changedBy: user.id,
    oldValues: existing,
  });
  await db.delete(transactions).where(eq(transactions.id, transactionId));

  return NextResponse.json({ ok: true });
}
