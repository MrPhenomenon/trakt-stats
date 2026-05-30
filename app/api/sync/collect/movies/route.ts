import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getMovieHistoryPage } from "@/lib/trakt"
import { getMovieDetails, getMovieCredits, parseGenres } from "@/lib/tmdb"
import { chunk } from "@/lib/chunk"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { page } = await req.json()
  const username = session.user.username ?? session.user.name ?? ""
  const accessToken = session.accessToken
  if (!accessToken) return NextResponse.json({ error: "No Trakt token" }, { status: 400 })

  const items = await getMovieHistoryPage(username, accessToken, page, 100)
  if (!items.length) return NextResponse.json({ items: [], done: true })

  const grouped = new Map<number, { movie: NonNullable<(typeof items)[0]["movie"]>; watchedAt: string[] }>()
  for (const item of items) {
    if (!item.movie) continue
    const id = item.movie.ids.trakt
    if (!grouped.has(id)) grouped.set(id, { movie: item.movie, watchedAt: [] })
    grouped.get(id)!.watchedAt.push(item.watched_at)
  }

  const entries = [...grouped.values()]

  const processed: object[] = []
  for (const batch of chunk(entries, 20)) {
    const results = await Promise.all(
      batch.map(async ({ movie, watchedAt }) => {
        const tmdbId = movie.ids.tmdb
        const [details, credits] = await Promise.all([
          tmdbId ? getMovieDetails(tmdbId) : null,
          tmdbId ? getMovieCredits(tmdbId) : null,
        ])
        return {
          traktId: String(movie.ids.trakt),
          tmdbId: tmdbId ? String(tmdbId) : null,
          imdbId: movie.ids.imdb ?? null,
          title: movie.title,
          plays: watchedAt.length,
          watchedAt,
          releasedYear: movie.year ?? null,
          runtime: details?.runtime ?? null,
          poster: details?.poster_path ?? null,
          genres: parseGenres(details?.genres),
          countries: (details?.production_countries ?? []).map((c) => c.name),
          cast: (credits?.cast ?? []).filter((c) => c.profile_path).slice(0, 20)
            .map((c) => ({ id: c.id, name: c.name, gender: c.gender, image: c.profile_path })),
          crew: (credits?.crew ?? [])
            .filter((c) => c.profile_path && (c.job === "Director" || c.department === "Writing"))
            .slice(0, 10)
            .map((c) => ({ id: c.id, name: c.name, dept: c.department, job: c.job, image: c.profile_path })),
          studios: (details?.production_companies ?? []).filter((s) => s.logo_path)
            .map((s) => ({ id: s.id, name: s.name, image: s.logo_path, country: s.origin_country })),
        }
      })
    )
    processed.push(...results)
  }

  return NextResponse.json({ items: processed, done: false })
}
