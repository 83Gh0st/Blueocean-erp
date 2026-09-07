"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Department = { id: number; name: string; isActive: boolean };
type PaymentMode = { id: number; name: string; isActive: boolean };
type ExpenseHead = { id: number; name: string; isActive: boolean; departmentId: number; departmentName: string };

export default function MasterDataManager({
  initialDepartments,
  initialPaymentModes,
  initialExpenseHeads,
}: {
  initialDepartments: Department[];
  initialPaymentModes: PaymentMode[];
  initialExpenseHeads: ExpenseHead[];
}) {
  const router = useRouter();
  const [newDept, setNewDept] = useState("");
  const [newMode, setNewMode] = useState("");
  const [newHeadName, setNewHeadName] = useState("");
  const [newHeadDept, setNewHeadDept] = useState<number | string>(initialDepartments[0]?.id ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function createDepartment(e: React.FormEvent) {
    e.preventDefault();
    if (!newDept.trim()) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/master/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newDept.trim() }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    setNewDept("");
    router.refresh();
  }

  async function createPaymentMode(e: React.FormEvent) {
    e.preventDefault();
    if (!newMode.trim()) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/master/payment-modes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newMode.trim() }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    setNewMode("");
    router.refresh();
  }

  async function createExpenseHead(e: React.FormEvent) {
    e.preventDefault();
    if (!newHeadName.trim() || !newHeadDept) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/master/expense-heads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newHeadName.trim(), departmentId: Number(newHeadDept) }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    setNewHeadName("");
    router.refresh();
  }

  async function toggleActive(kind: "departments" | "payment-modes" | "expense-heads", id: number, isActive: boolean) {
    await fetch(`/api/master/${kind}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    router.refresh();
  }

  return (
    <>
      {error && <div className="form-error">{error}</div>}

      <div className="panel">
        <div className="panel-head">
          <h2>Departments</h2>
        </div>
        <form onSubmit={createDepartment} style={{ display: "flex", gap: "0.6rem", marginBottom: "1.1rem" }}>
          <input
            placeholder="New department name"
            value={newDept}
            onChange={(e) => setNewDept(e.target.value)}
            style={{ flex: 1, border: "1px solid var(--line)", borderRadius: "6px", padding: "0.5rem 0.7rem" }}
          />
          <button className="btn btn-primary btn-sm" disabled={busy}>
            Add
          </button>
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {initialDepartments.map((d) => (
                <tr key={d.id}>
                  <td>{d.name}</td>
                  <td>
                    <span className={`badge ${d.isActive ? "badge-active" : "badge-inactive"}`}>
                      {d.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => toggleActive("departments", d.id, d.isActive)}>
                      {d.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
              {initialDepartments.length === 0 && (
                <tr>
                  <td colSpan={3} className="empty-state">
                    No departments yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Payment Modes</h2>
        </div>
        <form onSubmit={createPaymentMode} style={{ display: "flex", gap: "0.6rem", marginBottom: "1.1rem" }}>
          <input
            placeholder="New payment mode (e.g. Cash, Bank Transfer)"
            value={newMode}
            onChange={(e) => setNewMode(e.target.value)}
            style={{ flex: 1, border: "1px solid var(--line)", borderRadius: "6px", padding: "0.5rem 0.7rem" }}
          />
          <button className="btn btn-primary btn-sm" disabled={busy}>
            Add
          </button>
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {initialPaymentModes.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td>
                    <span className={`badge ${m.isActive ? "badge-active" : "badge-inactive"}`}>
                      {m.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => toggleActive("payment-modes", m.id, m.isActive)}>
                      {m.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
              {initialPaymentModes.length === 0 && (
                <tr>
                  <td colSpan={3} className="empty-state">
                    No payment modes yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Expense Heads</h2>
        </div>
        <form onSubmit={createExpenseHead} className="field-row" style={{ marginBottom: "1.1rem", alignItems: "end" }}>
          <input
            placeholder="New expense head name"
            value={newHeadName}
            onChange={(e) => setNewHeadName(e.target.value)}
            style={{ border: "1px solid var(--line)", borderRadius: "6px", padding: "0.5rem 0.7rem" }}
          />
          <select
            value={newHeadDept}
            onChange={(e) => setNewHeadDept(e.target.value)}
            style={{ border: "1px solid var(--line)", borderRadius: "6px", padding: "0.5rem 0.7rem" }}
          >
            {initialDepartments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <button className="btn btn-primary btn-sm" disabled={busy}>
            Add
          </button>
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Department</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {initialExpenseHeads.map((h) => (
                <tr key={h.id}>
                  <td>{h.name}</td>
                  <td>{h.departmentName}</td>
                  <td>
                    <span className={`badge ${h.isActive ? "badge-active" : "badge-inactive"}`}>
                      {h.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => toggleActive("expense-heads", h.id, h.isActive)}>
                      {h.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
              {initialExpenseHeads.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-state">
                    No expense heads yet. Add a department first.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
