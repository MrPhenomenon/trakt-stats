"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"

type Phase = "idle" | "movies" | "tv" | "episodes" | "saving" | "updating" | "done" | "error"

const SAVE_BATCH = 300

function mergeByTraktId<T extends { traktId: string; plays: number; watchedAt: string[] }>(items: T[]): T[] {
  const map = new Map<string, T>()
  for (const item of items) {
    if (map.has(item.traktId)) {
      const existing = map.get(item.traktId)!
      existing.plays += item.plays
      existing.watchedAt = [...existing.watchedAt, ...item.watchedAt]
    } else {
      map.set(item.traktId, { ...item })
    }
  }
  return [...map.values()]
}

async function savePhase(phase: string, items?: object[]) {
  const res = await fetch("/api/sync/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(items !== undefined ? { phase, items } : { phase }),
  })
  if (!res.ok) throw new Error(`Save ${phase} failed: ${res.status}`)
}

interface Props {
  lastSynced: string | null
  compact: boolean
}

export default function SyncPanel({ lastSynced, compact }: Props) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>("idle")
  const [counts, setCounts] = useState({ movies: 0, shows: 0, episodes: 0 })
  const [error, setError] = useState<string | null>(null)
  const [showResync, setShowResync] = useState(false)
  const [updateSummary, setUpdateSummary] = useState<string | null>(null)
  const abortRef = useRef(false)

  async function collectPages(endpoint: string, onItems: (items: object[]) => void) {
    let page = 1
    while (!abortRef.current) {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page }),
      })
      if (!res.ok) throw new Error(`${endpoint} failed: ${res.status}`)
      const { items, done } = await res.json()
      if (items?.length) onItems(items)
      if (done || !items?.length) break
      page++
    }
  }

  async function fullSync() {
    abortRef.current = false
    setError(null)
    setCounts({ movies: 0, shows: 0, episodes: 0 })

    const allMovies: object[] = []
    const allShows: object[] = []
    const allEpisodes: object[] = []

    try {
      setPhase("movies")
      await collectPages("/api/sync/collect/movies", (items) => {
        allMovies.push(...items)
        setCounts((c) => ({ ...c, movies: allMovies.length }))
      })

      setPhase("tv")
      const tvRes = await fetch("/api/sync/collect/tv", { method: "POST" })
      if (!tvRes.ok) throw new Error("TV fetch failed")
      const { items: tvItems } = await tvRes.json()
      allShows.push(...(tvItems ?? []))
      setCounts((c) => ({ ...c, shows: allShows.length }))

      setPhase("episodes")
      await collectPages("/api/sync/collect/episodes", (items) => {
        allEpisodes.push(...items)
        setCounts((c) => ({ ...c, episodes: allEpisodes.length }))
      })

      setPhase("saving")

      const mergedMovies = mergeByTraktId(allMovies as never[])
      const mergedEpisodes = mergeByTraktId(allEpisodes as never[])

      await savePhase("clear")

      for (let i = 0; i < mergedMovies.length; i += SAVE_BATCH)
        await savePhase("movies", mergedMovies.slice(i, i + SAVE_BATCH))

      await savePhase("shows", allShows)

      for (let i = 0; i < mergedEpisodes.length; i += SAVE_BATCH)
        await savePhase("episodes", mergedEpisodes.slice(i, i + SAVE_BATCH))

      await savePhase("finalize")

      setPhase("done")
      router.refresh()
    } catch (e) {
      setError(String(e))
      setPhase("error")
    }
  }

  async function incrementalUpdate() {
    abortRef.current = false
    setError(null)
    setUpdateSummary(null)
    setPhase("updating")

    try {
      const res = await fetch("/api/sync/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startAt: lastSynced }),
      })
      if (!res.ok) throw new Error("Update failed")
      const { summary } = await res.json()

      const parts: string[] = []
      if (summary.newMovies.length)
        parts.push(`+${summary.newMovies.length} movie${summary.newMovies.length > 1 ? "s" : ""}: ${summary.newMovies.slice(0, 2).join(", ")}${summary.newMovies.length > 2 ? "…" : ""}`)
      if (summary.rewatchedMovies.length)
        parts.push(`${summary.rewatchedMovies.length} rewatch${summary.rewatchedMovies.length > 1 ? "es" : ""}`)
      if (summary.newEpisodes.length)
        parts.push(`+${summary.newEpisodes.length} episode${summary.newEpisodes.length > 1 ? "s" : ""}: ${summary.newEpisodes.slice(0, 2).join(", ")}${summary.newEpisodes.length > 2 ? "…" : ""}`)
      if (summary.rewatchedEpisodes.length)
        parts.push(`${summary.rewatchedEpisodes.length} rewatch${summary.rewatchedEpisodes.length > 1 ? "es" : ""}`)
      if (summary.deletedMovies.length)
        parts.push(`−${summary.deletedMovies.length} movie${summary.deletedMovies.length > 1 ? "s" : ""} removed`)
      if (summary.deletedEpisodes.length)
        parts.push(`−${summary.deletedEpisodes.length} episode${summary.deletedEpisodes.length > 1 ? "s" : ""} removed`)
      setUpdateSummary(parts.length ? parts.join(" · ") : "Already up to date")

      setPhase("done")
      router.refresh()
    } catch (e) {
      setError(String(e))
      setPhase("error")
    }
  }

  const isSyncing = !["idle", "done", "error"].includes(phase)

  const steps = [
    { key: "movies", label: "Movies", count: counts.movies },
    { key: "tv", label: "TV Shows", count: counts.shows },
    { key: "episodes", label: "Episodes", count: counts.episodes },
    { key: "saving", label: "Saving to database", count: 0 },
  ]
  const phaseOrder = ["idle", "movies", "tv", "episodes", "saving", "done"]
  const currentIdx = phaseOrder.indexOf(phase)

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        {isSyncing ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-600 border-t-white" />
            {phase === "updating" ? "Updating…" : `Syncing ${phase}…`}
          </div>
        ) : phase === "done" ? (
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-sm text-green-400">✓ Done</span>
            {updateSummary && (
              <span className="text-xs text-zinc-500 max-w-xs text-right">{updateSummary}</span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={incrementalUpdate}
              className="rounded-lg bg-[#ed1c24] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#c5151c] transition"
            >
              Update
            </button>
            <button
              onClick={() => setShowResync((v) => !v)}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition"
            >
              ···
            </button>
            {showResync && (
              <button
                onClick={() => { setShowResync(false); fullSync() }}
                className="text-xs text-zinc-500 hover:text-red-400 transition underline"
              >
                Full re-sync
              </button>
            )}
          </div>
        )}
        {phase === "error" && (
          <span className="text-xs text-red-400">{error}</span>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      {phase === "idle" && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 flex flex-col items-center gap-4 text-center">
          <div className="text-5xl">🎬</div>
          <h2 className="text-xl font-semibold">Sync your Trakt history</h2>
          <p className="text-zinc-400 text-sm max-w-sm">
            Fetches your complete watch history and enriches it with metadata. Progress updates live.
          </p>
          <button
            onClick={fullSync}
            className="mt-2 rounded-lg bg-[#ed1c24] px-8 py-3 font-semibold text-white hover:bg-[#c5151c] active:scale-95 transition"
          >
            Start Sync
          </button>
        </div>
      )}

      {(isSyncing || phase === "done" || phase === "error") && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 flex flex-col gap-5">
          {steps.map((step, i) => {
            const stepIdx = phaseOrder.indexOf(step.key)
            const isDone = currentIdx > stepIdx
            const isActive = phase === step.key
            const isPending = currentIdx < stepIdx
            return (
              <div key={step.key} className="flex items-center gap-4">
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold
                  ${isDone ? "bg-green-500 text-white" : isActive ? "bg-[#ed1c24] text-white" : "bg-zinc-800 text-zinc-500"}`}>
                  {isDone ? "✓" : i + 1}
                </div>
                <div className="flex flex-1 items-center justify-between">
                  <span className={`text-sm font-medium ${isPending ? "text-zinc-500" : "text-white"}`}>{step.label}</span>
                  <span className="text-xs text-zinc-400">
                    {step.count > 0 ? `${step.count.toLocaleString()} collected` : isActive ? "Working…" : isDone && !step.count ? "Done" : ""}
                  </span>
                </div>
                {isActive && <div className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-zinc-600 border-t-white" />}
              </div>
            )
          })}

          {phase === "done" && (
            <div className="rounded-lg bg-green-950 border border-green-800 p-4 text-center">
              <p className="text-green-400 font-semibold">Sync complete!</p>
              <p className="text-zinc-400 text-sm mt-1">
                {counts.movies.toLocaleString()} movies · {counts.shows.toLocaleString()} shows · {counts.episodes.toLocaleString()} episodes
              </p>
            </div>
          )}

          {phase === "error" && (
            <div className="rounded-lg bg-red-950 border border-red-800 p-4">
              <p className="text-red-400 font-semibold text-sm">Sync failed</p>
              <p className="text-zinc-400 text-xs mt-1 font-mono">{error}</p>
              <button onClick={fullSync} className="mt-2 text-sm text-white underline">Retry</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
