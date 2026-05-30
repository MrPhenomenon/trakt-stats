import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = session.user.id

  const [movies, shows, episodes, syncStatus] = await Promise.all([
    db.movie.aggregate({
      where: { userId },
      _count: { id: true },
      _sum: { plays: true, runtime: true },
    }),
    db.tVShow.aggregate({
      where: { userId },
      _count: { id: true },
      _sum: { episodePlays: true },
    }),
    db.episode.aggregate({
      where: { userId },
      _count: { id: true },
      _sum: { runtime: true },
    }),
    db.syncStatus.findUnique({ where: { userId } }),
  ])

  const movieMinutes = movies._sum.runtime ?? 0
  const episodeMinutes = episodes._sum.runtime ?? 0
  const totalHours = Math.round((movieMinutes + episodeMinutes) / 60)

  return NextResponse.json({
    movies: {
      unique: movies._count.id,
      plays: movies._sum.plays ?? 0,
      hours: Math.round(movieMinutes / 60),
    },
    shows: {
      unique: shows._count.id,
      episodePlays: shows._sum.episodePlays ?? 0,
    },
    episodes: {
      unique: episodes._count.id,
    },
    totalHours,
    lastSynced: syncStatus?.lastSynced ?? null,
  })
}
