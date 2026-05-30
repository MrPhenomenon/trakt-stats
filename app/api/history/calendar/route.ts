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
    type !== "tv"
      ? db.movie.findMany({ where: { userId }, select: { watchedAt: true } })
      : Promise.resolve([]),
    type !== "movies"
      ? db.episode.findMany({ where: { userId }, select: { watchedAt: true } })
      : Promise.resolve([]),
  ])

  const allTs = [
    ...(movies as { watchedAt: string[] }[]).flatMap((m) => m.watchedAt),
    ...(episodes as { watchedAt: string[] }[]).flatMap((e) => e.watchedAt),
  ]

  const dayCounts: Record<string, number> = {}
  const monthCounts: Record<string, number> = {}

  for (const ts of allTs) {
    const d = new Date(ts)
    const y = d.getFullYear()
    const m = d.getMonth() + 1

    if (y === year) {
      const mk = String(m)
      monthCounts[mk] = (monthCounts[mk] ?? 0) + 1
    }

    if (y === year && m === month) {
      const day = d.getDate()
      const key = `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`
      dayCounts[key] = (dayCounts[key] ?? 0) + 1
    }
  }

  return NextResponse.json({ dayCounts, monthCounts, year, month })
}
