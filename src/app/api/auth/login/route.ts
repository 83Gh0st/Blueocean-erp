import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, sessionCookieOptions, SESSION_MAX_AGE_SECONDS, verifyPasswordHash, SESSION_COOKIE } from "@/lib/auth";
import { checkRateLimit, clientKeyFromHeaders } from "@/lib/rate-limit";

const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: NextRequest) {
  const clientKey = clientKeyFromHeaders(request.headers);
  const rateLimit = checkRateLimit(`login:${clientKey}`, MAX_ATTEMPTS, WINDOW_MS);
  if (rateLimit.limited) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  let email: string | undefined;
  let password: string | undefined;
  try {
    const body = await request.json();
    email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : undefined;
    password = typeof body?.password === "string" ? body.password : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];

  // Same message whether the email doesn't exist or the password is wrong —
  // distinguishing the two lets an attacker enumerate which staff emails
  // are valid accounts.
  const genericError = () => NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });

  if (!user || !user.isActive) {
    // Still runs a bcrypt compare against a dummy hash even when the user
    // doesn't exist, so a nonexistent-email request takes about the same
    // time as a wrong-password one — otherwise the response time itself
    // reveals which emails have accounts.
    await verifyPasswordHash(password, "$2a$12$invalidsaltinvalidsaltinvalidsaltinvalidsaltinvalid");
    return genericError();
  }

  const valid = await verifyPasswordHash(password, user.passwordHash);
  if (!valid) return genericError();

  const token = await createSession(user.id);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(SESSION_MAX_AGE_SECONDS));
  return response;
}
