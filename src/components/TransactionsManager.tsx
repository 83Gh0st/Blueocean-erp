"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus, X } from "lucide-react";
import { calcVat, formatMoney } from "@/lib/money";

type Department = { id: number; name: string };
type ExpenseHead = { id: number; name: string; departmentId: number };
type PaymentMode = { id: number; name: string };
type Transaction = {
  id: number;
  date: string;
  description: string;
  invoiceNo: string | null;
  trn: string | null;
  baseAmount: string;
  vatAmount: string;
  totalAmount: string;
  departmentId: number;
  departmentName: string;
  expenseHeadId: number;
  expenseHeadName: string;
  paymentModeId: number;
  paymentModeName: string;
  personId: number;
  personName: string;
};

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  description: "",
  departmentId: "",
  expenseHeadId: "",
  paymentModeId: "",
  baseAmount: "",
  invoiceNo: "",
  trn: "",
};

export default function TransactionsManager({
  departments,
  expenseHeads,
  paymentModes,
  initialTransactions,
  currentUserRole,
}: {
  departments: Department[];
  expenseHeads: ExpenseHead[];
  paymentModes: PaymentMode[];
  initialTransactions: Transaction[];
  currentUserRole: "admin" | "staff";
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [filterDept, setFilterDept] = useState("");

  const filteredHeads = useMemo(
    () => expenseHeads.filter((h) => !form.departmentId || h.departmentId === Number(form.departmentId)),
    [expenseHeads, form.departmentId]
  );

  const preview = useMemo(() => {
    const base = Number(form.baseAmount);
    if (!Number.isFinite(base) || base <= 0) return null;
    return calcVat(base);
  }, [form.baseAmount]);

  const visibleRows = useMemo(
    () => (filterDept ? initialTransactions.filter((t) => t.departmentId === Number(filterDept)) : initialTransactions),
    [initialTransactions, filterDept]
  );

  const totalVisible = useMemo(
    () => visibleRows.reduce((sum, t) => sum + Number(t.totalAmount), 0),
    [visibleRows]
  );

  function openCreate() {
    setForm(emptyForm);
    setEditingId(null);
    setError("");
    setShowForm(true);
  }

  function openEdit(t: Transaction) {
    setForm({
      date: t.date,
      description: t.description,
      departmentId: String(t.departmentId),
      expenseHeadId: String(t.expenseHeadId),
      paymentModeId: String(t.paymentModeId),
      baseAmount: t.baseAmount,
      invoiceNo: t.invoiceNo ?? "",
      trn: t.trn ?? "",
    });
    setEditingId(t.id);
    setError("");
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const payload = {
      date: form.date,
      description: form.description,
      departmentId: Number(form.departmentId),
      expenseHeadId: Number(form.expenseHeadId),
      paymentModeId: Number(form.paymentModeId),
      baseAmount: Number(form.baseAmount),
      invoiceNo: form.invoiceNo,
      trn: form.trn,
    };
    const url = editingId ? `/api/transactions/${editingId}` : "/api/transactions";
    const method = editingId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    setShowForm(false);
    router.refresh();
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this transaction? This can't be undone (though it stays in the audit log).")) return;
    const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
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
          <h2>All transactions</h2>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
            <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} style={{ border: "1px solid var(--line)", borderRadius: 6, padding: "0.45rem 0.6rem", fontSize: "0.82rem" }}>
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <button className="btn btn-primary btn-sm" onClick={openCreate}>
              <Plus /> New transaction
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Department</th>
                <th>Expense Head</th>
                <th>By</th>
                <th>Payment</th>
                <th className="num">Base</th>
                <th className="num">VAT</th>
                <th className="num">Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((t) => (
                <tr key={t.id}>
                  <td>{t.date}</td>
                  <td style={{ whiteSpace: "normal", minWidth: 180 }}>{t.description}</td>
                  <td>{t.departmentName}</td>
                  <td>{t.expenseHeadName}</td>
                  <td>{t.personName}</td>
                  <td>{t.paymentModeName}</td>
                  <td className="num">{formatMoney(t.baseAmount)}</td>
                  <td className="num">{formatMoney(t.vatAmount)}</td>
                  <td className="num">{formatMoney(t.totalAmount)}</td>
                  <td>
                    <div style={{ display: "flex", gap: "0.3rem" }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(t)} aria-label="Edit">
                        <Pencil />
                      </button>
                      {currentUserRole === "admin" && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.id)} aria-label="Delete">
                          <Trash2 />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={10} className="empty-state">
                    No transactions yet.
                  </td>
                </tr>
              )}
            </tbody>
            {visibleRows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={8} style={{ textAlign: "right", fontWeight: 600 }}>
                    Total ({visibleRows.length} entries)
                  </td>
                  <td className="num" style={{ fontWeight: 700 }}>
                    {formatMoney(totalVisible)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {showForm && (
        <div className="panel">
          <div className="panel-head">
            <h2>{editingId ? "Edit transaction" : "New transaction"}</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>
              <X /> Close
            </button>
          </div>
          {error && <div className="form-error">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="field-row">
              <div className="field">
                <label>Date</label>
                <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="field">
                <label>Department</label>
                <select
                  required
                  value={form.departmentId}
                  onChange={(e) => setForm({ ...form, departmentId: e.target.value, expenseHeadId: "" })}
                >
                  <option value="">Select...</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Expense Head</label>
                <select required value={form.expenseHeadId} onChange={(e) => setForm({ ...form, expenseHeadId: e.target.value })}>
                  <option value="">Select...</option>
                  {filteredHeads.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label>Description</label>
              <input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            <div className="field-row">
              <div className="field">
                <label>Payment Mode</label>
                <select required value={form.paymentModeId} onChange={(e) => setForm({ ...form, paymentModeId: e.target.value })}>
                  <option value="">Select...</option>
                  {paymentModes.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Base Amount (AED)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={form.baseAmount}
                  onChange={(e) => setForm({ ...form, baseAmount: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Invoice No. (optional)</label>
                <input value={form.invoiceNo} onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })} />
              </div>
              <div className="field">
                <label>TRN (optional)</label>
                <input value={form.trn} onChange={(e) => setForm({ ...form, trn: e.target.value })} />
              </div>
            </div>

            {preview && (
              <div style={{ fontSize: "0.85rem", color: "var(--ink-soft)", marginBottom: "1rem" }}>
                Base {formatMoney(form.baseAmount)} + VAT (5%) {formatMoney(preview.vatAmount)} ={" "}
                <strong style={{ color: "var(--ink)" }}>Total {formatMoney(preview.totalAmount)} AED</strong>
              </div>
            )}

            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Saving..." : editingId ? "Save changes" : "Add transaction"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
