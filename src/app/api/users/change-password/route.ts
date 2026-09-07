import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSessionUser, hashPassword, verifyPasswordHash } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Current and new password are required." }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
  }

  const rows = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  const dbUser = rows[0];
  if (!dbUser) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const valid = await verifyPasswordHash(currentPassword, dbUser.passwordHash);
  if (!valid) return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });

  const passwordHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));

  return NextResponse.json({ ok: true });
}
