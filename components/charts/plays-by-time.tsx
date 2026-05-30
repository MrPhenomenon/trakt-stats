"use client"

import { useState } from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import Image from "next/image"

type Tab = "by_year" | "by_month" | "by_day_of_week" | "by_hour"
type ContentType = "movies" | "tv"

const TABS: { key: Tab; label: string; period: string }[] = [
  { key: "by_year",        label: "Year",  period: "year" },
  { key: "by_month",       label: "Month", period: "month" },
  { key: "by_day_of_week", label: "Day",   period: "dayofweek" },
  { key: "by_hour",        label: "Hour",  period: "hour" },
]

interface MovieResult {
  title: string
  poster: string | null
  watchedAt: string
  rating: number | null
}

interface ShowResult {
  title: string
  poster: string | null
  count: number
  episodes: string[]
}

interface Props {
  data: Record<Tab, Record<string, number>>
  type: ContentType
}

export function PlaysByTimeCharts({ data, type }: Props) {
  const [tab, setTab] = useState<Tab>("by_year")
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<MovieResult[] | ShowResult[] | null>(null)

  const currentTab = TABS.find((t) => t.key === tab)!
  const chartData = Object.entries(data[tab]).map(([label, value]) => ({ label, value }))
  const max = Math.max(...chartData.map((d) => d.value))

  async function handleBarClick(label: string) {
    if (selected === label) {
      setSelected(null)
      setResults(null)
      return
    }
    setSelected(label)
    setLoading(true)
    setResults(null)
    try {
      const res = await fetch(
        `/api/stats/history?type=${type}&period=${currentTab.period}&value=${encodeURIComponent(label)}`
      )
      setResults(await res.json())
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  function handleTabChange(newTab: Tab) {
    setTab(newTab)
    setSelected(null)
    setResults(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => handleTabChange(t.key)}
            className={`rounded-md px-3 py-1 text-sm transition ${
              tab === t.key
                ? "bg-[#ed1c24] text-white"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
          <XAxis
            dataKey="label"
            tick={{ fill: "#71717a", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval={tab === "by_year" ? "preserveStartEnd" : 0}
          />
          <YAxis tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={false}
            contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "#fff" }}
            itemStyle={{ color: "#a1a1aa" }}
          />
          <Bar
            dataKey="value"
            name="Plays"
            radius={[3, 3, 0, 0]}
            cursor="pointer"
            onClick={(d) => handleBarClick((d as unknown as { label: string }).label)}
          >
            {chartData.map((d, i) => (
              <Cell
                key={i}
                fill={
                  d.label === selected
                    ? "#fff"
                    : d.value === max
                    ? "#ed1c24"
                    : "#3f3f46"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {selected && (
        <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white">
              {selected} · {data[tab][selected] ?? 0} {type === "movies" ? "movies" : "episodes"}
            </span>
            <button onClick={() => { setSelected(null); setResults(null) }} className="text-zinc-500 hover:text-white text-lg leading-none">×</button>
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-600 border-t-white" />
              Loading…
            </div>
          )}

          {results && type === "movies" && (
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
              {(results as MovieResult[]).map((m, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="relative w-8 h-12 shrink-0 rounded overflow-hidden bg-zinc-800">
                    {m.poster && (
                      <Image src={`https://image.tmdb.org/t/p/w92${m.poster}`} alt={m.title} fill className="object-cover" />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm text-white truncate">{m.title}</span>
                    <span className="text-xs text-zinc-500">
                      {new Date(m.watchedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      {m.rating ? ` · ★ ${m.rating}` : ""}
                    </span>
                  </div>
                </div>
              ))}
              {(results as MovieResult[]).length === 0 && (
                <p className="text-sm text-zinc-600">No watches found</p>
              )}
            </div>
          )}

          {results && type === "tv" && (
            <div className="flex flex-col gap-3 max-h-72 overflow-y-auto pr-1">
              {(results as ShowResult[]).map((s, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="relative w-8 h-12 shrink-0 rounded overflow-hidden bg-zinc-800">
                    {s.poster && (
                      <Image src={`https://image.tmdb.org/t/p/w92${s.poster}`} alt={s.title} fill className="object-cover" />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm text-white truncate">{s.title}</span>
                    <span className="text-xs text-zinc-500">{s.count} episode{s.count !== 1 ? "s" : ""}</span>
                    {s.episodes.map((ep, j) => (
                      <span key={j} className="text-xs text-zinc-600 truncate">{ep}</span>
                    ))}
                  </div>
                </div>
              ))}
              {(results as ShowResult[]).length === 0 && (
                <p className="text-sm text-zinc-600">No episodes found</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
