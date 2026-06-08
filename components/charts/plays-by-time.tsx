"use client"

import { useState, useEffect } from "react"
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

interface MovieResult { title: string; poster: string | null; watchedAt: string; rating: number | null }
interface ShowResult  { title: string; poster: string | null; count: number; episodes: string[] }

interface Props {
  data: Record<Tab, Record<string, number>>
  type: ContentType
}

function ResultsModal({
  label, count, type, results, loading, onClose,
}: {
  label: string
  count: number
  type: ContentType
  results: MovieResult[] | ShowResult[] | null
  loading: boolean
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full sm:max-w-lg max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-zinc-800 bg-zinc-950">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800 shrink-0">
          <div>
            <h2 className="text-lg font-semibold">{label}</h2>
            <p className="text-xs text-zinc-500">
              {count} {type === "movies" ? "movie" : "episode"}{count !== 1 ? "s" : ""}
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition text-lg leading-none p-1">✕</button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-700 border-t-white" />
            </div>
          )}

          {results && type === "movies" && (
            <div className="flex flex-col divide-y divide-zinc-800/50">
              {(results as MovieResult[]).map((m, i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <div className="relative w-8 h-12 shrink-0 rounded overflow-hidden bg-zinc-800">
                    {m.poster && (
                      <Image src={`https://image.tmdb.org/t/p/w92${m.poster}`} alt={m.title} fill sizes="32px" className="object-cover" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{m.title}</p>
                    <p className="text-xs text-zinc-500">
                      {new Date(m.watchedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      {m.rating ? ` · ★ ${m.rating}` : ""}
                    </p>
                  </div>
                </div>
              ))}
              {(results as MovieResult[]).length === 0 && (
                <p className="text-sm text-zinc-600 py-4 text-center">No watches found</p>
              )}
            </div>
          )}

          {results && type === "tv" && (
            <div className="flex flex-col divide-y divide-zinc-800/50">
              {(results as ShowResult[]).map((s, i) => (
                <div key={i} className="flex items-start gap-3 py-2">
                  <div className="relative w-8 h-12 shrink-0 rounded overflow-hidden bg-zinc-800">
                    {s.poster && (
                      <Image src={`https://image.tmdb.org/t/p/w92${s.poster}`} alt={s.title} fill sizes="32px" className="object-cover" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{s.title}</p>
                    <p className="text-xs text-zinc-500">{s.count} episode{s.count !== 1 ? "s" : ""}</p>
                    {s.episodes.map((ep, j) => (
                      <p key={j} className="text-xs text-zinc-600 truncate">{ep}</p>
                    ))}
                  </div>
                </div>
              ))}
              {(results as ShowResult[]).length === 0 && (
                <p className="text-sm text-zinc-600 py-4 text-center">No episodes found</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function PlaysByTimeCharts({ data, type }: Props) {
  const [tab, setTab]           = useState<Tab>("by_year")
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const [results, setResults]   = useState<MovieResult[] | ShowResult[] | null>(null)

  const currentTab = TABS.find((t) => t.key === tab)!
  const chartData  = Object.entries(data[tab]).map(([label, value]) => ({ label, value }))
  const max        = Math.max(...chartData.map((d) => d.value))

  async function handleBarClick(label: string) {
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

  function handleClose() {
    setSelected(null)
    setResults(null)
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => handleTabChange(t.key)}
              className={`rounded-md px-3 py-1 text-sm transition ${
                tab === t.key ? "bg-[#ed1c24] text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
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
                  fill={d.value === max ? "#ed1c24" : "#3f3f46"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {selected && (
        <ResultsModal
          label={selected}
          count={data[tab][selected] ?? 0}
          type={type}
          results={results}
          loading={loading}
          onClose={handleClose}
        />
      )}
    </>
  )
}
