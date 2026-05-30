import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  groupByYear, groupByMonth, groupByDayOfWeek, groupByHour,
  groupByGenre, groupByCountry, groupByReleasedYear,
  ratingDistribution, perYearAverage,
} from "@/lib/stats"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = session.user.id

  const [shows, episodes] = await Promise.all([
    db.tVShow.findMany({
      where: { userId },
      select: {
        traktId: true, title: true, episodePlays: true,
        genres: true, countries: true, releasedYear: true,
        rating: true, poster: true,
      },
    }),
    db.episode.findMany({
      where: { userId },
      select: { watchedAt: true, runtime: true },
    }),
  ])

  const allWatchedAt = episodes.flatMap((e) => e.watchedAt)
  const totalEpisodePlays = shows.reduce((s, sh) => s + sh.episodePlays, 0)
  const totalMinutes = episodes.reduce((s, e) => s + (e.runtime ?? 22), 0) // default 22min
  const totalHours = Math.round(totalMinutes / 60)
  const activeYears = Math.max(Object.keys(groupByYear(allWatchedAt)).length, 1)

  const top10 = [...shows]
    .sort((a, b) => b.episodePlays - a.episodePlays)
    .slice(0, 10)
    .map((s) => ({
      title: s.title,
      poster: s.poster,
      plays: s.episodePlays,
    }))

  const highestRated = [...shows]
    .filter((s) => s.rating)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 20)
    .map((s) => ({ title: s.title, poster: s.poster, rating: s.rating }))

  return NextResponse.json({
    stats: {
      plays: {
        total: totalEpisodePlays,
        per_year: Math.round(totalEpisodePlays / activeYears),
        per_month: Math.round(totalEpisodePlays / (activeYears * 12)),
        per_day: Math.round((totalEpisodePlays / (activeYears * 365)) * 10) / 10,
      },
      hours: {
        total: totalHours,
        per_year: perYearAverage(totalHours, allWatchedAt),
        per_month: Math.round(totalHours / (activeYears * 12)),
        per_day: Math.round((totalHours / (activeYears * 365)) * 10) / 10,
      },
    },
    charts: {
      by_year: groupByYear(allWatchedAt),
      by_month: groupByMonth(allWatchedAt),
      by_day_of_week: groupByDayOfWeek(allWatchedAt),
      by_hour: groupByHour(allWatchedAt),
    },
    genres: groupByGenre(shows),
    countries: groupByCountry(shows),
    released_year: groupByReleasedYear(shows),
    ratings: ratingDistribution(shows),
    top10,
    highest_rated: highestRated,
  })
}
