import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export interface SearchResult {
  traktId: string
  tmdbId: string | null
  title: string
  year: number | null
  poster: string | null
  type: "movie" | "show"
  plays: number
  inDb: boolean
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = session.user.id
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? ""
  if (q.length < 2) return NextResponse.json({ results: [] })

  const [movies, shows] = await Promise.all([
    db.movie.findMany({
      where: { userId, title: { contains: q, mode: "insensitive" } },
      select: { traktId: true, tmdbId: true, title: true, releasedYear: true, poster: true, plays: true },
      orderBy: { plays: "desc" },
      take: 6,
    }),
    db.tVShow.findMany({
      where: { userId, title: { contains: q, mode: "insensitive" } },
      select: { traktId: true, tmdbId: true, title: true, releasedYear: true, poster: true, episodePlays: true },
      orderBy: { episodePlays: "desc" },
      take: 6,
    }),
  ])

  const localResults: SearchResult[] = [
    ...movies.map((m) => ({
      traktId: m.traktId, tmdbId: m.tmdbId, title: m.title,
      year: m.releasedYear, poster: m.poster, type: "movie" as const,
      plays: m.plays, inDb: true,
    })),
    ...shows.map((s) => ({
      traktId: s.traktId, tmdbId: s.tmdbId, title: s.title,
      year: s.releasedYear, poster: s.poster, type: "show" as const,
      plays: s.episodePlays, inDb: true,
    })),
  ]

  const localIds = new Set(localResults.map((r) => r.traktId))

  // Always search Trakt too — covers items not yet in DB
  let traktResults: SearchResult[] = []
  try {
    const res = await fetch(
      `https://api.trakt.tv/search/movie,show?query=${encodeURIComponent(q)}&limit=8`,
      {
        headers: {
          "Content-Type": "application/json",
          "trakt-api-version": "2",
          "trakt-api-key": process.env.TRAKT_CLIENT_ID!,
        },
        next: { revalidate: 0 },
      }
    )
    if (res.ok) {
      const raw = await res.json()
      traktResults = (raw as Array<{ type: string; movie?: { title: string; year: number; ids: { trakt: number; tmdb?: number } }; show?: { title: string; year: number; ids: { trakt: number; tmdb?: number } } }>)
        .map((r) => {
          const item = r.movie ?? r.show!
          return {
            traktId: String(item.ids.trakt),
            tmdbId: item.ids.tmdb ? String(item.ids.tmdb) : null,
            title: item.title,
            year: item.year ?? null,
            poster: null,
            type: r.type as "movie" | "show",
            plays: 0,
            inDb: false,
          }
        })
        .filter((r) => !localIds.has(r.traktId))
    }
  } catch {
    // Trakt search is best-effort
  }

  return NextResponse.json({ results: [...localResults, ...traktResults] })
}
