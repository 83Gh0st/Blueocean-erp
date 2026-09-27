import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import ExcelJS from "exceljs";
import { db } from "@/db";
import { transactions, departments, expenseHeads, paymentModes, users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      date: transactions.date,
      description: transactions.description,
      department: departments.name,
      expenseHead: expenseHeads.name,
      person: users.name,
      paymentMode: paymentModes.name,
      baseAmount: transactions.baseAmount,
      vatAmount: transactions.vatAmount,
      totalAmount: transactions.totalAmount,
      invoiceNo: transactions.invoiceNo,
      trn: transactions.trn,
    })
    .from(transactions)
    .innerJoin(departments, eq(transactions.departmentId, departments.id))
    .innerJoin(expenseHeads, eq(transactions.expenseHeadId, expenseHeads.id))
    .innerJoin(paymentModes, eq(transactions.paymentModeId, paymentModes.id))
    .innerJoin(users, eq(transactions.personId, users.id))
    .orderBy(desc(transactions.date));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Blue Ocean Internal";
  const sheet = workbook.addWorksheet("Transactions");

  sheet.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Description", key: "description", width: 36 },
    { header: "Department", key: "department", width: 16 },
    { header: "Expense Head", key: "expenseHead", width: 28 },
    { header: "By", key: "person", width: 16 },
    { header: "Payment Mode", key: "paymentMode", width: 14 },
    { header: "Base Amount", key: "baseAmount", width: 14 },
    { header: "VAT", key: "vatAmount", width: 12 },
    { header: "Total", key: "totalAmount", width: 14 },
    { header: "Invoice No.", key: "invoiceNo", width: 16 },
    { header: "TRN", key: "trn", width: 18 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E6ED" } };

  for (const row of rows) {
    sheet.addRow({
      ...row,
      baseAmount: Number(row.baseAmount),
      vatAmount: Number(row.vatAmount),
      totalAmount: Number(row.totalAmount),
    });
  }
  sheet.getColumn("baseAmount").numFmt = "#,##0.00";
  sheet.getColumn("vatAmount").numFmt = "#,##0.00";
  sheet.getColumn("totalAmount").numFmt = "#,##0.00";

  const buffer = await workbook.xlsx.writeBuffer();

  // exceljs's own Buffer type doesn't line up exactly with Node's global
  // Buffer type (a types-package mismatch, not a real type difference at
  // runtime) — going through unknown first is the correct, narrow way to
  // bridge that, rather than a broader type-checking bypass.
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="transactions-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
