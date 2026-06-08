"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import type { HistoryItem } from "@/app/api/history/route"

const MONTH_NAMES = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"]
const DAY_LABELS = ["Su","Mo","Tu","We","Th","Fr","Sa"]

interface MonthStats { movies: number; shows: number; episodes: number }

interface CalendarProps {
  type: string
  selectedDate: string | null
  selectedMonth: { year: number; month: number }
  onSelectDate: (date: string | null) => void
  onMonthChange: (year: number, month: number) => void
}

function CalendarWidget({ type, selectedDate, selectedMonth, onSelectDate, onMonthChange }: CalendarProps) {
  const { year, month } = selectedMonth
  const [dayCounts, setDayCounts]   = useState<Record<string, number>>({})
  const [monthCounts, setMonthCounts] = useState<Record<string, number>>({})
  const [monthStats, setMonthStats]  = useState<MonthStats | null>(null)
  const [loadingCal, setLoadingCal]  = useState(true)

  useEffect(() => {
    setLoadingCal(true)
    fetch(`/api/history/calendar?year=${year}&month=${month}&type=${type}`)
      .then((r) => r.json())
      .then((d) => {
        setDayCounts(d.dayCounts)
        setMonthCounts(d.monthCounts)
        setMonthStats(d.monthStats)
      })
      .finally(() => setLoadingCal(false))
  }, [year, month, type])

  const firstDay   = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const maxDay     = Math.max(...Object.values(dayCounts), 1)

  function prev() {
    if (month === 1) onMonthChange(year - 1, 12)
    else onMonthChange(year, month - 1)
  }
  function next() {
    const now = new Date()
    if (year === now.getFullYear() && month === now.getMonth() + 1) return
    if (month === 12) onMonthChange(year + 1, 1)
    else onMonthChange(year, month + 1)
  }

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({length: daysInMonth}, (_,i) => i+1)]
  const maxMonth = Math.max(...Object.values(monthCounts), 1)

  return (
    <div className="flex flex-col gap-4">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button onClick={prev} className="w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition">‹</button>
        <span className="text-sm font-semibold">{MONTH_NAMES[month-1]} {year}</span>
        <button onClick={next} className="w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition">›</button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-0.5">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-[10px] text-zinc-600 font-medium py-1">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />
          const key = `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`
          const count = dayCounts[key] ?? 0
          const isSelected = selectedDate === key
          const intensity = count > 0 ? Math.max(0.15, count / maxDay) : 0
          return (
            <button
              key={key}
              onClick={() => onSelectDate(isSelected ? null : key)}
              className={`relative flex flex-col items-center justify-center rounded aspect-square text-xs transition
                ${isSelected ? "ring-2 ring-[#ed1c24] ring-offset-1 ring-offset-zinc-950" : ""}
                ${count > 0 ? "hover:ring-1 hover:ring-zinc-500" : "cursor-default"}
              `}
              style={{ background: count > 0 ? `rgba(237, 28, 36, ${intensity * 0.8})` : "transparent" }}
              disabled={count === 0 && !loadingCal}
              title={count > 0 ? `${count} watch${count !== 1 ? "es" : ""}` : undefined}
            >
              <span className={count > 0 ? "text-white font-medium" : "text-zinc-700"}>{day}</span>
              {count > 0 && <span className="text-[8px] text-white/60 leading-none">{count}</span>}
            </button>
          )
        })}
      </div>

      {/* Monthly stats */}
      {loadingCal ? (
        <div className="grid grid-cols-3 gap-2">
          {[0,1,2].map((i) => (
            <div key={i} className="rounded-lg bg-zinc-800/50 h-12 animate-pulse" />
          ))}
        </div>
      ) : monthStats && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-zinc-800/40 px-2 py-2">
            <div className="text-base font-bold text-white">{monthStats.movies}</div>
            <div className="text-[10px] text-zinc-500 leading-tight">Movies</div>
          </div>
          <div className="rounded-lg bg-zinc-800/40 px-2 py-2">
            <div className="text-base font-bold text-white">{monthStats.shows}</div>
            <div className="text-[10px] text-zinc-500 leading-tight">Shows</div>
          </div>
          <div className="rounded-lg bg-zinc-800/40 px-2 py-2">
            <div className="text-base font-bold text-white">{monthStats.episodes}</div>
            <div className="text-[10px] text-zinc-500 leading-tight">Episodes</div>
          </div>
        </div>
      )}

      {/* Month activity bar */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-zinc-600 uppercase tracking-wider">This year</span>
        <div className="flex gap-0.5 items-end h-10">
          {Array.from({length: 12}, (_, i) => {
            const mKey = String(i + 1)
            const count = monthCounts[mKey] ?? 0
            const h = maxMonth > 0 ? Math.max(2, (count / maxMonth) * 36) : 2
            const isCurrent = i + 1 === month
            return (
              <button
                key={mKey}
                onClick={() => { onMonthChange(year, i + 1); onSelectDate(null) }}
                className="flex-1 rounded-sm transition hover:opacity-80"
                style={{ height: h, background: isCurrent ? "#ed1c24" : count > 0 ? "#52525b" : "#27272a" }}
                title={`${MONTH_NAMES[i]}: ${count}`}
              />
            )
          })}
        </div>
        <div className="flex justify-between text-[9px] text-zinc-700">
          <span>Jan</span><span>Dec</span>
        </div>
      </div>
    </div>
  )
}

