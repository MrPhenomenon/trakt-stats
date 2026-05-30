import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export interface HistoryItem {
  type: "movie" | "episode"
  title: string
  showTitle?: string
  season?: number
  episode?: number
  poster: string | null
  watchedAt: string
  rating: number | null
  genres: string[]
  runtime: number | null
}

function inRange(ts: string, from: string, to: string): boolean {
  if (!from && !to) return true
  const d = ts.slice(0, 10)
  if (from && d < from) return false
  if (to   && d > to)   return false
  return true
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = session.user.id
  const sp = req.nextUrl.searchParams
  const type   = sp.get("type") ?? "all"
  const search = sp.get("search")?.toLowerCase() ?? ""
  const from   = sp.get("from") ?? ""   // "YYYY-MM-DD" inclusive
  const to     = sp.get("to")   ?? ""   // "YYYY-MM-DD" inclusive
  const sort   = sp.get("sort") ?? "newest"
  const page   = Math.max(1, Number(sp.get("page") ?? "1"))
  const limit  = Math.min(50, Number(sp.get("limit") ?? "20"))

  const events: HistoryItem[] = []

  if (type !== "tv") {
    const movies = await db.movie.findMany({
      where: { userId },
      select: { title: true, poster: true, watchedAt: true, rating: true, genres: true, runtime: true },
    })
    for (const m of movies) {
      if (search && !m.title.toLowerCase().includes(search)) continue
      for (const ts of m.watchedAt) {
        if (!inRange(ts, from, to)) continue
        events.push({ type: "movie", title: m.title, poster: m.poster, watchedAt: ts, rating: m.rating, genres: m.genres, runtime: m.runtime })
      }
    }
  }

  if (type !== "movies") {
    const episodes = await db.episode.findMany({
      where: { userId },
      select: { episodeTitle: true, showTitle: true, season: true, episode: true, tmdbShowId: true, watchedAt: true, rating: true, runtime: true },
    })
    const shows = await db.tVShow.findMany({ where: { userId }, select: { tmdbId: true, poster: true, genres: true } })
    const showMap = new Map(shows.map((s) => [s.tmdbId, { poster: s.poster, genres: s.genres }]))

    for (const ep of episodes) {
      const showData = showMap.get(ep.tmdbShowId ?? "")
      const epGenres = showData?.genres ?? []
      const seCode = `S${String(ep.season).padStart(2,"0")}E${String(ep.episode).padStart(2,"0")}`
      const epTitle = ep.episodeTitle ? `${seCode} — ${ep.episodeTitle}` : seCode
      if (search && !ep.showTitle.toLowerCase().includes(search) && !epTitle.toLowerCase().includes(search)) continue
      for (const ts of ep.watchedAt) {
        if (!inRange(ts, from, to)) continue
        events.push({
          type: "episode",
          title: epTitle,
          showTitle: ep.showTitle,
          season: ep.season,
          episode: ep.episode,
          poster: showData?.poster ?? null,
          watchedAt: ts,
          rating: ep.rating,
          genres: epGenres,
          runtime: ep.runtime,
        })
      }
    }
  }

  events.sort((a, b) => {
    const diff = new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime()
    return sort === "oldest" ? -diff : diff
  })

  const total = events.length
  const paginated = events.slice((page - 1) * limit, page * limit)

  return NextResponse.json({ items: paginated, total, page, pageSize: limit })
}
