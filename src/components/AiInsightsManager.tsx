"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

type Insight = { id: number; period: string; insight: string; createdAt: Date };

export default function AiInsightsManager({ history, canGenerate }: { history: Insight[]; canGenerate: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/ai-insights/generate", { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    router.refresh();
  }

  const latest = history[0];

  return (
    <>
      {canGenerate && (
        <div className="panel">
          <div className="panel-head">
            <h2>Generate a new insight</h2>
            <button className="btn btn-primary btn-sm" onClick={handleGenerate} disabled={busy}>
              <Sparkles /> {busy ? "Generating..." : "Generate now"}
            </button>
          </div>
          {error && <div className="form-error">{error}</div>}
          <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)", margin: 0 }}>
            Pulls a fresh snapshot of this month's data and writes a new commentary. Each click is a real API call — generate when it's
            actually useful (weekly, or before a review), not on every visit.
          </p>
        </div>
      )}

      {!canGenerate && history.length === 0 && (
        <div className="panel">
          <p className="empty-state">No insight has been generated yet — ask an admin to generate the first one.</p>
        </div>
      )}

      {latest && (
        <div className="panel">
          <div className="panel-head">
            <h2>Latest — {latest.period}</h2>
            <span style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>{new Date(latest.createdAt).toLocaleString()}</span>
          </div>
          <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, margin: 0 }}>{latest.insight}</p>
        </div>
      )}

      {history.length > 1 && (
        <div className="panel">
          <div className="panel-head">
            <h2>History</h2>
          </div>
          {history.slice(1).map((h) => (
            <div key={h.id} style={{ padding: "0.9rem 0", borderTop: "1px solid var(--line)" }}>
              <div style={{ fontSize: "0.78rem", color: "var(--ink-soft)", marginBottom: "0.4rem" }}>
                {h.period} · {new Date(h.createdAt).toLocaleString()}
              </div>
              <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, margin: 0, fontSize: "0.9rem" }}>{h.insight}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
