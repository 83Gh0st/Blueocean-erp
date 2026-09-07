import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, sessions } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const targetId = Number(id);
  if (targetId === user.id) {
    return NextResponse.json({ error: "You can't change your own access level from here." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const update: Partial<{ isActive: boolean; role: "admin" | "staff" }> = {};
  if (typeof body?.isActive === "boolean") update.isActive = body.isActive;
  if (body?.role === "admin" || body?.role === "staff") update.role = body.role;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const [row] = await db
    .update(users)
    .set(update)
    .where(eq(users.id, targetId))
    .returning({ id: users.id, name: users.name, email: users.email, role: users.role, isActive: users.isActive });

  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Deactivating (or demoting) someone should end their existing sessions
  // immediately, not just block new logins — otherwise they'd stay signed
  // in on any device until that session naturally expires.
  if (update.isActive === false) {
    await db.delete(sessions).where(eq(sessions.userId, targetId));
  }

  return NextResponse.json(row);
}
