import { NextResponse, type NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { expenseHeads, departments } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await db
    .select({
      id: expenseHeads.id,
      name: expenseHeads.name,
      isActive: expenseHeads.isActive,
      departmentId: expenseHeads.departmentId,
      departmentName: departments.name,
    })
    .from(expenseHeads)
    .innerJoin(departments, eq(expenseHeads.departmentId, departments.id))
    .orderBy(desc(expenseHeads.isActive), expenseHeads.name);
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const departmentId = Number(body?.departmentId);
  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  if (!departmentId) return NextResponse.json({ error: "Department is required." }, { status: 400 });

  const [row] = await db.insert(expenseHeads).values({ name, departmentId }).returning();
  return NextResponse.json(row, { status: 201 });
}
