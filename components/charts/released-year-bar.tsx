"use client"

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"

export function ReleasedYearBar({ data }: { data: Record<string, number> }) {
  const chartData = Object.entries(data).map(([label, value]) => ({ label, value }))
  const max = Math.max(...chartData.map((d) => d.value))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
        <XAxis
          dataKey="label"
          tick={{ fill: "#71717a", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval={4}
          angle={-45}
          textAnchor="end"
          height={40}
        />
        <YAxis tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "#fff" }}
          itemStyle={{ color: "#a1a1aa" }}
        />
        <Bar dataKey="value" name="Count" radius={[2, 2, 0, 0]}>
          {chartData.map((d, i) => (
            <Cell key={i} fill={d.value === max ? "#ed1c24" : "#3f3f46"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
