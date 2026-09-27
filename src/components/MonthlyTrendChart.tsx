"use client";

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

export default function MonthlyTrendChart({ data }: { data: { month: string; expenses: number; revenue: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--ink-soft)" }} />
        <YAxis tick={{ fontSize: 11, fill: "var(--ink-soft)" }} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
        <Tooltip
          formatter={(value: number) => new Intl.NumberFormat("en-AE", { minimumFractionDigits: 2 }).format(value) + " AED"}
          contentStyle={{ fontSize: "0.82rem", borderRadius: 8, border: "1px solid var(--line)" }}
        />
        <Legend wrapperStyle={{ fontSize: "0.8rem" }} />
        <Line type="monotone" dataKey="revenue" name="Revenue" stroke="var(--sky)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="expenses" name="Expenses" stroke="var(--danger)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
