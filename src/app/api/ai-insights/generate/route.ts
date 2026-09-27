import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { generateAiInsight } from "@/lib/ai-insights";

// Admin-only, on purpose: generating an insight is a real API call with a
// real (small) cost, not a free page load — restricting who can trigger
// it keeps that cost predictable rather than firing on every visit.
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Only an admin can generate a new insight." }, { status: 403 });

  try {
    const insight = await generateAiInsight();
    return NextResponse.json({ insight });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong generating the insight.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
