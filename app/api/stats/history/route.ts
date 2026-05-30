import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]

function matchesPeriod(ts: string, period: string, value: string): boolean {
  const d = new Date(ts)
  switch (period) {
    case "year":       return d.getFullYear().toString() === value
    case "month":      return MONTHS[d.getMonth()] === value
    case "dayofweek":  return DAYS[d.getDay()] === value
    case "hour":       return d.getHours().toString().padStart(2, "0") === value
    default:           return false
  }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = session.user.id
  const { searchParams } = req.nextUrl
  const type = searchParams.get("type") ?? "movies"   // movies | tv
  const period = searchParams.get("period") ?? "year"  // year | month | dayofweek | hour
  const value = searchParams.get("value") ?? ""

  if (type === "movies") {
    const movies = await db.movie.findMany({
      where: { userId },
      select: { title: true, poster: true, watchedAt: true, rating: true },
    })

    const results: { title: string; poster: string | null; watchedAt: string; rating: number | null }[] = []
    for (const m of movies) {
      for (const ts of m.watchedAt) {
        if (matchesPeriod(ts, period, value)) {
          results.push({ title: m.title, poster: m.poster, watchedAt: ts, rating: m.rating })
        }
      }
    }
    results.sort((a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime())
    return NextResponse.json(results)
  }

  const episodes = await db.episode.findMany({
    where: { userId },
    select: { showTitle: true, tmdbShowId: true, watchedAt: true, episodeTitle: true, season: true, episode: true },
  })

  const shows = await db.tVShow.findMany({
    where: { userId },
    select: { tmdbId: true, poster: true },
  })
  const posterMap = new Map<string | null, string | null>()
  for (const s of shows) posterMap.set(s.tmdbId, s.poster)

  const showCounts = new Map<string, { count: number; poster: string | null; episodes: string[] }>()
  for (const ep of episodes) {
    for (const ts of ep.watchedAt) {
      if (!matchesPeriod(ts, period, value)) continue
      const existing = showCounts.get(ep.showTitle)
      const label = ep.episodeTitle
        ? `S${String(ep.season).padStart(2,"0")}E${String(ep.episode).padStart(2,"0")} — ${ep.episodeTitle}`
        : `S${String(ep.season).padStart(2,"0")}E${String(ep.episode).padStart(2,"0")}`
      if (existing) {
        existing.count++
        if (existing.episodes.length < 3) existing.episodes.push(label)
      } else {
        showCounts.set(ep.showTitle, {
          count: 1,
          poster: posterMap.get(ep.tmdbShowId ?? "") ?? null,
          episodes: [label],
        })
      }
    }
  }

  const results = [...showCounts.entries()]
    .map(([title, data]) => ({ title, ...data }))
    .sort((a, b) => b.count - a.count)

  return NextResponse.json(results)
}
