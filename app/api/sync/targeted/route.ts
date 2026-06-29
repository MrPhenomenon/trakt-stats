import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { ensureUser } from "@/lib/ensure-user"
import { getItemHistoryPage } from "@/lib/trakt"
import {
  getMovieDetails, getMovieCredits,
  getShowDetails, getEpisodeDetails, getEpisodeCredits,
  parseGenres,
} from "@/lib/tmdb"
import { chunk } from "@/lib/chunk"

export interface TargetedSyncResult {
  title: string
  type: "movie" | "show"
  created: boolean
  deleted: boolean
  added: number
  removed: number
  episodesCreated: number
  episodesUpdated: number
  episodesDeleted: number
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = session.user.id
  await ensureUser(session)

  const username = session.user.username ?? session.user.name ?? ""
  const accessToken = session.accessToken
  if (!accessToken) return NextResponse.json({ error: "No Trakt token" }, { status: 400 })

  const { traktId, tmdbId, title, year, type } = (await req.json()) as {
    traktId: string
    tmdbId: string | null
    title: string
    year: number | null
    type: "movie" | "show"
  }

  if (type === "movie") {
    return syncMovie({ userId, username, accessToken, traktId, tmdbId, title, year })
  }
  return syncShow({ userId, username, accessToken, traktId, tmdbId, title, year })
}

async function fetchAllHistory(
  username: string,
  accessToken: string,
  type: "movies" | "shows",
  traktId: string
) {
  const items = []
  let p = 1
  while (true) {
    const page = await getItemHistoryPage(username, accessToken, type, traktId, p)
    if (!page.length) break
    items.push(...page)
    p++
  }
  return items
}

