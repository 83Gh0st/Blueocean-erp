"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, PackagePlus, Factory, PackageMinus } from "lucide-react";
import { formatMoney, round2 } from "@/lib/money";

type Item = {
  id: number;
  itemName: string;
  category: string | null;
  unit: string | null;
  currentStock: string;
  minStock: string;
  maxStock: string;
  unitPrice: string;
};
type Movement = {
  id: number;
  date: string;
  movementType: "receipt" | "consumption" | "production";
  quantity: string;
  openingStock: string;
  closingStock: string;
  unitPrice: string;
  totalPrice: string;
  vatAmount: string;
  grandTotal: string;
  notes: string | null;
  itemId: number;
  itemName: string;
  unit: string | null;
  createdByName: string | null;
};

const MOVEMENT_OPTIONS: { value: Movement["movementType"]; label: string; icon: typeof PackagePlus }[] = [
  { value: "receipt", label: "Receipt", icon: PackagePlus },
  { value: "production", label: "Production", icon: Factory },
  { value: "consumption", label: "Consumption", icon: PackageMinus },
];

export default function InventoryManager({ initialItems, initialMovements }: { initialItems: Item[]; initialMovements: Movement[] }) {
  const router = useRouter();
  const [showItemForm, setShowItemForm] = useState(false);
  const [showMoveForm, setShowMoveForm] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ledgerItemFilter, setLedgerItemFilter] = useState("");

  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("");
  const [minStock, setMinStock] = useState("");
  const [maxStock, setMaxStock] = useState("");
  const [openingStock, setOpeningStock] = useState("");
  const [itemUnitPrice, setItemUnitPrice] = useState("");

  const [moveItemId, setMoveItemId] = useState<number | string>(initialItems[0]?.id ?? "");
  const [moveType, setMoveType] = useState<Movement["movementType"]>("receipt");
  const [moveQty, setMoveQty] = useState("");
  const [moveDate, setMoveDate] = useState(new Date().toISOString().slice(0, 10));
  const [moveUnitPrice, setMoveUnitPrice] = useState("");
  const [moveVatRate, setMoveVatRate] = useState("0.05");
  const [moveNotes, setMoveNotes] = useState("");

  const lowStockCount = useMemo(() => initialItems.filter((i) => Number(i.currentStock) <= Number(i.minStock)).length, [initialItems]);
  const stockValue = useMemo(() => initialItems.reduce((sum, i) => sum + Number(i.currentStock) * Number(i.unitPrice), 0), [initialItems]);

  const selectedItem = useMemo(() => initialItems.find((i) => i.id === Number(moveItemId)), [initialItems, moveItemId]);

  const movePreview = useMemo(() => {
    const qty = Number(moveQty);
    const price = moveUnitPrice !== "" ? Number(moveUnitPrice) : Number(selectedItem?.unitPrice ?? 0);
    const rate = Number(moveVatRate) || 0;
    if (!Number.isFinite(qty) || qty <= 0) return null;
    const total = round2(qty * price);
    const vat = round2(total * rate);
    return { total, vat, grand: round2(total + vat) };
  }, [moveQty, moveUnitPrice, moveVatRate, selectedItem]);

  const visibleMovements = useMemo(
    () => (ledgerItemFilter ? initialMovements.filter((m) => m.itemId === Number(ledgerItemFilter)) : initialMovements),
    [initialMovements, ledgerItemFilter]
  );

  async function handleCreateItem(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/inventory/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemName, category, unit, minStock: minStock || 0, maxStock: maxStock || 0, openingStock: openingStock || 0, unitPrice: itemUnitPrice || 0 }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    setShowItemForm(false);
    setItemName("");
    setCategory("");
    setUnit("");
    setMinStock("");
    setMaxStock("");
    setOpeningStock("");
    setItemUnitPrice("");
    router.refresh();
  }

  async function handleCreateMovement(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/inventory/movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId: Number(moveItemId),
        date: moveDate,
        quantity: Number(moveQty),
        movementType: moveType,
        unitPrice: moveUnitPrice || undefined,
        vatRate: Number(moveVatRate) || 0,
        notes: moveNotes,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    setShowMoveForm(false);
    setMoveQty("");
    setMoveUnitPrice("");
    setMoveNotes("");
    router.refresh();
  }

  return (
    <>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card-label">Tracked items</div>
          <div className="stat-card-value">{initialItems.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Low stock</div>
          <div className={`stat-card-value ${lowStockCount > 0 ? "neg" : ""}`}>{lowStockCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Stock on hand (value)</div>
          <div className="stat-card-value">{formatMoney(stockValue)} AED</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Stock levels</h2>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowMoveForm(true)}>
              <Plus /> Log movement
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowItemForm(true)}>
              <Plus /> New item
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Category</th>
                <th>Unit</th>
                <th className="num">Current</th>
                <th className="num">Min</th>
                <th className="num">Max</th>
                <th className="num">Unit Price</th>
                <th className="num">Value</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {initialItems.map((it) => {
                const low = Number(it.currentStock) <= Number(it.minStock);
                return (
                  <tr key={it.id}>
                    <td>{it.itemName}</td>
                    <td>{it.category || "—"}</td>
                    <td>{it.unit}</td>
                    <td className="num">{it.currentStock}</td>
                    <td className="num">{it.minStock}</td>
                    <td className="num">{it.maxStock}</td>
                    <td className="num">{formatMoney(it.unitPrice)}</td>
                    <td className="num">{formatMoney(Number(it.currentStock) * Number(it.unitPrice))}</td>
                    <td>
                      <span className={`badge ${low ? "" : "badge-active"}`} style={low ? { background: "var(--danger-bg)", color: "var(--danger)" } : undefined}>
                        {low ? "Low stock" : "OK"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {initialItems.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty-state">
                    No inventory items yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Stock ledger</h2>
          <select value={ledgerItemFilter} onChange={(e) => setLedgerItemFilter(e.target.value)} style={{ border: "1px solid var(--line)", borderRadius: 6, padding: "0.45rem 0.6rem", fontSize: "0.82rem" }}>
            <option value="">All items</option>
            {initialItems.map((it) => (
              <option key={it.id} value={it.id}>
                {it.itemName}
              </option>
            ))}
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Item</th>
                <th className="num">Opening</th>
                <th className="num">Receipt</th>
                <th className="num">Production</th>
                <th className="num">Consumption</th>
                <th className="num">Closing</th>
                <th className="num">Unit Price</th>
                <th className="num">Total</th>
                <th className="num">VAT</th>
                <th className="num">Grand Total</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {visibleMovements.map((m) => (
                <tr key={m.id}>
                  <td>{m.date}</td>
                  <td>{m.itemName}</td>
                  <td className="num">{m.openingStock}</td>
                  <td className="num">{m.movementType === "receipt" ? `${m.quantity} ${m.unit ?? ""}` : "—"}</td>
                  <td className="num">{m.movementType === "production" ? `${m.quantity} ${m.unit ?? ""}` : "—"}</td>
                  <td className="num">{m.movementType === "consumption" ? `${m.quantity} ${m.unit ?? ""}` : "—"}</td>
                  <td className="num" style={{ fontWeight: 600 }}>
                    {m.closingStock}
                  </td>
                  <td className="num">{formatMoney(m.unitPrice)}</td>
                  <td className="num">{formatMoney(m.totalPrice)}</td>
                  <td className="num">{formatMoney(m.vatAmount)}</td>
                  <td className="num">{formatMoney(m.grandTotal)}</td>
                  <td>{m.createdByName}</td>
                </tr>
              ))}
              {visibleMovements.length === 0 && (
                <tr>
                  <td colSpan={12} className="empty-state">
                    No movements logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showItemForm && (
        <div className="panel">
          <div className="panel-head">
            <h2>New inventory item</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowItemForm(false)}>
              <X /> Close
            </button>
          </div>
          {error && <div className="form-error">{error}</div>}
          <form onSubmit={handleCreateItem}>
            <div className="field-row">
              <div className="field">
                <label>Item name</label>
                <input required value={itemName} onChange={(e) => setItemName(e.target.value)} />
              </div>
              <div className="field">
                <label>Category (optional)</label>
                <input placeholder="Raw material / Finished good" value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
              <div className="field">
                <label>Unit</label>
                <input required placeholder="Kg, Ltr, Pail, Can, Drum..." value={unit} onChange={(e) => setUnit(e.target.value)} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Opening stock</label>
                <input type="number" min="0" step="0.01" value={openingStock} onChange={(e) => setOpeningStock(e.target.value)} />
              </div>
              <div className="field">
                <label>Unit price (AED)</label>
                <input type="number" min="0" step="0.01" value={itemUnitPrice} onChange={(e) => setItemUnitPrice(e.target.value)} />
              </div>
              <div className="field">
                <label>Minimum stock (low-stock alert threshold)</label>
                <input type="number" min="0" step="0.01" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
              </div>
              <div className="field">
                <label>Maximum stock</label>
                <input type="number" min="0" step="0.01" value={maxStock} onChange={(e) => setMaxStock(e.target.value)} />
              </div>
            </div>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Creating..." : "Add item"}
            </button>
          </form>
        </div>
      )}

      {showMoveForm && (
        <div className="panel">
          <div className="panel-head">
            <h2>Log stock movement</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowMoveForm(false)}>
              <X /> Close
            </button>
          </div>
          {error && <div className="form-error">{error}</div>}
          <form onSubmit={handleCreateMovement}>
            <div className="field">
              <label>Movement type</label>
              <div style={{ display: "flex", gap: "0.6rem" }}>
                {MOVEMENT_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      className={`btn btn-sm ${moveType === opt.value ? "btn-primary" : "btn-secondary"}`}
                      onClick={() => setMoveType(opt.value)}
                      style={{ flex: 1 }}
                    >
                      <Icon /> {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Item</label>
                <select required value={moveItemId} onChange={(e) => setMoveItemId(e.target.value)}>
                  {initialItems.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.itemName} ({it.unit})
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Quantity ({selectedItem?.unit ?? "unit"})</label>
                <input type="number" min="0.01" step="0.01" required value={moveQty} onChange={(e) => setMoveQty(e.target.value)} />
              </div>
              <div className="field">
                <label>Date</label>
                <input type="date" required value={moveDate} onChange={(e) => setMoveDate(e.target.value)} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Unit price (AED) — optional, defaults to item's current price</label>
                <input type="number" min="0" step="0.01" placeholder={selectedItem?.unitPrice ?? "0.00"} value={moveUnitPrice} onChange={(e) => setMoveUnitPrice(e.target.value)} />
              </div>
              <div className="field">
                <label>VAT rate</label>
                <select value={moveVatRate} onChange={(e) => setMoveVatRate(e.target.value)}>
                  <option value="0.05">5% (typical for a supplier receipt)</option>
                  <option value="0">0% (internal movement — production/consumption)</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>Notes (optional)</label>
              <input value={moveNotes} onChange={(e) => setMoveNotes(e.target.value)} />
            </div>

            {movePreview && (
              <div style={{ fontSize: "0.85rem", color: "var(--ink-soft)", marginBottom: "1rem" }}>
                Total {formatMoney(movePreview.total)} + VAT {formatMoney(movePreview.vat)} ={" "}
                <strong style={{ color: "var(--ink)" }}>Grand Total {formatMoney(movePreview.grand)} AED</strong>
              </div>
            )}

            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Saving..." : "Log movement"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
