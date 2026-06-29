import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { ensureUser } from "@/lib/ensure-user"
import { getWatchedShows, getRatings } from "@/lib/trakt"
import { getMovieDetails, getMovieCredits, getShowDetails, getEpisodeDetails, getEpisodeCredits, parseGenres } from "@/lib/tmdb"
import { chunk } from "@/lib/chunk"

const TRAKT_HEADERS = () => ({
  "Content-Type": "application/json",
  Accept: "application/json",
  "trakt-api-version": "2",
  "trakt-api-key": process.env.TRAKT_CLIENT_ID!,
  "User-Agent": "TraktStats/1.0",
})

async function traktFetch(url: string, accessToken: string) {
  const res = await fetch(`https://api.trakt.tv${url}`, {
    headers: { ...TRAKT_HEADERS(), Authorization: `Bearer ${accessToken}` },
  })
  if (res.status === 401) throw new Error("Trakt token expired or invalid")
  return res.ok ? res.json() : []
}

async function traktTotal(url: string, accessToken: string): Promise<number> {
  const res = await fetch(`https://api.trakt.tv${url}`, {
    headers: { ...TRAKT_HEADERS(), Authorization: `Bearer ${accessToken}` },
  })
  if (res.status === 401) throw new Error("Trakt token expired or invalid")
  return parseInt(res.headers.get("X-Pagination-Item-Count") ?? "0")
}

