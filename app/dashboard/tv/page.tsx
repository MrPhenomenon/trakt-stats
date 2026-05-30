import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Image from "next/image"
import { db } from "@/lib/db"
import {
  groupByYear, groupByMonth, groupByDayOfWeek, groupByHour,
  groupByGenre, groupByReleasedYear, ratingDistribution, perYearAverage,
} from "@/lib/stats"
import { PlaysByTimeCharts } from "@/components/charts/plays-by-time"
import { GenresBar } from "@/components/charts/genres-bar"
import { ReleasedYearBar } from "@/components/charts/released-year-bar"
import { RatingsChart } from "@/components/charts/ratings-chart"

type ShowRow = {
  title: string; episodePlays: number; genres: string[]; countries: string[]
  releasedYear: number | null; rating: number | null; poster: string | null
}
type EpisodeRow = { watchedAt: string[]; runtime: number | null }

export default async function TvPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/")

  const userId = session.user.id

  const [shows, episodes] = await Promise.all([
    db.tVShow.findMany({
      where: { userId },
      select: { title: true, episodePlays: true, genres: true, countries: true, releasedYear: true, rating: true, poster: true },
    }) as Promise<ShowRow[]>,
    db.episode.findMany({
      where: { userId },
      select: { watchedAt: true, runtime: true },
    }) as Promise<EpisodeRow[]>,
  ])

  const allWatchedAt = episodes.flatMap((e) => e.watchedAt)
  const totalPlays = shows.reduce((s, sh) => s + sh.episodePlays, 0)
  const totalHours = Math.round(episodes.reduce((s, e) => s + (e.runtime ?? 22), 0) / 60)
  const activeYears = Math.max(Object.keys(groupByYear(allWatchedAt)).length, 1)

  const charts = {
    by_year: groupByYear(allWatchedAt),
    by_month: groupByMonth(allWatchedAt),
    by_day_of_week: groupByDayOfWeek(allWatchedAt),
    by_hour: groupByHour(allWatchedAt),
  }

  const top10 = [...shows].sort((a, b) => b.episodePlays - a.episodePlays).slice(0, 10)
  const highestRated = [...shows].filter((s) => s.rating).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 20)

  const statCards = [
    { label: "Episode Plays", value: totalPlays },
    { label: "Hours Watched", value: totalHours },
    { label: "Plays / Year", value: Math.round(totalPlays / activeYears) },
    { label: "Hours / Year", value: perYearAverage(totalHours, allWatchedAt) },
  ]

  return (
    <div className="flex flex-col gap-10">
      <h1 className="text-2xl font-bold">TV Shows</h1>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">{s.label}</div>
            <div className="text-3xl font-bold">{s.value.toLocaleString()}</div>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-5">Plays Over Time</h2>
        <PlaysByTimeCharts data={charts} type="tv" />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">Top 10 Shows</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {top10.map((s) => (
            <div key={s.title} className="flex flex-col gap-1">
              <div className="relative aspect-[2/3] rounded overflow-hidden bg-zinc-800">
                {s.poster && (
                  <Image src={`https://image.tmdb.org/t/p/w200${s.poster}`} alt={s.title} fill className="object-cover" />
                )}
              </div>
              <span className="text-xs text-zinc-400 leading-tight">{s.title}</span>
              <span className="text-xs text-zinc-600">{s.episodePlays} eps</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-5">By Genre</h2>
        <GenresBar data={groupByGenre(shows)} />
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-5">By Release Year</h2>
        <ReleasedYearBar data={groupByReleasedYear(shows)} />
      </section>

      {highestRated.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4">Highest Rated</h2>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {highestRated.map((s) => (
              <div key={s.title} className="relative shrink-0 w-24">
                <div className="relative aspect-[2/3] rounded overflow-hidden bg-zinc-800">
                  {s.poster && (
                    <Image src={`https://image.tmdb.org/t/p/w200${s.poster}`} alt={s.title} fill className="object-cover" />
                  )}
                  <div className="absolute top-0 right-0 bg-[#ed1c24] text-white text-xs font-bold w-6 h-6 flex items-center justify-center">
                    {s.rating}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-5">Rating Distribution</h2>
        <RatingsChart data={ratingDistribution(shows)} />
      </section>
    </div>
  )
}
