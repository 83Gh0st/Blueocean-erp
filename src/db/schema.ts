import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  numeric,
  boolean,
  timestamp,
  date,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";

// ─────────────────────────────────────────────────────────────────────────
// Users & sessions
//
// The reference app had no login system — "person" was a free-text
// dropdown with no connection to who was actually using the app, so
// nothing recorded who created or edited a record. Fixing that is the
// main structural change from the reference: every staff member gets a
// real account, and that account IS the "person" a transaction or cash
// entry is attributed to — one concept instead of two disconnected ones.
// ─────────────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", ["admin", "staff"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 200 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("staff"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // A hash of the token, not the token itself — matches the reference
  // site's marketing-portal pattern of never storing a usable secret at
  // rest, so a database read alone can't be used to forge a session.
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────
// Master data — departments, expense heads, payment modes.
// Same shape as the reference app's master tables (minus "persons",
// which users[] now covers).
// ─────────────────────────────────────────────────────────────────────────

export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const paymentModes = pgTable("payment_modes", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const expenseHeads = pgTable("expense_heads", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 150 }).notNull(),
  departmentId: integer("department_id")
    .notNull()
    .references(() => departments.id, { onDelete: "restrict" }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────
// Transactions — the core, most-used table. numeric (not float) for money:
// the reference app used floats for amounts, which is a real correctness
// risk for financial totals (binary floating point can't represent most
// decimal amounts exactly, so sums can drift by fractions of a cent).
// Postgres numeric is exact.
// ─────────────────────────────────────────────────────────────────────────

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  personId: integer("person_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  description: text("description").notNull(),
  departmentId: integer("department_id")
    .notNull()
    .references(() => departments.id, { onDelete: "restrict" }),
  expenseHeadId: integer("expense_head_id")
    .notNull()
    .references(() => expenseHeads.id, { onDelete: "restrict" }),
  invoiceNo: varchar("invoice_no", { length: 100 }).default(""),
  trn: varchar("trn", { length: 100 }).default(""),
  baseAmount: numeric("base_amount", { precision: 12, scale: 2 }).notNull(),
  vatAmount: numeric("vat_amount", { precision: 12, scale: 2 }).notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  paymentModeId: integer("payment_mode_id")
    .notNull()
    .references(() => paymentModes.id, { onDelete: "restrict" }),
  createdBy: integer("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  updatedBy: integer("updated_by").references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// One row per create/edit/delete on a transaction, keeping the full
// before/after so a change can always be explained later — the audit
// trail the reference app didn't have.
export const transactionAuditLog = pgTable("transaction_audit_log", {
  id: serial("id").primaryKey(),
  transactionId: integer("transaction_id").notNull(),
  action: varchar("action", { length: 10 }).notNull(), // create / update / delete
  changedBy: integer("changed_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  oldValues: jsonb("old_values"),
  newValues: jsonb("new_values"),
  changedAt: timestamp("changed_at").notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────
// Cash ledger — running balance per person (now: per user).
// ─────────────────────────────────────────────────────────────────────────

export const cashEntries = pgTable("cash_entries", {
  id: serial("id").primaryKey(),
  personId: integer("person_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  date: date("date").notNull(),
  openingBalance: numeric("opening_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  received: numeric("received", { precision: 12, scale: 2 }).notNull().default("0"),
  spent: numeric("spent", { precision: 12, scale: 2 }).notNull().default("0"),
  closingBalance: numeric("closing_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  description: text("description").default(""),
  createdBy: integer("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────
// Phase 2+ tables — schema defined now so the foundation doesn't need
// disruptive migrations later, even though this delivery doesn't build
// UI/API for these yet: Billing, Inventory, AI Insights.
// ─────────────────────────────────────────────────────────────────────────

export const invoiceStatusEnum = pgEnum("invoice_status", ["draft", "sent", "paid", "cancelled"]);

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNo: varchar("invoice_no", { length: 50 }).notNull().unique(),
  date: date("date").notNull(),
  clientName: varchar("client_name", { length: 200 }).notNull(),
  clientEmail: varchar("client_email", { length: 200 }).default(""),
  clientPhone: varchar("client_phone", { length: 50 }).default(""),
  clientAddr: text("client_addr").default(""),
  notes: text("notes").default(""),
  baseAmount: numeric("base_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  vatAmount: numeric("vat_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  status: invoiceStatusEnum("status").notNull().default("draft"),
  dueDate: date("due_date"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const invoiceItems = pgTable("invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull().default("1"),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  vatRate: numeric("vat_rate", { precision: 4, scale: 3 }).notNull().default("0.05"),
  lineTotal: numeric("line_total", { precision: 12, scale: 2 }).notNull(),
});

export const inventoryItems = pgTable("inventory_items", {
  id: serial("id").primaryKey(),
  itemName: varchar("item_name", { length: 200 }).notNull().unique(),
  category: varchar("category", { length: 100 }).default(""),
  // Free text on purpose (Kg, Ltr, Pail, Can, Drum, Bag, ...) rather than
  // a fixed list — the units a chemical manufacturer actually uses for
  // raw materials and packaged finished goods vary more than a small
  // preset dropdown can predict.
  unit: varchar("unit", { length: 30 }).default(""),
  currentStock: numeric("current_stock", { precision: 12, scale: 2 }).notNull().default("0"),
  minStock: numeric("min_stock", { precision: 12, scale: 2 }).notNull().default("0"),
  maxStock: numeric("max_stock", { precision: 12, scale: 2 }).notNull().default("0"),
  // The item's current/standard cost per unit — used as the default
  // price on a new movement (receipts especially), and to value stock on
  // hand (currentStock × unitPrice) on the stock overview.
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
});

// Receipt: stock arriving from a supplier (raw materials purchased).
// Production: stock arriving from manufacturing (finished goods made).
// Consumption: stock leaving — raw material used in production, or
// finished goods dispatched. Receipt and Production both increase
// stock; Consumption decreases it.
export const inventoryMovementTypeEnum = pgEnum("movement_type", ["receipt", "consumption", "production"]);

export const inventoryMovements = pgTable("inventory_movements", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id")
    .notNull()
    .references(() => inventoryItems.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  movementType: inventoryMovementTypeEnum("movement_type").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  // Stored directly on the row (computed once, at insert time) rather
  // than recalculated on every read — same pattern as the Cash Ledger's
  // opening/closing balance, and for the same reason: a ledger view
  // should show exactly what the balance was at that moment, not a
  // number that shifts if earlier history is later edited.
  openingStock: numeric("opening_stock", { precision: 12, scale: 2 }).notNull(),
  closingStock: numeric("closing_stock", { precision: 12, scale: 2 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
  totalPrice: numeric("total_price", { precision: 12, scale: 2 }).notNull().default("0"),
  vatAmount: numeric("vat_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  grandTotal: numeric("grand_total", { precision: 12, scale: 2 }).notNull().default("0"),
  transactionId: integer("transaction_id").references(() => transactions.id, { onDelete: "set null" }),
  notes: text("notes").default(""),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const aiInsights = pgTable("ai_insights", {
  id: serial("id").primaryKey(),
  period: varchar("period", { length: 20 }).notNull(),
  insight: text("insight").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────
// Procurement — suppliers and purchase orders. Not in the reference app
// at all; added because raw-material purchasing is a real, named part of
// Blue Ocean's own expense categories (RM PURCHASE-PROD). Receiving a PO
// line that's linked to an inventory item creates a real inventory
// Receipt movement automatically — the point of a formal PO step is
// exactly this: procurement and inventory should agree with each other,
// not be two separate records someone has to keep in sync by hand.
// ─────────────────────────────────────────────────────────────────────────

export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull().unique(),
  contactPerson: varchar("contact_person", { length: 150 }).default(""),
  phone: varchar("phone", { length: 50 }).default(""),
  email: varchar("email", { length: 200 }).default(""),
  address: text("address").default(""),
  trn: varchar("trn", { length: 50 }).default(""),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const poStatusEnum = pgEnum("po_status", ["draft", "sent", "partially_received", "received", "cancelled"]);

export const purchaseOrders = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  poNumber: varchar("po_number", { length: 50 }).notNull().unique(),
  supplierId: integer("supplier_id")
    .notNull()
    .references(() => suppliers.id, { onDelete: "restrict" }),
  date: date("date").notNull(),
  expectedDate: date("expected_date"),
  notes: text("notes").default(""),
  baseAmount: numeric("base_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  vatAmount: numeric("vat_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  status: poStatusEnum("status").notNull().default("draft"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: serial("id").primaryKey(),
  poId: integer("po_id")
    .notNull()
    .references(() => purchaseOrders.id, { onDelete: "cascade" }),
  // Optional on purpose — a PO line for something one-off (a service, a
  // repair) doesn't need to correspond to a tracked inventory item.
  itemId: integer("item_id").references(() => inventoryItems.id, { onDelete: "set null" }),
  description: varchar("description", { length: 200 }).notNull(),
  quantityOrdered: numeric("quantity_ordered", { precision: 12, scale: 2 }).notNull(),
  quantityReceived: numeric("quantity_received", { precision: 12, scale: 2 }).notNull().default("0"),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  vatRate: numeric("vat_rate", { precision: 4, scale: 3 }).notNull().default("0.05"),
  lineTotal: numeric("line_total", { precision: 12, scale: 2 }).notNull(),
});
