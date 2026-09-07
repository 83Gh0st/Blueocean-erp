import { desc } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAdmin } from "@/lib/require-user";
import UsersManager from "@/components/UsersManager";

export default async function UsersPage() {
  const currentUser = await requireAdmin();
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, isActive: users.isActive, createdAt: users.createdAt })
    .from(users)
    .orderBy(desc(users.isActive), users.name);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Staff Accounts</h1>
          <p>Create a login for each staff member who needs access. Deactivating an account ends their active sessions immediately.</p>
        </div>
      </div>
      <UsersManager initialUsers={rows} currentUserId={currentUser.id} />
    </>
  );
}
