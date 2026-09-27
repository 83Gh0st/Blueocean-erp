import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { suppliers } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const update: Partial<{ isActive: boolean; contactPerson: string; phone: string; email: string; address: string; trn: string }> = {};
  if (typeof body?.isActive === "boolean") update.isActive = body.isActive;
  if (typeof body?.contactPerson === "string") update.contactPerson = body.contactPerson;
  if (typeof body?.phone === "string") update.phone = body.phone;
  if (typeof body?.email === "string") update.email = body.email;
  if (typeof body?.address === "string") update.address = body.address;
  if (typeof body?.trn === "string") update.trn = body.trn;

  if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const [row] = await db.update(suppliers).set(update).where(eq(suppliers.id, Number(id))).returning();
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(row);
}
