"use client"

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"

export function GenresBar({ data }: { data: Record<string, number> }) {
  const chartData = Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([label, value]) => ({ label, value }))

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
        <XAxis type="number" tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="label" width={90} tick={{ fill: "#a1a1aa", fontSize: 12 }} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "#fff" }}
          itemStyle={{ color: "#a1a1aa" }}
        />
        <Bar dataKey="value" name="Count" radius={[0, 3, 3, 0]} fill="#ed1c24" />
      </BarChart>
    </ResponsiveContainer>
  )
}
