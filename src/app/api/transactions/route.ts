import { NextResponse, type NextRequest } from "next/server";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { transactions, transactionAuditLog, departments, expenseHeads, paymentModes, users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { calcVat } from "@/lib/money";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const departmentId = searchParams.get("departmentId");

  const conditions = [];
  if (from) conditions.push(gte(transactions.date, from));
  if (to) conditions.push(lte(transactions.date, to));
  if (departmentId) conditions.push(eq(transactions.departmentId, Number(departmentId)));

  const rows = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      description: transactions.description,
      invoiceNo: transactions.invoiceNo,
      trn: transactions.trn,
      baseAmount: transactions.baseAmount,
      vatAmount: transactions.vatAmount,
      totalAmount: transactions.totalAmount,
      departmentId: transactions.departmentId,
      departmentName: departments.name,
      expenseHeadId: transactions.expenseHeadId,
      expenseHeadName: expenseHeads.name,
      paymentModeId: transactions.paymentModeId,
      paymentModeName: paymentModes.name,
      personId: transactions.personId,
      personName: users.name,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .innerJoin(departments, eq(transactions.departmentId, departments.id))
    .innerJoin(expenseHeads, eq(transactions.expenseHeadId, expenseHeads.id))
    .innerJoin(paymentModes, eq(transactions.paymentModeId, paymentModes.id))
    .innerJoin(users, eq(transactions.personId, users.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(transactions.date), desc(transactions.id))
    .limit(500);

  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    .insert(transactions)
    .values({
      date,
      personId: user.id,
      description,
      departmentId: Number(departmentId),
      expenseHeadId: Number(expenseHeadId),
      paymentModeId: Number(paymentModeId),
      invoiceNo: invoiceNo ?? "",
      trn: trn ?? "",
      baseAmount: base.toFixed(2),
      vatAmount: vatAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      createdBy: user.id,
    })
    .returning();

  await db.insert(transactionAuditLog).values({
    transactionId: row.id,
    action: "create",
    changedBy: user.id,
    newValues: row,
  });

  return NextResponse.json(row, { status: 201 });
}