async function syncMovie({
  userId, username, accessToken, traktId, tmdbId, title, year,
}: { userId: string; username: string; accessToken: string; traktId: string; tmdbId: string | null; title: string; year: number | null }) {
  const items = await fetchAllHistory(username, accessToken, "movies", traktId)
  const traktTimestamps = items.map((i) => i.watched_at)

  const existing = await db.movie.findUnique({ where: { userId_traktId: { userId, traktId } } })

  if (traktTimestamps.length === 0) {
    if (existing) {
      await db.movie.delete({ where: { id: existing.id } })
      return NextResponse.json<TargetedSyncResult>({
        title, type: "movie", created: false, deleted: true,
        added: 0, removed: existing.plays,
        episodesCreated: 0, episodesUpdated: 0, episodesDeleted: 0,
      })
    }
    return NextResponse.json<TargetedSyncResult>({
      title, type: "movie", created: false, deleted: false,
      added: 0, removed: 0,
      episodesCreated: 0, episodesUpdated: 0, episodesDeleted: 0,
    })
  }

  if (existing) {
    const traktSet = new Set(traktTimestamps)
    const dbSet = new Set(existing.watchedAt)
    const added = traktTimestamps.filter((ts) => !dbSet.has(ts)).length
    const removed = existing.watchedAt.filter((ts) => !traktSet.has(ts)).length
    if (added > 0 || removed > 0) {
      await db.movie.update({
        where: { id: existing.id },
        data: { plays: traktTimestamps.length, watchedAt: traktTimestamps },
      })
    }
    return NextResponse.json<TargetedSyncResult>({
      title, type: "movie", created: false, deleted: false, added, removed,
      episodesCreated: 0, episodesUpdated: 0, episodesDeleted: 0,
    })
  }

  // Create new movie
  const tmdbIdNum = tmdbId ? parseInt(tmdbId) : null
  const [details, credits] = await Promise.all([
    tmdbIdNum ? getMovieDetails(tmdbIdNum) : null,
    tmdbIdNum ? getMovieCredits(tmdbIdNum) : null,
  ])
  await db.movie.create({
    data: {
      userId, traktId,
      tmdbId: tmdbId ?? null,
      title,
      releasedYear: year ?? null,
      plays: traktTimestamps.length,
      watchedAt: traktTimestamps,
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
  return NextResponse.json<TargetedSyncResult>({
    title, type: "movie", created: true, deleted: false,
    added: traktTimestamps.length, removed: 0,
    episodesCreated: 0, episodesUpdated: 0, episodesDeleted: 0,
  })
}

async function syncShow({
  userId, username, accessToken, traktId, tmdbId, title, year,
}: { userId: string; username: string; accessToken: string; traktId: string; tmdbId: string | null; title: string; year: number | null }) {
  const items = await fetchAllHistory(username, accessToken, "shows", traktId)

  // Group by episode traktId
  const episodeMap = new Map<string, { item: (typeof items)[0]; timestamps: string[] }>()
  for (const item of items) {
    if (!item.episode) continue
    const id = String(item.episode.ids.trakt)
    if (!episodeMap.has(id)) episodeMap.set(id, { item, timestamps: [] })
    episodeMap.get(id)!.timestamps.push(item.watched_at)
  }

  const totalPlays = [...episodeMap.values()].reduce((s, e) => s + e.timestamps.length, 0)
  const tmdbIdNum = tmdbId ? parseInt(tmdbId) : null

  // Upsert TVShow record
  let tvShow = await db.tVShow.findUnique({ where: { userId_traktId: { userId, traktId } } })
  const showCreated = !tvShow

  if (!tvShow) {
    const details = tmdbIdNum ? await getShowDetails(tmdbIdNum) : null
    tvShow = await db.tVShow.create({
      data: {
        userId, traktId,
        tmdbId: tmdbId ?? null,
        title,
        releasedYear: year ?? null,
        episodePlays: totalPlays,
        poster: details?.poster_path ?? null,
        genres: parseGenres(details?.genres),
        countries: (details?.production_countries ?? []).map((c) => c.name),
        networks: [],
      },
    })
  } else {
    await db.tVShow.update({ where: { id: tvShow.id }, data: { episodePlays: totalPlays } })
  }

  // Get existing episodes for this show
  const existingEps = await db.episode.findMany({
    where: { userId, ...(tmdbId ? { tmdbShowId: tmdbId } : { showTitle: title }) },
    select: { id: true, traktId: true, plays: true, watchedAt: true, season: true, episode: true },
  })
  const existingMap = new Map(existingEps.map((e) => [e.traktId, e]))

  let episodesCreated = 0
  let episodesUpdated = 0

  for (const batch of chunk([...episodeMap.entries()], 20)) {
    await Promise.all(batch.map(async ([epTraktId, { item, timestamps }]) => {
      const existing = existingMap.get(epTraktId)
      if (existing) {
        const traktSet = new Set(timestamps)
        const added = timestamps.filter((ts) => !new Set(existing.watchedAt).has(ts)).length
        const removed = existing.watchedAt.filter((ts) => !traktSet.has(ts)).length
        if (added > 0 || removed > 0) {
          episodesUpdated++
          await db.episode.update({
            where: { id: existing.id },
            data: { plays: timestamps.length, watchedAt: timestamps },
          })
        }
      } else {
        episodesCreated++
        const ep = item.episode!
        const [details, credits] = await Promise.all([
          tmdbIdNum ? getEpisodeDetails(tmdbIdNum, ep.season, ep.number) : null,
          tmdbIdNum ? getEpisodeCredits(tmdbIdNum, ep.season, ep.number) : null,
        ])
        await db.episode.create({
          data: {
            userId,
            traktId: epTraktId,
            tmdbId: ep.ids.tmdb ? String(ep.ids.tmdb) : null,
            episodeTitle: ep.title ?? null,
            showTitle: title,
            season: ep.season,
            episode: ep.number,
            plays: timestamps.length,
            watchedAt: timestamps,
            runtime: details?.runtime ?? null,
            tmdbShowId: tmdbId ?? null,
            cast: (credits?.cast ?? []).filter((c) => c.profile_path).slice(0, 15)
              .map((c) => ({ id: c.id, name: c.name, gender: c.gender, image: c.profile_path })),
            crew: [],
          },
        })
      }
    }))
  }

  // Delete episodes removed from Trakt
  const orphans = existingEps.filter((e) => !episodeMap.has(e.traktId))
  if (orphans.length) {
    await db.episode.deleteMany({ where: { id: { in: orphans.map((e) => e.id) } } })
  }

  return NextResponse.json<TargetedSyncResult>({
    title, type: "show",
    created: showCreated, deleted: false,
    added: episodesCreated, removed: orphans.length,
    episodesCreated, episodesUpdated, episodesDeleted: orphans.length,
  })
}
