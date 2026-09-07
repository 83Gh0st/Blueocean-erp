import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { departments } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { desc } from "drizzle-orm";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await db.select().from(departments).orderBy(desc(departments.isActive), departments.name);
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });

  try {
    const [row] = await db.insert(departments).values({ name }).returning();
    return NextResponse.json(row, { status: 201 });
  } catch {
    return NextResponse.json({ error: "A department with that name already exists." }, { status: 409 });
  }
}
