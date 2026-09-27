import { desc } from "drizzle-orm";
import { db } from "@/db";
import { aiInsights } from "@/db/schema";
import { requireUser } from "@/lib/require-user";
import AiInsightsManager from "@/components/AiInsightsManager";

export default async function AiInsightsPage() {
  const user = await requireUser();
  const history = await db.select().from(aiInsights).orderBy(desc(aiInsights.createdAt)).limit(10);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>AI Insights</h1>
          <p>Claude reviews the current transactions, cash, invoices and inventory data and writes a short commentary — not a substitute for your own judgement, a starting point for it.</p>
        </div>
      </div>
      <AiInsightsManager history={history} canGenerate={user.role === "admin"} />
    </>
  );
}
