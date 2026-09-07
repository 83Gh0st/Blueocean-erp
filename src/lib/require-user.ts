import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "./auth";

/** For Server Components: returns the logged-in user, or redirects to /login. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** For Server Components: same as requireUser, but only admins may pass. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}
