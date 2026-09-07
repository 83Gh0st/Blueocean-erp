import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { expenseHeads } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (typeof body?.isActive !== "boolean") {
    return NextResponse.json({ error: "isActive (boolean) is required." }, { status: 400 });
  }

  const [row] = await db
    .update(expenseHeads)
    .set({ isActive: body.isActive })
    .where(eq(expenseHeads.id, Number(id)))
    .returning();

  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(row);
}
