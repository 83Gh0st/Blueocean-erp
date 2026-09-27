"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, FileDown, Trash2, PackageCheck } from "lucide-react";
import { formatMoney, round2 } from "@/lib/money";

type Supplier = { id: number; name: string; contactPerson: string | null; phone: string | null; email: string | null; isActive: boolean };
type InventoryItemOpt = { id: number; itemName: string; unit: string | null };
type Po = {
  id: number;
  poNumber: string;
  date: string;
  expectedDate: string | null;
  status: "draft" | "sent" | "partially_received" | "received" | "cancelled";
  totalAmount: string;
  supplierId: number;
  supplierName: string;
};
type PoLineInput = { itemId: string; description: string; quantity: string; unitPrice: string; vatRate: string };
type PoDetailItem = { id: number; description: string; quantityOrdered: string; quantityReceived: string; unitPrice: string };
type PoDetail = Po & { items: PoDetailItem[] };

const emptyLine = (): PoLineInput => ({ itemId: "", description: "", quantity: "1", unitPrice: "", vatRate: "0.05" });
const STATUS_FILTERS = ["all", "draft", "sent", "partially_received", "received", "cancelled"] as const;

export default function ProcurementManager({
  suppliers,
  initialPurchaseOrders,
  inventoryItems,
  currentUserRole,
}: {
  suppliers: Supplier[];
  initialPurchaseOrders: Po[];
  inventoryItems: InventoryItemOpt[];
  currentUserRole: "admin" | "staff";
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");

  // Supplier form
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [supName, setSupName] = useState("");
  const [supContact, setSupContact] = useState("");
  const [supPhone, setSupPhone] = useState("");
  const [supEmail, setSupEmail] = useState("");
  const [supAddress, setSupAddress] = useState("");
  const [supTrn, setSupTrn] = useState("");

  // PO form
  const [showPoForm, setShowPoForm] = useState(false);
  const [poSupplierId, setPoSupplierId] = useState<number | string>(suppliers[0]?.id ?? "");
  const [poDate, setPoDate] = useState(new Date().toISOString().slice(0, 10));
  const [poExpectedDate, setPoExpectedDate] = useState("");
  const [poNotes, setPoNotes] = useState("");
  const [lines, setLines] = useState<PoLineInput[]>([emptyLine()]);

  // Receive flow
  const [receivingPo, setReceivingPo] = useState<PoDetail | null>(null);
  const [receiveQtys, setReceiveQtys] = useState<Record<number, string>>({});

  const visibleRows = useMemo(() => (filter === "all" ? initialPurchaseOrders : initialPurchaseOrders.filter((p) => p.status === filter)), [initialPurchaseOrders, filter]);

  const poTotals = useMemo(() => {
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

  function updateLine(i: number, patch: Partial<PoLineInput>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }
  function removeLine(i: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  async function handleCreateSupplier(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: supName, contactPerson: supContact, phone: supPhone, email: supEmail, address: supAddress, trn: supTrn }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    setShowSupplierForm(false);
    setSupName("");
    setSupContact("");
    setSupPhone("");
    setSupEmail("");
    setSupAddress("");
    setSupTrn("");
    router.refresh();
  }

  async function handleCreatePo(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/procurement/purchase-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierId: Number(poSupplierId),
        date: poDate,
        expectedDate: poExpectedDate || null,
        notes: poNotes,
        items: lines.map((l) => ({
          itemId: l.itemId ? Number(l.itemId) : undefined,
          description: l.description,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          vatRate: Number(l.vatRate),
        })),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    setShowPoForm(false);
    setPoNotes("");
    setPoExpectedDate("");
    setLines([emptyLine()]);
    router.refresh();
  }

  async function setStatus(id: number, status: "sent" | "cancelled") {
    await fetch(`/api/procurement/purchase-orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this draft PO? This can't be undone.")) return;
    const res = await fetch(`/api/procurement/purchase-orders/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Could not delete.");
      return;
    }
    router.refresh();
  }

  async function openReceive(id: number) {
    setError("");
    const res = await fetch(`/api/procurement/purchase-orders/${id}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not load purchase order.");
      return;
    }
    setReceivingPo(data);
    const defaults: Record<number, string> = {};
    for (const item of data.items as PoDetailItem[]) {
      const remaining = round2(Number(item.quantityOrdered) - Number(item.quantityReceived));
      defaults[item.id] = remaining > 0 ? String(remaining) : "0";
    }
    setReceiveQtys(defaults);
  }

  async function submitReceive(e: React.FormEvent) {
    e.preventDefault();
    if (!receivingPo) return;
    setBusy(true);
    setError("");
    const linesPayload = Object.entries(receiveQtys)
      .map(([poItemId, qty]) => ({ poItemId: Number(poItemId), quantityReceived: Number(qty) }))
      .filter((l) => l.quantityReceived > 0);

    const res = await fetch(`/api/procurement/purchase-orders/${receivingPo.id}/receive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines: linesPayload }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    setReceivingPo(null);
    router.refresh();
  }

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h2>Suppliers</h2>
          <button className="btn btn-primary btn-sm" onClick={() => setShowSupplierForm(true)}>
            <Plus /> New supplier
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Phone</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.contactPerson || "—"}</td>
                  <td>{s.phone || "—"}</td>
                  <td>{s.email || "—"}</td>
                </tr>
              ))}
              {suppliers.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-state">
                    No suppliers yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Purchase orders</h2>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} style={{ border: "1px solid var(--line)", borderRadius: 6, padding: "0.45rem 0.6rem", fontSize: "0.82rem" }}>
              {STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? "All statuses" : s.replace("_", " ")}
                </option>
              ))}
            </select>
            <button className="btn btn-primary btn-sm" onClick={() => setShowPoForm(true)} disabled={suppliers.length === 0}>
              <Plus /> New PO
            </button>
          </div>
        </div>
        {suppliers.length === 0 && <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>Add a supplier first.</p>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>PO Number</th>
                <th>Date</th>
                <th>Supplier</th>
                <th>Status</th>
                <th className="num">Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((po) => (
                <tr key={po.id}>
                  <td>{po.poNumber}</td>
                  <td>{po.date}</td>
                  <td>{po.supplierName}</td>
                  <td>
                    <span className={`badge ${po.status === "received" ? "badge-active" : po.status === "cancelled" ? "" : "badge-staff"}`}>{po.status.replace("_", " ")}</span>
                  </td>
                  <td className="num">{formatMoney(po.totalAmount)}</td>
                  <td>
                    <div style={{ display: "flex", gap: "0.3rem" }}>
                      <a className="btn btn-secondary btn-sm" href={`/api/procurement/purchase-orders/${po.id}/pdf`} target="_blank" rel="noopener noreferrer" aria-label="Download PDF">
                        <FileDown />
                      </a>
                      {po.status === "draft" && (
                        <button className="btn btn-secondary btn-sm" onClick={() => setStatus(po.id, "sent")}>
                          Mark sent
                        </button>
                      )}
                      {(po.status === "sent" || po.status === "partially_received") && (
                        <button className="btn btn-secondary btn-sm" onClick={() => openReceive(po.id)}>
                          <PackageCheck /> Receive
                        </button>
                      )}
                      {(po.status === "draft" || po.status === "sent" || po.status === "partially_received") && (
                        <button className="btn btn-secondary btn-sm" onClick={() => setStatus(po.id, "cancelled")}>
                          Cancel
                        </button>
                      )}
                      {po.status === "draft" && currentUserRole === "admin" && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(po.id)} aria-label="Delete">
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
                    No purchase orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showSupplierForm && (
        <div className="panel">
          <div className="panel-head">
            <h2>New supplier</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowSupplierForm(false)}>
              <X /> Close
            </button>
          </div>
          {error && <div className="form-error">{error}</div>}
          <form onSubmit={handleCreateSupplier}>
            <div className="field-row">
              <div className="field">
                <label>Supplier name</label>
                <input required value={supName} onChange={(e) => setSupName(e.target.value)} />
              </div>
              <div className="field">
                <label>Contact person (optional)</label>
                <input value={supContact} onChange={(e) => setSupContact(e.target.value)} />
              </div>
              <div className="field">
                <label>TRN (optional)</label>
                <input value={supTrn} onChange={(e) => setSupTrn(e.target.value)} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Phone (optional)</label>
                <input value={supPhone} onChange={(e) => setSupPhone(e.target.value)} />
              </div>
              <div className="field">
                <label>Email (optional)</label>
                <input type="email" value={supEmail} onChange={(e) => setSupEmail(e.target.value)} />
              </div>
              <div className="field">
                <label>Address (optional)</label>
                <input value={supAddress} onChange={(e) => setSupAddress(e.target.value)} />
              </div>
            </div>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Adding..." : "Add supplier"}
            </button>
          </form>
        </div>
      )}

      {showPoForm && (
        <div className="panel">
          <div className="panel-head">
            <h2>New purchase order</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowPoForm(false)}>
              <X /> Close
            </button>
          </div>
          {error && <div className="form-error">{error}</div>}
          <form onSubmit={handleCreatePo}>
            <div className="field-row">
              <div className="field">
                <label>Supplier</label>
                <select required value={poSupplierId} onChange={(e) => setPoSupplierId(e.target.value)}>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Order date</label>
                <input type="date" required value={poDate} onChange={(e) => setPoDate(e.target.value)} />
              </div>
              <div className="field">
                <label>Expected delivery (optional)</label>
                <input type="date" value={poExpectedDate} onChange={(e) => setPoExpectedDate(e.target.value)} />
              </div>
            </div>

            <div className="field" style={{ marginTop: "0.4rem" }}>
              <label>Line items</label>
            </div>
            {lines.map((l, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1.2fr 2fr 0.7fr 0.9fr 0.8fr auto", gap: "0.5rem", marginBottom: "0.6rem", alignItems: "center" }}>
                <select value={l.itemId} onChange={(e) => updateLine(i, { itemId: e.target.value, description: e.target.value ? inventoryItems.find((it) => it.id === Number(e.target.value))?.itemName ?? l.description : l.description })} style={{ border: "1px solid var(--line)", borderRadius: 6, padding: "0.5rem 0.6rem" }}>
                  <option value="">(not tracked)</option>
                  {inventoryItems.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.itemName}
                    </option>
                  ))}
                </select>
                <input placeholder="Description" required value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} style={{ border: "1px solid var(--line)", borderRadius: 6, padding: "0.5rem 0.6rem" }} />
                <input type="number" min="0.01" step="0.01" placeholder="Qty" required value={l.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} style={{ border: "1px solid var(--line)", borderRadius: 6, padding: "0.5rem 0.6rem" }} />
                <input type="number" min="0" step="0.01" placeholder="Unit price" required value={l.unitPrice} onChange={(e) => updateLine(i, { unitPrice: e.target.value })} style={{ border: "1px solid var(--line)", borderRadius: 6, padding: "0.5rem 0.6rem" }} />
                <select value={l.vatRate} onChange={(e) => updateLine(i, { vatRate: e.target.value })} style={{ border: "1px solid var(--line)", borderRadius: 6, padding: "0.5rem 0.6rem" }}>
                  <option value="0.05">5% VAT</option>
                  <option value="0">0%</option>
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
              <textarea rows={2} value={poNotes} onChange={(e) => setPoNotes(e.target.value)} />
            </div>

            <div style={{ fontSize: "0.85rem", color: "var(--ink-soft)", marginBottom: "1rem" }}>
              Subtotal {formatMoney(poTotals.base)} + VAT {formatMoney(poTotals.vat)} ={" "}
              <strong style={{ color: "var(--ink)" }}>Total {formatMoney(poTotals.total)} AED</strong>
            </div>

            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Creating..." : "Create purchase order"}
            </button>
          </form>
        </div>
      )}

      {receivingPo && (
        <div className="panel">
          <div className="panel-head">
            <h2>Receive shipment — {receivingPo.poNumber}</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => setReceivingPo(null)}>
              <X /> Close
            </button>
          </div>
          {error && <div className="form-error">{error}</div>}
          <form onSubmit={submitReceive}>
            <div className="table-wrap" style={{ marginBottom: "1rem" }}>
              <table>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th className="num">Ordered</th>
                    <th className="num">Already received</th>
                    <th className="num">Receiving now</th>
                  </tr>
                </thead>
                <tbody>
                  {receivingPo.items.map((item) => {
                    const remaining = round2(Number(item.quantityOrdered) - Number(item.quantityReceived));
                    return (
                      <tr key={item.id}>
                        <td>{item.description}</td>
                        <td className="num">{item.quantityOrdered}</td>
                        <td className="num">{item.quantityReceived}</td>
                        <td className="num">
                          <input
                            type="number"
                            min="0"
                            max={remaining}
                            step="0.01"
                            value={receiveQtys[item.id] ?? "0"}
                            onChange={(e) => setReceiveQtys((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            style={{ width: "90px", border: "1px solid var(--line)", borderRadius: 6, padding: "0.35rem 0.5rem", textAlign: "right" }}
                            disabled={remaining <= 0}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Recording..." : "Confirm receipt"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
