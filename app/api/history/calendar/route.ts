import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = session.user.id
  const sp = req.nextUrl.searchParams
  const year  = Number(sp.get("year")  ?? new Date().getFullYear())
  const month = Number(sp.get("month") ?? new Date().getMonth() + 1)
  const type  = sp.get("type") ?? "all"

  const [movies, episodes] = await Promise.all([
    db.movie.findMany({ where: { userId }, select: { watchedAt: true } }),
    db.episode.findMany({ where: { userId }, select: { watchedAt: true, showTitle: true } }),
  ])

  const dayCounts: Record<string, number> = {}
  const monthCounts: Record<string, number> = {}

  // monthStats always counts all types regardless of the type filter
  let statMovies = 0
  let statEpisodes = 0
  const statShows = new Set<string>()

  for (const m of movies) {
    for (const ts of m.watchedAt) {
      const d = new Date(ts)
      const y = d.getFullYear()
      const mo = d.getMonth() + 1

      if (y === year) {
        if (type !== "tv") {
          const mk = String(mo)
          monthCounts[mk] = (monthCounts[mk] ?? 0) + 1
        }
        if (mo === month) {
          if (type !== "tv") {
            const key = `${year}-${String(month).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
            dayCounts[key] = (dayCounts[key] ?? 0) + 1
          }
          statMovies++
        }
      }
    }
  }

  for (const ep of episodes) {
    for (const ts of ep.watchedAt) {
      const d = new Date(ts)
      const y = d.getFullYear()
      const mo = d.getMonth() + 1

      if (y === year) {
        if (type !== "movies") {
          const mk = String(mo)
          monthCounts[mk] = (monthCounts[mk] ?? 0) + 1
        }
        if (mo === month) {
          if (type !== "movies") {
            const key = `${year}-${String(month).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
            dayCounts[key] = (dayCounts[key] ?? 0) + 1
          }
          statEpisodes++
          statShows.add(ep.showTitle)
        }
      }
    }
  }

  return NextResponse.json({
    dayCounts,
    monthCounts,
    monthStats: { movies: statMovies, shows: statShows.size, episodes: statEpisodes },
    year,
    month,
  })
}
