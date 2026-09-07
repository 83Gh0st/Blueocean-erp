"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Receipt, Wallet, Settings2, Users, LogOut, UserCircle } from "lucide-react";
import type { SessionUser } from "@/lib/auth";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/transactions", label: "Transactions", icon: Receipt },
  { href: "/cash", label: "Cash Ledger", icon: Wallet },
  { href: "/master-data", label: "Master Data", icon: Settings2 },
  { href: "/account", label: "My Account", icon: UserCircle },
];

const ADMIN_NAV_ITEMS: NavItem[] = [{ href: "/users", label: "Staff Accounts", icon: Users }];

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Sidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const items = user.role === "admin" ? [...NAV_ITEMS, ...ADMIN_NAV_ITEMS] : NAV_ITEMS;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-name">Blue Ocean Internal</div>
        <div className="sidebar-brand-sub">Accounting &amp; Ops</div>
      </div>
      <nav className="sidebar-nav">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className={`sidebar-link${isActive ? " active" : ""}`}>
              <Icon strokeWidth={1.8} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{initials(user.name)}</div>
          <div>
            <div className="sidebar-user-name">{user.name}</div>
            <div className="sidebar-user-role">{user.role}</div>
          </div>
        </div>
        <button className="sidebar-logout" onClick={handleLogout}>
          <LogOut strokeWidth={1.8} width={15} height={15} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
