"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

type UserRow = { id: number; name: string; email: string; role: "admin" | "staff"; isActive: boolean; createdAt: Date };

export default function UsersManager({ initialUsers, currentUserId }: { initialUsers: UserRow[]; currentUserId: number }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "staff">("staff");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    setShowForm(false);
    setName("");
    setEmail("");
    setPassword("");
    setRole("staff");
    router.refresh();
  }

  async function toggleActive(id: number, isActive: boolean) {
    await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    router.refresh();
  }

  async function changeRole(id: number, role: "admin" | "staff") {
    await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    router.refresh();
  }

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>Staff</h2>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
            <Plus /> New account
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {initialUsers.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`badge ${u.role === "admin" ? "badge-admin" : "badge-staff"}`}>{u.role}</span>
                  </td>
                  <td>
                    <span className={`badge ${u.isActive ? "badge-active" : "badge-inactive"}`}>{u.isActive ? "Active" : "Inactive"}</span>
                  </td>
                  <td>
                    {u.id !== currentUserId && (
                      <div style={{ display: "flex", gap: "0.3rem" }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => changeRole(u.id, u.role === "admin" ? "staff" : "admin")}
                        >
                          Make {u.role === "admin" ? "staff" : "admin"}
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => toggleActive(u.id, u.isActive)}>
                          {u.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    )}
                    {u.id === currentUserId && <span style={{ color: "var(--ink-soft)", fontSize: "0.8rem" }}>(you)</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="panel">
          <div className="panel-head">
            <h2>New staff account</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>
              <X /> Close
            </button>
          </div>
          {error && <div className="form-error">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="field-row">
              <div className="field">
                <label>Full name</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="field">
                <label>Email</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Temporary password (min. 8 characters)</label>
                <input type="text" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="field">
                <label>Role</label>
                <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "staff")}>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <p style={{ fontSize: "0.8rem", color: "var(--ink-soft)", marginTop: "-0.4rem" }}>
              Share this password with them directly (not over email) — they can change it themselves afterwards from their account
              settings.
            </p>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Creating..." : "Create account"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
