"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import type { SearchResult } from "@/app/api/search/route"
import type { TargetedSyncResult } from "@/app/api/sync/targeted/route"

function TypeBadge({ type }: { type: "movie" | "show" }) {
  return (
    <span className={`text-[9px] font-bold rounded px-1 py-px ${
      type === "movie" ? "bg-blue-900/50 text-blue-300" : "bg-purple-900/50 text-purple-300"
    }`}>
      {type === "movie" ? "MOVIE" : "TV"}
    </span>
  )
}

function SyncResultBadge({ result }: { result: TargetedSyncResult }) {
  const lines: string[] = []

  if (result.deleted) {
    lines.push("Removed from library (no Trakt history)")
  } else if (result.type === "movie") {
    if (result.created) lines.push(`Added to library (${result.added} watch${result.added !== 1 ? "es" : ""})`)
    else if (result.added === 0 && result.removed === 0) lines.push("Already up to date")
    else {
      if (result.added > 0) lines.push(`+${result.added} watch${result.added !== 1 ? "es" : ""}`)
      if (result.removed > 0) lines.push(`−${result.removed} removed`)
    }
  } else {
    if (result.created) lines.push("Show added to library")
    if (result.episodesCreated > 0) lines.push(`+${result.episodesCreated} episode${result.episodesCreated !== 1 ? "s" : ""} added`)
    if (result.episodesUpdated > 0) lines.push(`${result.episodesUpdated} episode${result.episodesUpdated !== 1 ? "s" : ""} updated`)
    if (result.episodesDeleted > 0) lines.push(`−${result.episodesDeleted} episode${result.episodesDeleted !== 1 ? "s" : ""} removed`)
    if (!result.created && result.episodesCreated === 0 && result.episodesUpdated === 0 && result.episodesDeleted === 0)
      lines.push("Already up to date")
  }

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {lines.map((l, i) => (
        <span key={i} className="text-[10px] rounded-full px-2 py-0.5 bg-zinc-800 text-zinc-400">
          {l}
        </span>
      ))}
    </div>
  )
}

function ResultRow({
  item,
  syncing,
  syncResult,
  onSync,
}: {
  item: SearchResult
  syncing: boolean
  syncResult: TargetedSyncResult | null
  onSync: () => void
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-zinc-800/50 last:border-0">
      <div className="relative w-9 shrink-0 rounded overflow-hidden bg-zinc-800" style={{ height: 52 }}>
        {item.poster && (
          <Image
            src={`https://image.tmdb.org/t/p/w92${item.poster}`}
            alt={item.title}
            fill
            className="object-cover"
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <TypeBadge type={item.type} />
          {!item.inDb && (
            <span className="text-[9px] rounded px-1 py-px bg-zinc-700 text-zinc-400">Not in library</span>
          )}
        </div>
        <p className="text-sm text-white font-medium truncate leading-tight">{item.title}</p>
        <p className="text-xs text-zinc-500">
          {item.year ?? "—"}
          {item.inDb && item.plays > 0 && (
            <span className="ml-2 text-zinc-600">
              {item.type === "show" ? `${item.plays} episodes` : `${item.plays} watch${item.plays !== 1 ? "es" : ""}`}
            </span>
          )}
        </p>
        {syncResult && <SyncResultBadge result={syncResult} />}
      </div>

      <button
        onClick={onSync}
        disabled={syncing}
        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
          syncing
            ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
            : syncResult
            ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            : "bg-[#ed1c24] text-white hover:bg-[#c5171e]"
        }`}
      >
        {syncing ? (
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-600 border-t-white inline-block" />
            Syncing
          </span>
        ) : syncResult ? "Re-sync" : "Sync"}
      </button>
    </div>
  )
}

export default function SyncPage() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [syncResults, setSyncResults] = useState<Record<string, TargetedSyncResult>>({})
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (query.length < 2) return

    let cancelled = false
    const t = setTimeout(() => {
      setSearching(true)
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((d) => { if (!cancelled) { setResults(d.results); setSearching(false) } })
        .catch(() => { if (!cancelled) setSearching(false) })
    }, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [query])

  const displayResults = query.length >= 2 ? results : []

  async function handleSync(item: SearchResult) {
    setSyncing(item.traktId)
    try {
      const res = await fetch("/api/sync/targeted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          traktId: item.traktId,
          tmdbId: item.tmdbId,
          title: item.title,
          year: item.year,
          type: item.type,
        }),
      })
      const result: TargetedSyncResult = await res.json()
      setSyncResults((prev) => ({ ...prev, [item.traktId]: result }))
    } catch {
      // leave button in re-sync state
    } finally {
      setSyncing(null)
    }
  }

  const localResults = displayResults.filter((r) => r.inDb)
  const traktResults = displayResults.filter((r) => !r.inDb)

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold">Targeted Sync</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Search for a specific movie or show and sync its history with Trakt.
        </p>
      </div>

      {/* Search input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search movies or shows…"
          className="w-full rounded-xl bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-600 px-4 py-3 pr-10 text-sm focus:outline-none focus:border-zinc-500 transition"
        />
        {searching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-white" />
          </div>
        )}
        {!searching && query && (
          <button
            onClick={() => { setQuery(""); setResults([]) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white transition text-sm"
          >
            ✕
          </button>
        )}
      </div>

      {/* Results */}
      {displayResults.length > 0 && (
        <div className="flex flex-col gap-4">
          {localResults.length > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4">
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider pt-3 pb-1">In your library</p>
              {localResults.map((item) => (
                <ResultRow
                  key={item.traktId}
                  item={item}
                  syncing={syncing === item.traktId}
                  syncResult={syncResults[item.traktId] ?? null}
                  onSync={() => handleSync(item)}
                />
              ))}
            </div>
          )}

          {traktResults.length > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4">
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider pt-3 pb-1">From Trakt</p>
              {traktResults.map((item) => (
                <ResultRow
                  key={item.traktId}
                  item={item}
                  syncing={syncing === item.traktId}
                  syncResult={syncResults[item.traktId] ?? null}
                  onSync={() => handleSync(item)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {query.length >= 2 && !searching && displayResults.length === 0 && (
        <p className="text-sm text-zinc-600 text-center py-8">No results for &ldquo;{query}&rdquo;</p>
      )}

      {query.length > 0 && query.length < 2 && (
        <p className="text-xs text-zinc-600 text-center">Type at least 2 characters to search</p>
      )}
    </div>
  )
}
