import { NextResponse, type NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { cashEntries, users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { round2 } from "@/lib/money";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: cashEntries.id,
      date: cashEntries.date,
      openingBalance: cashEntries.openingBalance,
      received: cashEntries.received,
      spent: cashEntries.spent,
      closingBalance: cashEntries.closingBalance,
      description: cashEntries.description,
      personId: cashEntries.personId,
      personName: users.name,
    })
    .from(cashEntries)
    .innerJoin(users, eq(cashEntries.personId, users.id))
    .orderBy(desc(cashEntries.date), desc(cashEntries.id))
    .limit(500);

  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { date, personId, received, spent, description } = body ?? {};
  if (!date || !personId) return NextResponse.json({ error: "Date and person are required." }, { status: 400 });

  const receivedNum = Number(received) || 0;
  const spentNum = Number(spent) || 0;
  if (receivedNum < 0 || spentNum < 0) {
    return NextResponse.json({ error: "Amounts can't be negative." }, { status: 400 });
  }

  // Opening balance for this entry = this person's most recent closing
  // balance (0 if they have no prior entries) — carried forward
  // automatically so nobody has to remember or re-key it.
  const lastRows = await db
    .select({ closingBalance: cashEntries.closingBalance })
    .from(cashEntries)
    .where(eq(cashEntries.personId, Number(personId)))
    .orderBy(desc(cashEntries.date), desc(cashEntries.id))
    .limit(1);

  const opening = lastRows[0] ? Number(lastRows[0].closingBalance) : 0;
  const closing = round2(opening + receivedNum - spentNum);

  const [row] = await db
    .insert(cashEntries)
    .values({
      date,
      personId: Number(personId),
      openingBalance: opening.toFixed(2),
      received: receivedNum.toFixed(2),
      spent: spentNum.toFixed(2),
      closingBalance: closing.toFixed(2),
      description: description ?? "",
      createdBy: user.id,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
