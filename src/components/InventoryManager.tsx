"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

type Item = { id: number; itemName: string; category: string | null; unit: string | null; currentStock: string; minStock: string; maxStock: string };
type Movement = {
  id: number;
  date: string;
  quantity: string;
  movementType: "in" | "out";
  notes: string | null;
  itemId: number;
  itemName: string;
  unit: string | null;
  createdByName: string | null;
};

export default function InventoryManager({ initialItems, initialMovements }: { initialItems: Item[]; initialMovements: Movement[] }) {
  const router = useRouter();
  const [showItemForm, setShowItemForm] = useState(false);
  const [showMoveForm, setShowMoveForm] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("KG");
  const [minStock, setMinStock] = useState("");
  const [maxStock, setMaxStock] = useState("");
  const [openingStock, setOpeningStock] = useState("");

  const [moveItemId, setMoveItemId] = useState<number | string>(initialItems[0]?.id ?? "");
  const [moveType, setMoveType] = useState<"in" | "out">("in");
  const [moveQty, setMoveQty] = useState("");
  const [moveDate, setMoveDate] = useState(new Date().toISOString().slice(0, 10));
  const [moveNotes, setMoveNotes] = useState("");

  const lowStockCount = useMemo(() => initialItems.filter((i) => Number(i.currentStock) <= Number(i.minStock)).length, [initialItems]);

  async function handleCreateItem(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/inventory/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemName, category, unit, minStock: minStock || 0, maxStock: maxStock || 0, openingStock: openingStock || 0 }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    setShowItemForm(false);
    setItemName("");
    setCategory("");
    setMinStock("");
    setMaxStock("");
    setOpeningStock("");
    router.refresh();
  }

  async function handleCreateMovement(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/inventory/movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: Number(moveItemId), date: moveDate, quantity: Number(moveQty), movementType: moveType, notes: moveNotes }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    setShowMoveForm(false);
    setMoveQty("");
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
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Stock levels</h2>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowMoveForm(true)}>
              <ArrowDownToLine /> Log movement
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
                <th className="num">Current</th>
                <th className="num">Min</th>
                <th className="num">Max</th>
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
                    <td className="num">
                      {it.currentStock} {it.unit}
                    </td>
                    <td className="num">{it.minStock}</td>
                    <td className="num">{it.maxStock}</td>
                    <td>
                      <span className={`badge ${low ? "badge-inactive" : "badge-active"}`} style={low ? { background: "var(--danger-bg)", color: "var(--danger)" } : undefined}>
                        {low ? "Low stock" : "OK"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {initialItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-state">
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
          <h2>Recent movements</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Item</th>
                <th>Type</th>
                <th className="num">Quantity</th>
                <th>Notes</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {initialMovements.map((m) => (
                <tr key={m.id}>
                  <td>{m.date}</td>
                  <td>{m.itemName}</td>
                  <td>
                    <span className={`badge ${m.movementType === "in" ? "badge-active" : "badge-staff"}`}>{m.movementType === "in" ? "In" : "Out"}</span>
                  </td>
                  <td className="num">
                    {m.quantity} {m.unit}
                  </td>
                  <td style={{ whiteSpace: "normal", minWidth: 140 }}>{m.notes}</td>
                  <td>{m.createdByName}</td>
                </tr>
              ))}
              {initialMovements.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-state">
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
                <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                  <option value="KG">KG</option>
                  <option value="L">Litres</option>
                  <option value="PCS">Pieces</option>
                  <option value="DRUM">Drums</option>
                  <option value="BAG">Bags</option>
                </select>
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Opening stock</label>
                <input type="number" min="0" step="0.01" value={openingStock} onChange={(e) => setOpeningStock(e.target.value)} />
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
            <div className="field-row">
              <div className="field">
                <label>Item</label>
                <select required value={moveItemId} onChange={(e) => setMoveItemId(e.target.value)}>
                  {initialItems.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.itemName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Direction</label>
                <div style={{ display: "flex", gap: "0.6rem" }}>
                  <button type="button" className={`btn btn-sm ${moveType === "in" ? "btn-primary" : "btn-secondary"}`} onClick={() => setMoveType("in")} style={{ flex: 1 }}>
                    <ArrowDownToLine /> In
                  </button>
                  <button type="button" className={`btn btn-sm ${moveType === "out" ? "btn-primary" : "btn-secondary"}`} onClick={() => setMoveType("out")} style={{ flex: 1 }}>
                    <ArrowUpFromLine /> Out
                  </button>
                </div>
              </div>
              <div className="field">
                <label>Quantity</label>
                <input type="number" min="0.01" step="0.01" required value={moveQty} onChange={(e) => setMoveQty(e.target.value)} />
              </div>
              <div className="field">
                <label>Date</label>
                <input type="date" required value={moveDate} onChange={(e) => setMoveDate(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>Notes (optional)</label>
              <input value={moveNotes} onChange={(e) => setMoveNotes(e.target.value)} />
            </div>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Saving..." : "Log movement"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
