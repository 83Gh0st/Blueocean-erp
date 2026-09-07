import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { departments, expenseHeads, paymentModes, users } from "./schema";
import bcrypt from "bcryptjs";

// Same reason as migrate.ts: a standalone tsx script never sees
// .env.local unless it's loaded explicitly.
config({ path: ".env.local" });

// Departments, expense heads, and payment modes below are taken directly
// from the reference app's own seed data — this is the reference/config
// data that was actually designed through discussion with Blue Ocean, so
// it's preserved exactly rather than reinvented.
//
// Staff members (Yoosuf, Azeez, Sasi, Pradeep, Musthafa) and "BOC" (the
// company's own general cash float, not an individual) are NOT auto-
// created as login accounts here — inventing email addresses and
// passwords for real people isn't something to do without them. Create
// their accounts for real from the Staff Accounts screen once this is
// deployed and you're logged in as the admin seeded below.

const DEPARTMENTS = ["ADMINISTRATION", "PRODUCTION"];
const PAYMENT_MODES = ["CASH", "CARD", "BANK"];
const EXPENSE_HEADS: [string, string][] = [
  ["MISCELLANEOUS-ADMIN", "ADMINISTRATION"],
  ["PETROL-ADMIN", "ADMINISTRATION"],
  ["INCIDENTAL (FOOD ETC...)-ADMIN", "ADMINISTRATION"],
  ["MANPOWER-ADMIN", "ADMINISTRATION"],
  ["WAREHOUSE-ADMIN", "ADMINISTRATION"],
  ["MOBILE AND INTERNET-ADMIN", "ADMINISTRATION"],
  ["PACKAGING MATERIALS-PROD", "PRODUCTION"],
  ["TRANSPORT-RM-PROD", "PRODUCTION"],
  ["RM PURCHASE-PROD", "PRODUCTION"],
  ["TRANSPORTATION-PROD", "PRODUCTION"],
];

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");

  const adminName = process.env.SEED_ADMIN_NAME;
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminName || !adminEmail || !adminPassword) {
    throw new Error(
      "Set SEED_ADMIN_NAME, SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD before seeding " +
        "(e.g. SEED_ADMIN_NAME='Arjun' SEED_ADMIN_EMAIL='you@company.com' SEED_ADMIN_PASSWORD='...' npm run db:seed) " +
        "so the first login is a real credential you chose, not a hardcoded default."
    );
  }
  if (adminPassword.length < 8) throw new Error("SEED_ADMIN_PASSWORD must be at least 8 characters.");

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql, { schema });

  const existingDepts = await db.select().from(departments).limit(1);
  if (existingDepts.length > 0) {
    console.log("Departments already exist — skipping master-data seed (only runs on an empty database).");
  } else {
    const deptRows = await db.insert(departments).values(DEPARTMENTS.map((name) => ({ name }))).returning();
    const deptIdByName = new Map(deptRows.map((d) => [d.name, d.id]));

    await db.insert(paymentModes).values(PAYMENT_MODES.map((name) => ({ name })));

    await db.insert(expenseHeads).values(
      EXPENSE_HEADS.map(([name, deptName]) => ({ name, departmentId: deptIdByName.get(deptName)! }))
    );
    console.log(`Seeded ${DEPARTMENTS.length} departments, ${PAYMENT_MODES.length} payment modes, ${EXPENSE_HEADS.length} expense heads.`);
  }

  const existingAdmin = await db.select().from(users).limit(1);
  if (existingAdmin.length > 0) {
    console.log("A user already exists — skipping admin creation.");
  } else {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await db.insert(users).values({ name: adminName, email: adminEmail.toLowerCase(), passwordHash, role: "admin" });
    console.log(`Created admin account for ${adminEmail}.`);
  }

  console.log("Seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
