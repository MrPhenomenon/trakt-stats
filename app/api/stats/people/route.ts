import { NextResponse, NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

interface CastEntry { id: number; name: string; gender: number; image: string | null }

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = session.user.id
  const type = req.nextUrl.searchParams.get("type") ?? "actors" // actors | actresses | directors | writers

  const isMovieCrew = type === "directors" || type === "writers"

  const counts = new Map<number, { name: string; image: string | null; gender: number; count: number }>()

  if (isMovieCrew) {
    const movies = await db.movie.findMany({
      where: { userId },
      select: { crew: true },
    })
    for (const movie of movies) {
      const crew = (movie.crew ?? []) as unknown as { id: number; name: string; image: string | null; dept: string; job: string }[]
      for (const person of crew) {
        const isMatch =
          (type === "directors" && person.job === "Director") ||
          (type === "writers" && person.dept === "Writing")
        if (!isMatch) continue
        const existing = counts.get(person.id)
        if (existing) existing.count++
        else counts.set(person.id, { name: person.name, image: person.image, gender: 0, count: 1 })
      }
    }
  } else {
    const episodes = await db.episode.findMany({
      where: { userId },
      select: { cast: true },
    })
    for (const episode of episodes) {
      const cast = (episode.cast ?? []) as unknown as CastEntry[]
      for (const person of cast) {
        const isActor = person.gender === 2
        if (type === "actors" && !isActor) continue
        if (type === "actresses" && isActor) continue
        const existing = counts.get(person.id)
        if (existing) existing.count++
        else counts.set(person.id, { name: person.name, image: person.image, gender: person.gender, count: 1 })
      }
    }
  }

  const sorted = [...counts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20)
    .map(([id, data]) => ({ id, ...data }))

  return NextResponse.json(sorted)
}
