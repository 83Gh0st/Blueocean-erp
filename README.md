# Blue Ocean Internal — Accounting

A staff accounting tool for Blue Ocean Chemicals: expense transactions
(with automatic 5% VAT), a per-person cash ledger, and shared master data
(departments, expense heads, payment modes) — with real per-user login
and an audit trail on every transaction.

This doc is written assuming you haven't done this kind of setup before.
If a section feels too basic, skip ahead.

---

## Part 1 — The big picture

Four pieces, and how they talk to each other:

1. **The database (Neon Postgres)** — where every transaction, cash
   entry, and staff account actually lives, permanently. This is the one
   piece that isn't "the app" — it's a separate service your app talks to.
2. **The app (this Next.js project)** — the actual code: the pages you
   see, the forms, the logic that calculates VAT, the login system.
3. **Drizzle (the ORM)** — a translation layer inside the app. Your code
   says things like `db.select().from(transactions)`, and Drizzle turns
   that into real SQL and sends it to Neon. Without it you'd be
   hand-writing SQL strings everywhere.
4. **Vercel** — where the app is *hosted* once it's built — it runs your
   Next.js code and serves it as a website. Vercel and Neon are separate
   companies/services; Vercel just makes it one click to connect them.

**A migration**, one term worth knowing up front: `src/db/schema.ts` is
the description of what your database *should* look like (which tables,
which columns). A migration is the generated SQL that makes a real,
empty database actually match that description. You write the schema
once in TypeScript; the migration is how it becomes real tables.

---

## Part 2 — Why Neon, not Supabase

You asked about this, so here's the actual comparison, not just an
opinion:

