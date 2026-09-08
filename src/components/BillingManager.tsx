"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, FileDown, Trash2 } from "lucide-react";
import { formatMoney, round2 } from "@/lib/money";

type Invoice = {
  id: number;
  invoiceNo: string;
  date: string;
  dueDate: string | null;
  clientName: string;
  status: "draft" | "sent" | "paid" | "cancelled";
  totalAmount: string;
};

type LineItem = { description: string; quantity: string; unitPrice: string; vatRate: string };

const emptyLine = (): LineItem => ({ description: "", quantity: "1", unitPrice: "", vatRate: "0.05" });

const STATUS_FILTERS = ["all", "draft", "sent", "paid", "cancelled"] as const;

export default function BillingManager({ initialInvoices, currentUserRole }: { initialInvoices: Invoice[]; currentUserRole: "admin" | "staff" }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientAddr, setClientAddr] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);

  const visibleRows = useMemo(
    () => (filter === "all" ? initialInvoices : initialInvoices.filter((i) => i.status === filter)),
    [initialInvoices, filter]
  );

  const totals = useMemo(() => {
    let base = 0;
    let vat = 0;
    for (const l of lines) {
      const qty = Number(l.quantity);
      const price = Number(l.unitPrice);
      const rate = Number(l.vatRate);
      if (!Number.isFinite(qty) || !Number.isFinite(price)) continue;
      const lineBase = round2(qty * price);
      base = round2(base + lineBase);
      vat = round2(vat + round2(lineBase * rate));
    }
    return { base, vat, total: round2(base + vat) };
  }, [lines]);

  function updateLine(i: number, patch: Partial<LineItem>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }
  function removeLine(i: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  function resetForm() {
    setDate(new Date().toISOString().slice(0, 10));
    setDueDate("");
    setClientName("");
    setClientEmail("");
    setClientPhone("");
    setClientAddr("");
    setNotes("");
    setLines([emptyLine()]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        dueDate: dueDate || null,
        clientName,
        clientEmail,
        clientPhone,
        clientAddr,
        notes,
        items: lines.map((l) => ({ description: l.description, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), vatRate: Number(l.vatRate) })),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    setShowForm(false);
    resetForm();
    router.refresh();
  }

  async function setStatus(id: number, status: Invoice["status"]) {
    await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this draft invoice? This can't be undone.")) return;
    const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Could not delete.");
      return;
    }
    router.refresh();
  }

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>Invoices</h2>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} style={{ border: "1px solid var(--line)", borderRadius: 6, padding: "0.45rem 0.6rem", fontSize: "0.82rem" }}>
              {STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? "All statuses" : s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
              <Plus /> New invoice
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Invoice No.</th>
                <th>Date</th>
                <th>Client</th>
                <th>Status</th>
                <th className="num">Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.invoiceNo}</td>
                  <td>{inv.date}</td>
                  <td>{inv.clientName}</td>
                  <td>
                    <span className={`badge badge-${inv.status === "paid" ? "active" : inv.status === "cancelled" ? "inactive" : "staff"}`}>{inv.status}</span>
                  </td>
                  <td className="num">{formatMoney(inv.totalAmount)}</td>
                  <td>
                    <div style={{ display: "flex", gap: "0.3rem" }}>
                      <a className="btn btn-secondary btn-sm" href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noopener noreferrer" aria-label="Download PDF">
                        <FileDown />
                      </a>
                      {inv.status === "draft" && (
                        <button className="btn btn-secondary btn-sm" onClick={() => setStatus(inv.id, "sent")}>
                          Mark sent
                        </button>
                      )}
                      {inv.status === "sent" && (
                        <button className="btn btn-secondary btn-sm" onClick={() => setStatus(inv.id, "paid")}>
                          Mark paid
                        </button>
                      )}
                      {(inv.status === "draft" || inv.status === "sent") && (
                        <button className="btn btn-secondary btn-sm" onClick={() => setStatus(inv.id, "cancelled")}>
                          Cancel
                        </button>
                      )}
                      {inv.status === "draft" && currentUserRole === "admin" && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(inv.id)} aria-label="Delete">
                          <Trash2 />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-state">
                    No invoices yet.
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
            <h2>New invoice</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>
              <X /> Close
            </button>
          </div>
          {error && <div className="form-error">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="field-row">
              <div className="field">
                <label>Invoice date</label>
                <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="field">
                <label>Due date (optional)</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div className="field">
                <label>Client name</label>
                <input required value={clientName} onChange={(e) => setClientName(e.target.value)} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Client email (optional)</label>
                <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
              </div>
              <div className="field">
                <label>Client phone (optional)</label>
                <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
              </div>
              <div className="field">
                <label>Client address (optional)</label>
                <input value={clientAddr} onChange={(e) => setClientAddr(e.target.value)} />
              </div>
            </div>

            <div className="field" style={{ marginTop: "0.4rem" }}>
              <label>Line items</label>
            </div>
            {lines.map((l, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "3fr 0.8fr 1fr 0.8fr auto", gap: "0.5rem", marginBottom: "0.6rem", alignItems: "center" }}>
                <input placeholder="Description" required value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} style={{ border: "1px solid var(--line)", borderRadius: 6, padding: "0.5rem 0.6rem" }} />
                <input type="number" min="0.01" step="0.01" placeholder="Qty" required value={l.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} style={{ border: "1px solid var(--line)", borderRadius: 6, padding: "0.5rem 0.6rem" }} />
                <input type="number" min="0" step="0.01" placeholder="Unit price" required value={l.unitPrice} onChange={(e) => updateLine(i, { unitPrice: e.target.value })} style={{ border: "1px solid var(--line)", borderRadius: 6, padding: "0.5rem 0.6rem" }} />
                <select value={l.vatRate} onChange={(e) => updateLine(i, { vatRate: e.target.value })} style={{ border: "1px solid var(--line)", borderRadius: 6, padding: "0.5rem 0.6rem" }}>
                  <option value="0.05">5% VAT</option>
                  <option value="0">0% (exempt)</option>
                </select>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeLine(i)} disabled={lines.length === 1} aria-label="Remove line">
                  <X />
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-secondary btn-sm" onClick={addLine} style={{ marginBottom: "1rem" }}>
              <Plus /> Add line
            </button>

            <div className="field">
              <label>Notes (optional)</label>
              <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div style={{ fontSize: "0.85rem", color: "var(--ink-soft)", marginBottom: "1rem" }}>
              Subtotal {formatMoney(totals.base)} + VAT {formatMoney(totals.vat)} ={" "}
              <strong style={{ color: "var(--ink)" }}>Total {formatMoney(totals.total)} AED</strong>
            </div>

            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Creating..." : "Create invoice"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