function HistoryItemRow({ item }: { item: HistoryItem }) {
  const date = new Date(item.watchedAt)
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-zinc-800/50 last:border-0">
      <div className="relative w-9 shrink-0 rounded overflow-hidden bg-zinc-800" style={{height: 52}}>
        {item.poster && (
          <Image src={`https://image.tmdb.org/t/p/w92${item.poster}`} alt={item.title} fill className="object-cover" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={`text-[9px] font-bold rounded px-1 py-px ${item.type === "movie" ? "bg-blue-900/50 text-blue-300" : "bg-purple-900/50 text-purple-300"}`}>
            {item.type === "movie" ? "MOVIE" : "TV"}
          </span>
          {item.rating && <span className="text-[10px] text-[#ed1c24] font-bold">★ {item.rating}</span>}
        </div>
        {item.type === "episode" && (
          <p className="text-[11px] text-zinc-500 truncate">{item.showTitle}</p>
        )}
        <p className="text-sm text-white truncate leading-tight">{item.title}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs text-zinc-400">
          {date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
        </p>
        {item.runtime && <p className="text-[10px] text-zinc-700">{item.runtime}m</p>}
      </div>
    </div>
  )
}

interface ApiResponse { items: HistoryItem[]; total: number; page: number; pageSize: number }

function monthRange(year: number, month: number) {
  const from = `${year}-${String(month).padStart(2,"0")}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`
  return { from, to }
}

export default function HistoryPage() {
  const now = new Date()
  const [selectedDate, setSelectedDate]   = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 })
  const [allTime, setAllTime] = useState(false)
  const [type, setType]   = useState("all")
  const [search, setSearch] = useState("")
  const [page, setPage]   = useState(1)
  const [data, setData]   = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchHistory = useCallback(async (
    d: string | null, sm: { year: number; month: number }, at: boolean, t: string, s: string, p: number
  ) => {
    setLoading(true)
    const params = new URLSearchParams({ type: t, page: p.toString(), limit: "30", sort: "newest" })
    if (d) {
      params.set("from", d)
      params.set("to", d)
    } else if (!at) {
      const { from, to } = monthRange(sm.year, sm.month)
      params.set("from", from)
      params.set("to", to)
    }
    if (s) params.set("search", s)
    const res = await fetch(`/api/history?${params}`)
    setData(await res.json())
    setLoading(false)
  }, [])

  // Fetch whenever any filter or page changes
  useEffect(() => {
    fetchHistory(selectedDate, selectedMonth, allTime, type, search, page)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, selectedMonth.year, selectedMonth.month, allTime, type, search, page])

  function handleMonthChange(year: number, month: number) {
    setSelectedMonth({ year, month })
    setSelectedDate(null)
    setAllTime(false)
    setPage(1)
  }

  function handleDateSelect(d: string | null) {
    setSelectedDate(d)
    setAllTime(false)
    setPage(1)
  }

  const totalPages = data ? Math.ceil(data.total / 30) : 0

  const dateLabel = selectedDate
    ? new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : allTime
    ? "All time"
    : `${MONTH_NAMES[selectedMonth.month - 1]} ${selectedMonth.year}`

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">History</h1>
        {data && (
          <span className="text-sm text-zinc-500">
            {data.total.toLocaleString()} {selectedDate ? "watches on this day" : allTime ? "total watches" : "watches this month"}
          </span>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* ── Calendar sidebar ── */}
        <div className="w-full lg:w-64 shrink-0 rounded-xl border border-zinc-800 bg-zinc-900 p-4 flex flex-col gap-5">
          <CalendarWidget
            type={type}
            selectedDate={selectedDate}
            selectedMonth={selectedMonth}
            onSelectDate={handleDateSelect}
            onMonthChange={handleMonthChange}
          />

          <div className="border-t border-zinc-800 pt-4 flex flex-col gap-3">
            {/* Period toggle */}
            <div>
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Period</p>
              <div className="flex rounded-lg overflow-hidden border border-zinc-700">
                <button
                  onClick={() => { setAllTime(false); setSelectedDate(null); setPage(1) }}
                  className={`flex-1 py-1.5 text-xs font-medium transition ${!allTime ? "bg-[#ed1c24] text-white" : "text-zinc-400 hover:text-white"}`}
                >
                  Month
                </button>
                <button
                  onClick={() => { setAllTime(true); setSelectedDate(null); setPage(1) }}
                  className={`flex-1 py-1.5 text-xs font-medium transition ${allTime ? "bg-[#ed1c24] text-white" : "text-zinc-400 hover:text-white"}`}
                >
                  All time
                </button>
              </div>
            </div>

            {/* Type toggle */}
            <div>
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Type</p>
              <div className="flex rounded-lg overflow-hidden border border-zinc-700">
                {(["all","movies","tv"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => { setType(t); setPage(1) }}
                    className={`flex-1 py-1.5 text-xs font-medium transition ${type === t ? "bg-[#ed1c24] text-white" : "text-zinc-400 hover:text-white"}`}
                  >
                    {t === "all" ? "All" : t === "movies" ? "Movies" : "TV"}
                  </button>
                ))}
              </div>
            </div>

            {/* Search */}
            <div>
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Search</p>
              <input
                type="text"
                placeholder="Title…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="w-full rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-white placeholder-zinc-600 px-3 py-1.5 focus:outline-none focus:border-zinc-500"
              />
            </div>

            {(selectedDate || allTime || type !== "all" || search) && (
              <button
                onClick={() => { setSelectedDate(null); setAllTime(false); setType("all"); setSearch(""); setPage(1) }}
                className="text-xs text-zinc-600 hover:text-white transition underline text-left"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>

        {/* ── History list ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {/* Date / month label */}
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-zinc-800" />
            <span className="text-xs text-zinc-400 px-3 shrink-0">{dateLabel}</span>
            <div className="h-px flex-1 bg-zinc-800" />
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 min-h-32">
            {loading && (
              <div className="py-10 flex items-center justify-center gap-2 text-zinc-500 text-sm">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-700 border-t-white" />
                Loading…
              </div>
            )}
            {!loading && data?.items.length === 0 && (
              <div className="py-10 text-center text-zinc-600 text-sm">
                {selectedDate ? "Nothing watched on this day" : allTime ? "No results" : "Nothing watched this month"}
              </div>
            )}
            {!loading && data?.items.map((item, i) => (
              <HistoryItemRow key={`${item.watchedAt}-${i}`} item={item} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p-1))} disabled={page === 1}
                className="rounded-lg border border-zinc-700 px-4 py-1.5 text-sm text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition">
                ← Prev
              </button>
              <span className="text-sm text-zinc-500">Page {page} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p+1))} disabled={page === totalPages}
                className="rounded-lg border border-zinc-700 px-4 py-1.5 text-sm text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition">
                Next →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
