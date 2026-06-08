import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ personId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = session.user.id
  const { personId: personIdStr } = await params
  const personId = parseInt(personIdStr)
  if (isNaN(personId)) return NextResponse.json({ error: "Invalid" }, { status: 400 })

  type MovieRow = { title: string; year: number | null; poster: string | null; watchedAt: string[]; plays: number }
  const movies = await db.$queryRaw<MovieRow[]>`
    SELECT title, "releasedYear" AS year, poster, "watchedAt", plays
    FROM "Movie"
    WHERE "userId" = ${userId}
    AND (
      ("cast" IS NOT NULL AND EXISTS (SELECT 1 FROM jsonb_array_elements("cast") e WHERE (e->>'id')::int = ${personId}))
      OR
      (crew IS NOT NULL AND EXISTS (SELECT 1 FROM jsonb_array_elements(crew) e WHERE (e->>'id')::int = ${personId}))
    )
    ORDER BY plays DESC
  `

  type EpRow = { showTitle: string; tmdbShowId: string | null; poster: string | null; year: number | null; watchedAt: string[] }
  const epRows = await db.$queryRaw<EpRow[]>`
    SELECT e."showTitle", e."tmdbShowId", t.poster, t."releasedYear" AS year, e."watchedAt"
    FROM "Episode" e
    LEFT JOIN "TVShow" t ON t."tmdbId" = e."tmdbShowId" AND t."userId" = e."userId"
    WHERE e."userId" = ${userId}
    AND (
      (e."cast" IS NOT NULL AND EXISTS (SELECT 1 FROM jsonb_array_elements(e."cast") el WHERE (el->>'id')::int = ${personId}))
      OR
      (e.crew IS NOT NULL AND EXISTS (SELECT 1 FROM jsonb_array_elements(e.crew) el WHERE (el->>'id')::int = ${personId}))
    )
  `

  // Group episodes by show
  const showMap = new Map<string, { title: string; poster: string | null; year: number | null; watchedAt: string[] }>()
  for (const row of epRows) {
    const key = row.tmdbShowId ?? row.showTitle
    if (!showMap.has(key)) showMap.set(key, { title: row.showTitle, poster: row.poster, year: row.year, watchedAt: [] })
    showMap.get(key)!.watchedAt.push(...row.watchedAt)
  }

  const shows = [...showMap.values()].sort((a, b) => {
    const maxA = a.watchedAt.reduce((m, d) => (d > m ? d : m), "")
    const maxB = b.watchedAt.reduce((m, d) => (d > m ? d : m), "")
    return maxB.localeCompare(maxA)
  })

  return NextResponse.json({ movies, shows })
}
