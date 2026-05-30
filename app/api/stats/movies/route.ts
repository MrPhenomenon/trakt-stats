import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  groupByYear, groupByMonth, groupByDayOfWeek, groupByHour,
  groupByGenre, groupByCountry, groupByReleasedYear,
  ratingDistribution, perYearAverage,
} from "@/lib/stats"

type MovieRow = {
  traktId: string; title: string; plays: number; watchedAt: string[]
  runtime: number | null; genres: string[]; countries: string[]
  releasedYear: number | null; rating: number | null; poster: string | null; tmdbId: string | null
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = session.user.id

  const movies = await db.movie.findMany({
    where: { userId },
    select: {
      traktId: true, title: true, plays: true, watchedAt: true,
      runtime: true, genres: true, countries: true, releasedYear: true,
      rating: true, poster: true, tmdbId: true,
    },
  }) as MovieRow[]

  const allWatchedAt = movies.flatMap((m) => m.watchedAt)
  const totalPlays = movies.reduce((s, m) => s + m.plays, 0)
  const totalMinutes = movies.reduce((s, m) => s + (m.runtime ?? 0) * m.plays, 0)
  const totalHours = Math.round(totalMinutes / 60)

  const byYear = groupByYear(allWatchedAt)
  const activeYears = Object.keys(byYear).length || 1

  const top10 = [...movies]
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 10)
    .map((m) => ({
      title: m.title,
      poster: m.poster,
      plays: m.plays,
      runtime: m.runtime ? `${Math.round((m.runtime * m.plays) / 60)}h` : null,
    }))

  const highestRated = [...movies]
    .filter((m) => m.rating)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 20)
    .map((m) => ({ title: m.title, poster: m.poster, rating: m.rating }))

  return NextResponse.json({
    stats: {
      plays: {
        total: totalPlays,
        per_year: Math.round(totalPlays / activeYears),
        per_month: Math.round(totalPlays / (activeYears * 12)),
        per_day: Math.round((totalPlays / (activeYears * 365)) * 10) / 10,
      },
      hours: {
        total: totalHours,
        per_year: perYearAverage(totalHours, allWatchedAt),
        per_month: Math.round(totalHours / (activeYears * 12)),
        per_day: Math.round((totalHours / (activeYears * 365)) * 10) / 10,
      },
    },
    charts: {
      by_year: byYear,
      by_month: groupByMonth(allWatchedAt),
      by_day_of_week: groupByDayOfWeek(allWatchedAt),
      by_hour: groupByHour(allWatchedAt),
    },
    genres: groupByGenre(movies),
    countries: groupByCountry(movies),
    released_year: groupByReleasedYear(movies),
    ratings: ratingDistribution(movies),
    top10,
    highest_rated: highestRated,
  })
}
