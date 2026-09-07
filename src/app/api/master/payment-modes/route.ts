import { NextResponse, type NextRequest } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { paymentModes } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await db.select().from(paymentModes).orderBy(desc(paymentModes.isActive), paymentModes.name);
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });

  try {
    const [row] = await db.insert(paymentModes).values({ name }).returning();
    return NextResponse.json(row, { status: 201 });
  } catch {
    return NextResponse.json({ error: "A payment mode with that name already exists." }, { status: 409 });
  }
}
