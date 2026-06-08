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

  const body = await req.json()
  const { phase } = body

  if (phase === "clear") {
    await db.movie.deleteMany({ where: { userId } })
    await db.tVShow.deleteMany({ where: { userId } })
    await db.episode.deleteMany({ where: { userId } })
    return NextResponse.json({ ok: true })
  }

  if (phase === "movies") {
    const { items } = body
    if (items?.length) {
      await db.movie.createMany({
        data: items.map((m: object) => ({ ...m, userId })) as never,
        skipDuplicates: true,
      })
    }
    return NextResponse.json({ ok: true })
  }

  if (phase === "shows") {
    const { items } = body
    if (items?.length) {
      await db.tVShow.createMany({
        data: items.map((s: object) => ({ ...s, userId })) as never,
        skipDuplicates: true,
      })
    }
    return NextResponse.json({ ok: true })
  }

  if (phase === "episodes") {
    const { items } = body
    if (items?.length) {
      await db.episode.createMany({
        data: items.map((e: object) => ({ ...e, userId })) as never,
        skipDuplicates: true,
      })
    }
    return NextResponse.json({ ok: true })
  }

  if (phase === "finalize") {
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

  return NextResponse.json({ error: "Invalid phase" }, { status: 400 })
}
