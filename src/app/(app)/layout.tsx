import { requireUser } from "@/lib/require-user";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="app-shell">
      <Sidebar user={user} />
      <main className="main-content">{children}</main>
    </div>
  );
}