|  | Neon | Supabase |
|---|---|---|
| Free storage | 0.5 GB | 500 MB (same number) |
| When idle | Scales to zero, **wakes up automatically** on the next request (a few seconds' delay) | **Pauses entirely after 7 days idle** — needs a manual click in the Supabase dashboard to resume |
| Paid pricing | Pay only for what you use above free tier | $25/month flat minimum on Pro, even if usage is tiny |

For an internal tool that a handful of staff use on and off — including
stretches where nobody logs in for a week — Neon's auto-wake is a real
practical advantage over Supabase's manual-unpause requirement. And
since both give you the same 0.5GB, moving to Supabase wouldn't actually
solve the storage worry that prompted the question — a company logging
a few hundred to a couple thousand expense entries a year would take
**decades** to approach 0.5GB (that limit covers low-to-mid *millions*
of rows of the size this app produces).

If you still want Supabase later, it's a small, contained change —
Drizzle's queries don't change at all, only `src/db/index.ts` (12 lines,
swapping the connection driver) and the connection string. Not a
rewrite.

---

## Part 3 — Setup, start to finish

### 3.1 Create the database

1. Go to your Vercel dashboard → **Storage** → **Create Database** →
   **Marketplace Database Storage** → choose **Neon**.
   ("Vercel Postgres" as its own product was retired — Neon via the
   Marketplace is the current path, and it's what actually gets used
   once you deploy.)
2. Once created, copy the connection string it gives you (starts with
   `postgresql://`).

### 3.2 Local setup

```bash
npm install
cp .env.example .env.local
```

Open `.env.local` in a text editor and fill in:
- `DATABASE_URL` — paste the real connection string from step 3.1
- `SESSION_SECRET` — generate one with `openssl rand -base64 48` (Mac/Linux/WSL) or just mash the keyboard for 40+ random characters — this signs login sessions, so it needs to be unguessable, not memorable.

Now build the actual tables in your database, and load the starting data:

```bash
npm run db:migrate
```

This reads the migration file already generated in `src/db/migrations/`
and creates all 13 tables in your Neon database. (`npm run db:generate`
is only needed again if you edit `src/db/schema.ts` later — it's what
turns a schema change into a new migration file.)

```bash
SEED_ADMIN_NAME="Your Name" SEED_ADMIN_EMAIL="you@company.com" SEED_ADMIN_PASSWORD="choose-a-real-password" npm run db:seed
```

This does two things: loads the departments/expense-heads/payment-modes
that were actually designed with the business (taken directly from the
original reference app), and creates one admin login — yours, with
whatever email and password you put above. It refuses to run if you
leave the placeholder values in.

```bash
npm run dev
```

Visit `http://localhost:3000/login` and sign in with the admin account
you just created.

**Add real staff accounts from the Staff Accounts screen once you're
logged in.** The people who used to just be names in a dropdown —
Yoosuf, Azeez, Sasi, Pradeep, Musthafa, and "BOC" (the company's own
general cash float, not an individual person) — are not auto-created as
logins. Inventing email addresses and passwords for real people without
them isn't something to do quietly; create each one for real, with their
actual email, and share the password with them directly (not over
email or chat).

### 3.3 Deploy to Vercel

1. Push this project to its own git repository — **separate from the
   marketing site's repo**, since this is a standalone project.
2. In Vercel, **Add New Project**, import that repository.
3. Storage tab → link the same Neon database from step 3.1 to this
   project. This auto-injects `DATABASE_URL` for you in production.
4. Add `SESSION_SECRET` yourself under Settings → Environment
   Variables (Vercel doesn't generate this one automatically).
5. Deploy.
6. Run the migration and seed **once**, pointed at production — easiest
   way is to temporarily put the production `DATABASE_URL` in your local
   `.env.local` and run `npm run db:migrate` / `npm run db:seed` from
   your own machine, then put your real local one back.

### 3.4 Domain: subpath vs. subdomain

You mentioned `blueoceanchemicals.com/internal`. A *subpath* pointing at
a *separately deployed* Vercel project needs either
[Next.js Multi-Zones](https://nextjs.org/docs/app/building-your-application/deploying/multi-zones)
or rewrite rules added to the marketing site's own config — an extra
piece of wiring connecting two independent codebases.

A **subdomain** (`internal.blueoceanchemicals.com`) gets the same
result — separate deployment, still feels like one company — with just
one DNS record (a CNAME pointing at Vercel) and no cross-project
configuration at all. Worth using unless the exact `/internal` path
specifically matters to you.

---

## Part 4 — How a request actually flows through this app

Walking through one concrete example — you log in and add a transaction:

1. You submit the login form. It sends your email/password to
   `/api/auth/login` (`src/app/api/auth/login/route.ts`).
2. That route checks the password against the stored hash (`bcrypt` —
   your real password is never stored anywhere, only a one-way hash of
   it), creates a random session token, stores a *hash* of that token in
   the `sessions` table, and sends the real token back to your browser
   as a cookie.
3. Every page under `src/app/(app)/` is guarded by
   `src/app/(app)/layout.tsx`, which calls `requireUser()`. That reads
   your session cookie, looks up the matching session in the database,
   and either lets you through or redirects to `/login`.
4. You fill out the transaction form and submit. It sends the data to
   `/api/transactions` (`POST`), which:
   - checks you're logged in
   - calculates VAT (5% — `src/lib/money.ts`)
   - inserts the row, attributed to *you* (`personId`/`createdBy` are
     your own user ID, taken from the session — not a free-text field
     you could accidentally mistype)
   - writes a second row to `transaction_audit_log` recording exactly
     what was created and by whom
5. The page refreshes and the Server Component re-queries the database
   directly (no separate API call needed for *reading* — only for
   *changing* something) and shows your new transaction in the table.

That's the shape of every feature in this app: a Server Component reads
and displays data; a form posts to an API route to change something; the
API route always re-checks who's logged in before doing anything.

---

## Part 5 — Common tasks, once deployed

- **Add a staff member**: log in as admin → Staff Accounts → New
  account. Share the password with them directly; they can change it
  from My Account afterwards.
- **Deactivate someone who's left**: Staff Accounts → Deactivate. This
  also immediately ends any session they're currently logged into —
  they don't stay signed in until it naturally expires.
- **Add a new expense head or department**: Master Data. Deactivating an
  old one hides it from new entries without touching any past
  transaction that already used it.
- **Correct a mistaken transaction**: edit it directly from
  Transactions — the audit log keeps the original values, so the
  correction is visible, not hidden.
- **Delete a transaction**: admin-only, on purpose — staff can log and
  correct their own entries, but outright removal needs a more
  deliberate gate.
- **Invoice a customer**: Billing → New invoice, add line items — the
  PDF (download icon on each row) is a real tax invoice, generated on
  demand, not stored as a file. Mark it Sent once it's gone out, Paid
  once it's settled. Only a Draft can be deleted outright; anything
  further along gets Cancelled instead, so the invoice number and record
  stay intact (useful once a number's been quoted to a customer).
- **Track stock**: Inventory → New item to start tracking something
  (unit is free text — Kg, Ltr, Pail, Can, whatever actually applies).
  Log movement for every time stock changes: **Receipt** (goods in from a
  supplier), **Production** (finished goods coming out of manufacturing),
  or **Consumption** (raw material used, or goods going out). Current
  stock, and the running opening/closing balance shown in the Stock
  Ledger below it, update automatically from these — you never edit the
  stock number directly.

---

## What's built vs. what's next

**Working end to end**: real per-user login, Master Data, Transactions
(with VAT and full audit trail), Cash Ledger, Staff Accounts, **Billing
(customer invoices with real UAE tax-invoice PDFs and a
draft→sent→paid/cancelled status workflow)**, **Inventory (raw materials
and finished goods, stock movements, low-stock alerts)**.

**Next up**: Procurement (formal purchase orders to suppliers), HR &
Payroll (needs UAE gratuity/WPS rules verified against current sources
before the calculation logic is written — not something to guess at),
then Reports & Analytics and AI Insights once the rest of the data is
flowing.

**Before sending a real invoice**: open `src/lib/company-info.ts` and
replace the placeholder address/TRN with your real details — a UAE tax
invoice is legally required to show a real Tax Registration Number, and
what's in there now is not one.

## What's deliberately different from the reference app

- **Real login, not a shared password** — every transaction is
  attributed to whoever's actually signed in.
- **An audit trail on transactions** — every create/edit/delete keeps a
  record of who changed what and when.
- **Postgres `numeric` for money, not floating point** — the reference
  app used floats, which can't represent most decimal amounts exactly
  and drifts on large sums.
- **postgres-js over Neon's pooled connection, not the neon-http
  driver** — invoice creation (header + line items) and inventory
  movements (stock update + ledger row) both need a real
  `db.transaction()` so a failure partway through can't leave an
  invoice with no line items, or a stock count out of sync with its own
  movement log. The HTTP driver is stateless (one request at a time,
  no persistent connection), so it can't hold a multi-statement
  transaction open at all — worth knowing if you extend this further:
  anything that needs multiple related writes to succeed or fail
  together needs to go through `db.transaction()`, which only works with
  this driver setup.
- **Neon Postgres instead of a local SQLite file** — required for
  Vercel's stateless hosting; also means real managed backups instead of
  the reference app's local-folder backup feature (which has no
  equivalent here, and doesn't need one).

## Troubleshooting

- **"No transactions support in neon-http driver"**: this was a real bug
  in an earlier version — invoice creation and inventory movements both
  need `db.transaction()`, which the HTTP driver can't do at all. Fixed
  as of this version by switching to `postgres-js` over Neon's pooled
  connection. If you already ran `db:migrate` with the old inventory
  schema and logged any test movements, running the new migration will
  fail on those rows (it adds required columns with no default, and
  changes the movement-type values from in/out to
  receipt/production/consumption) — easiest fix at this stage is to drop
  and recreate the database in Neon's dashboard and re-run
  `db:migrate`/`db:seed` from scratch, since there's no real data to
  preserve yet.

- **"DATABASE_URL is not set" when running `npm run dev`**: make sure
  `.env.local` exists (copied from `.env.example`) and has a real
  connection string, not the placeholder.
- **Same error from `npm run db:migrate` or `db:seed` specifically,
  even though `npm run dev` works fine**: this was a real bug in an
  earlier version of this project (those two scripts never loaded
  `.env.local` at all) — already fixed as of this version. If you still
  see it, confirm you're running the command from this project's folder,
  not a parent folder.
- **"Next.js inferred your workspace root... may not be correct"**:
  harmless, but silenced in this version via `outputFileTracingRoot` in
  `next.config.mjs` — caused by another `package-lock.json` sitting in a
  parent folder (common if you've downloaded multiple projects into the
  same folder on Windows).
