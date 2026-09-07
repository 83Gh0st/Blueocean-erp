"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { formatMoney } from "@/lib/money";

type Staff = { id: number; name: string };
type CashEntry = {
  id: number;
  date: string;
  openingBalance: string;
  received: string;
  spent: string;
  closingBalance: string;
  description: string | null;
  personId: number;
  personName: string;
};

export default function CashLedgerManager({ staff, initialEntries }: { staff: Staff[]; initialEntries: CashEntry[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [personId, setPersonId] = useState<number | string>(staff[0]?.id ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [received, setReceived] = useState("");
  const [spent, setSpent] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [filterPerson, setFilterPerson] = useState("");

  // Current balance per person = most recent entry's closing balance.
  const balances = useMemo(() => {
    const map = new Map<number, { name: string; balance: number }>();
    for (const e of initialEntries) {
      if (!map.has(e.personId)) map.set(e.personId, { name: e.personName, balance: Number(e.closingBalance) });
    }
    return Array.from(map.values());
  }, [initialEntries]);

  const visibleRows = useMemo(
    () => (filterPerson ? initialEntries.filter((e) => e.personId === Number(filterPerson)) : initialEntries),
    [initialEntries, filterPerson]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/cash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, personId: Number(personId), received: received || 0, spent: spent || 0, description }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    setShowForm(false);
    setReceived("");
    setSpent("");
    setDescription("");
    router.refresh();
  }

  return (
    <>
      <div className="stat-grid">
        {balances.map((b) => (
          <div className="stat-card" key={b.name}>
            <div className="stat-card-label">{b.name} — cash on hand</div>
            <div className={`stat-card-value ${b.balance < 0 ? "neg" : ""}`}>{formatMoney(b.balance)} AED</div>
          </div>
        ))}
        {balances.length === 0 && (
          <div className="stat-card">
            <div className="stat-card-label">No entries yet</div>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Ledger entries</h2>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <select value={filterPerson} onChange={(e) => setFilterPerson(e.target.value)} style={{ border: "1px solid var(--line)", borderRadius: 6, padding: "0.45rem 0.6rem", fontSize: "0.82rem" }}>
              <option value="">Everyone</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
              <Plus /> New entry
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Person</th>
                <th>Description</th>
                <th className="num">Opening</th>
                <th className="num">Received</th>
                <th className="num">Spent</th>
                <th className="num">Closing</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((e) => (
                <tr key={e.id}>
                  <td>{e.date}</td>
                  <td>{e.personName}</td>
                  <td style={{ whiteSpace: "normal", minWidth: 160 }}>{e.description}</td>
                  <td className="num">{formatMoney(e.openingBalance)}</td>
                  <td className="num">{formatMoney(e.received)}</td>
                  <td className="num">{formatMoney(e.spent)}</td>
                  <td className="num" style={{ fontWeight: 600 }}>
                    {formatMoney(e.closingBalance)}
                  </td>
                </tr>
              ))}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-state">
                    No cash entries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="panel">
          <div className="panel-head">
            <h2>New cash entry</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>
              <X /> Close
            </button>
          </div>
          {error && <div className="form-error">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="field-row">
              <div className="field">
                <label>Date</label>
                <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="field">
                <label>Person</label>
                <select required value={personId} onChange={(e) => setPersonId(e.target.value)}>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Received (AED)</label>
                <input type="number" step="0.01" min="0" value={received} onChange={(e) => setReceived(e.target.value)} />
              </div>
              <div className="field">
                <label>Spent (AED)</label>
                <input type="number" step="0.01" min="0" value={spent} onChange={(e) => setSpent(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>Description (optional)</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Saving..." : "Add entry"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