const KNOWN_PAGE_STOP = 3

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = session.user.id
  await ensureUser(session)

  const username = session.user.username ?? session.user.name ?? ""
  const accessToken = session.accessToken
  if (!accessToken) return NextResponse.json({ error: "No Trakt token" }, { status: 400 })

  const summary = {
    newMovies: [] as string[],
    rewatchedMovies: [] as string[],
    newEpisodes: [] as string[],
    rewatchedEpisodes: [] as string[],
    deletedMovies: [] as string[],
    deletedEpisodes: [] as string[],
  }

  const [dbMovieAgg, dbEpisodeAgg, traktMoviePlays, traktEpisodePlays] = await Promise.all([
    db.movie.aggregate({ where: { userId }, _sum: { plays: true } }),
    db.episode.aggregate({ where: { userId }, _sum: { plays: true } }),
    traktTotal(`/users/${username}/history/movies?page=1&limit=1`, accessToken),
    traktTotal(`/users/${username}/history/episodes?page=1&limit=1`, accessToken),
  ])

  const needMovieDeleteCheck = (dbMovieAgg._sum.plays ?? 0) > traktMoviePlays
  const needEpisodeDeleteCheck = (dbEpisodeAgg._sum.plays ?? 0) > traktEpisodePlays

  if (needMovieDeleteCheck) {
    const traktMovieTimestamps = new Map<string, string[]>()
    let p = 1
    while (true) {
      const items = await traktFetch(`/users/${username}/history/movies?page=${p}&limit=100`, accessToken)
      if (!items.length) break
      for (const item of items) {
        if (item.movie) {
          const id = String(item.movie.ids.trakt)
          if (!traktMovieTimestamps.has(id)) traktMovieTimestamps.set(id, [])
          traktMovieTimestamps.get(id)!.push(item.watched_at)
        }
      }
      p++
    }
    const dbMovies = await db.movie.findMany({
      where: { userId },
      select: { id: true, traktId: true, title: true, plays: true, watchedAt: true },
    }) as { id: string; traktId: string; title: string; plays: number; watchedAt: string[] }[]

    // Movies completely removed from Trakt
    const orphans = dbMovies.filter((m) => !traktMovieTimestamps.has(m.traktId))
    if (orphans.length) {
      await db.movie.deleteMany({ where: { id: { in: orphans.map((m) => m.id) } } })
      summary.deletedMovies.push(...orphans.map((m) => m.title))
    }

    // Movies with fewer plays on Trakt than in DB (deleted history entries)
    const overcounted = dbMovies.filter((m) => {
      const traktTs = traktMovieTimestamps.get(m.traktId)
      return traktTs !== undefined && traktTs.length < m.plays
    })
    await Promise.all(overcounted.map((movie) => {
      const traktTs = traktMovieTimestamps.get(movie.traktId)!
      summary.deletedMovies.push(movie.title)
      return db.movie.update({
        where: { id: movie.id },
        data: { plays: traktTs.length, watchedAt: traktTs },
      })
    }))
  }

  if (needEpisodeDeleteCheck) {
    const traktEpisodeTimestamps = new Map<string, string[]>()
    let p = 1
    while (true) {
      const items = await traktFetch(`/users/${username}/history/episodes?page=${p}&limit=100`, accessToken)
      if (!items.length) break
      for (const item of items) {
        if (item.episode) {
          const id = String(item.episode.ids.trakt)
          if (!traktEpisodeTimestamps.has(id)) traktEpisodeTimestamps.set(id, [])
          traktEpisodeTimestamps.get(id)!.push(item.watched_at)
        }
      }
      p++
    }
    const dbEpisodes = await db.episode.findMany({
      where: { userId },
      select: { id: true, traktId: true, showTitle: true, season: true, episode: true, plays: true, watchedAt: true },
    }) as { id: string; traktId: string; showTitle: string; season: number; episode: number; plays: number; watchedAt: string[] }[]

    // Episodes completely removed from Trakt
    const orphans = dbEpisodes.filter((e) => !traktEpisodeTimestamps.has(e.traktId))
    if (orphans.length) {
      await db.episode.deleteMany({ where: { id: { in: orphans.map((e) => e.id) } } })
      summary.deletedEpisodes.push(
        ...orphans.map((e) => `${e.showTitle} S${String(e.season).padStart(2,"0")}E${String(e.episode).padStart(2,"0")}`)
      )
    }

    // Episodes with fewer plays on Trakt than in DB (deleted history entries)
    const overcounted = dbEpisodes.filter((e) => {
      const traktTs = traktEpisodeTimestamps.get(e.traktId)
      return traktTs !== undefined && traktTs.length < e.plays
    })
    await Promise.all(overcounted.map((ep) => {
      const traktTs = traktEpisodeTimestamps.get(ep.traktId)!
      summary.deletedEpisodes.push(`${ep.showTitle} S${String(ep.season).padStart(2,"0")}E${String(ep.episode).padStart(2,"0")}`)
      return db.episode.update({
        where: { id: ep.id },
        data: { plays: traktTs.length, watchedAt: traktTs },
      })
    }))
  }

  const existingMovieIds = new Set(
    (await db.movie.findMany({ where: { userId }, select: { traktId: true } }) as { traktId: string }[]).map((m) => m.traktId)
  )

  const newMovies: Record<string, { plays: number; watchedAt: string[]; tmdbId?: number; title: string }> = {}
  let page = 1
  let knownStreak = 0

  while (true) {
    const items = await traktFetch(`/users/${username}/history/movies?page=${page}&limit=100`, accessToken)
    if (!items.length) break

    let foundNew = false
    for (const item of items) {
      if (!item.movie) continue
      const id = String(item.movie.ids.trakt)
      if (!newMovies[id]) newMovies[id] = { plays: 0, watchedAt: [], tmdbId: item.movie.ids.tmdb, title: item.movie.title }
      newMovies[id].plays++
      newMovies[id].watchedAt.push(item.watched_at)
      if (!existingMovieIds.has(id)) foundNew = true
    }

    knownStreak = foundNew ? 0 : knownStreak + 1
    if (knownStreak >= KNOWN_PAGE_STOP) break
    page++
  }

  for (const batch of chunk(Object.entries(newMovies), 20)) {
    await Promise.all(batch.map(async ([traktId, data]) => {
      const existing = await db.movie.findUnique({ where: { userId_traktId: { userId, traktId } } })
      if (existing) {
        const newTs = data.watchedAt.filter((ts) => !existing.watchedAt.includes(ts))
        if (newTs.length) {
          await db.movie.update({
            where: { id: existing.id },
            data: { plays: existing.plays + newTs.length, watchedAt: [...existing.watchedAt, ...newTs] },
          })
          summary.rewatchedMovies.push(data.title)
        }
      } else {
        const [details, credits] = await Promise.all([
          data.tmdbId ? getMovieDetails(data.tmdbId) : null,
          data.tmdbId ? getMovieCredits(data.tmdbId) : null,
        ])
        summary.newMovies.push(data.title)
        await db.movie.create({
          data: {
            userId, traktId,
            tmdbId: data.tmdbId ? String(data.tmdbId) : null,
            title: data.title,
            plays: data.plays,
            watchedAt: data.watchedAt,
            runtime: details?.runtime ?? null,
            poster: details?.poster_path ?? null,
            genres: parseGenres(details?.genres),
            countries: (details?.production_countries ?? []).map((c) => c.name),
            cast: (credits?.cast ?? []).filter((c) => c.profile_path).slice(0, 20)
              .map((c) => ({ id: c.id, name: c.name, gender: c.gender, image: c.profile_path })),
            crew: (credits?.crew ?? []).filter((c) => c.profile_path && (c.job === "Director" || c.department === "Writing")).slice(0, 10)
              .map((c) => ({ id: c.id, name: c.name, dept: c.department, job: c.job, image: c.profile_path })),
            studios: (details?.production_companies ?? []).filter((s) => s.logo_path)
              .map((s) => ({ id: s.id, name: s.name, image: s.logo_path, country: s.origin_country })),
          },
        })
      }
    }))
  }

  const shows = await getWatchedShows(username, accessToken)
  for (const batch of chunk(shows, 20)) {
    await Promise.all(batch.map(async (item) => {
      const traktId = String(item.show.ids.trakt)
      const existing = await db.tVShow.findUnique({ where: { userId_traktId: { userId, traktId } } })
      if (existing) {
        await db.tVShow.update({ where: { id: existing.id }, data: { episodePlays: item.plays } })
      } else {
        const tmdbId = item.show.ids.tmdb
        const details = tmdbId ? await getShowDetails(tmdbId) : null
        await db.tVShow.create({
          data: {
            userId, traktId,
            tmdbId: tmdbId ? String(tmdbId) : null,
            title: item.show.title,
            episodePlays: item.plays,
            releasedYear: item.show.year ?? null,
            poster: details?.poster_path ?? null,
            genres: parseGenres(details?.genres),
            countries: (details?.production_countries ?? []).map((c) => c.name),
            networks: [],
          },
        })
      }
    }))
  }

  const existingEpisodeIds = new Set(
    (await db.episode.findMany({ where: { userId }, select: { traktId: true } }) as { traktId: string }[]).map((e) => e.traktId)
  )

  page = 1
  knownStreak = 0

  while (true) {
    const items = await traktFetch(`/users/${username}/history/episodes?page=${page}&limit=100`, accessToken)
    if (!items.length) break

    const grouped = new Map<string, { item: typeof items[0]; watchedAt: string[] }>()
    for (const item of items) {
      if (!item.episode || !item.show) continue
      const id = String(item.episode.ids.trakt)
      if (!grouped.has(id)) grouped.set(id, { item, watchedAt: [] })
      grouped.get(id)!.watchedAt.push(item.watched_at)
    }

    let foundNew = false
    for (const traktId of grouped.keys()) {
      if (!existingEpisodeIds.has(traktId)) { foundNew = true; break }
    }

    for (const batch of chunk([...grouped.entries()], 20)) {
      await Promise.all(batch.map(async ([traktId, { item, watchedAt }]) => {
        const existing = await db.episode.findUnique({ where: { userId_traktId: { userId, traktId } } })
        if (existing) {
          const newTs = watchedAt.filter((ts) => !existing.watchedAt.includes(ts))
          if (newTs.length) {
            await db.episode.update({
              where: { id: existing.id },
              data: { plays: existing.plays + newTs.length, watchedAt: [...existing.watchedAt, ...newTs] },
            })
            const seCode = `S${String(existing.season).padStart(2,"0")}E${String(existing.episode).padStart(2,"0")}`
            summary.rewatchedEpisodes.push(`${existing.showTitle} ${seCode}`)
          }
        } else {
          existingEpisodeIds.add(traktId)
          const ep = item.episode!
          const tmdbShowId = item.show!.ids.tmdb
          const [details, credits] = await Promise.all([
            tmdbShowId ? getEpisodeDetails(tmdbShowId, ep.season, ep.number) : null,
            tmdbShowId ? getEpisodeCredits(tmdbShowId, ep.season, ep.number) : null,
          ])
          const seCode = `S${String(ep.season).padStart(2,"0")}E${String(ep.number).padStart(2,"0")}`
          summary.newEpisodes.push(`${item.show!.title} ${seCode}`)
          await db.episode.create({
            data: {
              userId, traktId,
              tmdbId: ep.ids.tmdb ? String(ep.ids.tmdb) : null,
              episodeTitle: ep.title ?? null,
              showTitle: item.show!.title,
              season: ep.season,
              episode: ep.number,
              plays: watchedAt.length,
              watchedAt,
              runtime: details?.runtime ?? null,
              tmdbShowId: tmdbShowId ? String(tmdbShowId) : null,
              cast: (credits?.cast ?? []).filter((c) => c.profile_path).slice(0, 15)
                .map((c) => ({ id: c.id, name: c.name, gender: c.gender, image: c.profile_path })),
              crew: [],
            },
          })
        }
      }))
    }

    knownStreak = foundNew ? 0 : knownStreak + 1
    if (knownStreak >= KNOWN_PAGE_STOP) break
    page++
  }

  const ratings = await getRatings(username, accessToken)
  await Promise.all(ratings.map((r) => {
    if (r.type === "movie" && r.movie)
      return db.movie.updateMany({ where: { userId, traktId: String(r.movie.ids.trakt) }, data: { rating: r.rating } })
    if (r.type === "show" && r.show)
      return db.tVShow.updateMany({ where: { userId, traktId: String(r.show.ids.trakt) }, data: { rating: r.rating } })
    if (r.type === "episode" && r.episode)
      return db.episode.updateMany({ where: { userId, traktId: String(r.episode.ids.trakt) }, data: { rating: r.rating } })
    return Promise.resolve()
  }))

  await db.syncStatus.upsert({
    where: { userId },
    create: { userId, lastSynced: new Date(), done: true },
    update: { lastSynced: new Date(), done: true, error: null },
  })

  return NextResponse.json({ success: true, summary })
}
