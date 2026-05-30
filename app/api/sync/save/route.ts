import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { ensureUser } from "@/lib/ensure-user"
import { getRatings } from "@/lib/trakt"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = session.user.id
  await ensureUser(session)

  const { movies, shows, episodes } = await req.json()

  function mergeByTraktId<T extends { traktId: string; plays: number; watchedAt: string[] }>(
    items: T[]
  ): T[] {
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

  const dedupedMovies = mergeByTraktId(movies ?? [])
  const dedupedEpisodes = mergeByTraktId(episodes ?? [])

  await db.movie.deleteMany({ where: { userId } })
  await db.tVShow.deleteMany({ where: { userId } })
  await db.episode.deleteMany({ where: { userId } })

  if (dedupedMovies.length) {
    await db.movie.createMany({
      data: dedupedMovies.map((m) => ({ ...m, userId })),
    })
  }

  if (shows?.length) {
    await db.tVShow.createMany({
      data: shows.map((s: object) => ({ ...s, userId })),
    })
  }

  if (dedupedEpisodes.length) {
    const CHUNK = 500
    for (let i = 0; i < dedupedEpisodes.length; i += CHUNK) {
      await db.episode.createMany({
        data: dedupedEpisodes.slice(i, i + CHUNK).map((e) => ({ ...e, userId })),
      })
    }
  }

  const accessToken = session.accessToken
  const username = session.user.username ?? session.user.name ?? ""
  if (accessToken) {
    const ratings = await getRatings(username, accessToken)
    await Promise.all(
      ratings.map((r) => {
        if (r.type === "movie" && r.movie)
          return db.movie.updateMany({ where: { userId, traktId: String(r.movie.ids.trakt) }, data: { rating: r.rating } })
        if (r.type === "show" && r.show)
          return db.tVShow.updateMany({ where: { userId, traktId: String(r.show.ids.trakt) }, data: { rating: r.rating } })
        if (r.type === "episode" && r.episode)
          return db.episode.updateMany({ where: { userId, traktId: String(r.episode.ids.trakt) }, data: { rating: r.rating } })
        return Promise.resolve()
      })
    )
  }

  await db.syncStatus.upsert({
    where: { userId },
    create: { userId, lastSynced: new Date(), done: true },
    update: { lastSynced: new Date(), done: true, error: null },
  })

  return NextResponse.json({ success: true })
}
