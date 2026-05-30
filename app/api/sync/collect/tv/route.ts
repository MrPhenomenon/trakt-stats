import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getWatchedShows } from "@/lib/trakt"
import { getShowDetails, parseGenres } from "@/lib/tmdb"
import { chunk } from "@/lib/chunk"

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const username = session.user.username ?? session.user.name ?? ""
  const accessToken = session.accessToken
  if (!accessToken) return NextResponse.json({ error: "No Trakt token" }, { status: 400 })

  const shows = await getWatchedShows(username, accessToken)

  const processed: object[] = []
  for (const batch of chunk(shows, 20)) {
    const results = await Promise.all(
      batch.map(async (item) => {
        const tmdbId = item.show.ids.tmdb
        const details = tmdbId ? await getShowDetails(tmdbId) : null
        return {
          traktId: String(item.show.ids.trakt),
          tmdbId: tmdbId ? String(tmdbId) : null,
          title: item.show.title,
          episodePlays: item.plays,
          releasedYear: item.show.year ?? null,
          poster: details?.poster_path ?? null,
          genres: parseGenres(details?.genres),
          countries: (details?.production_countries ?? []).map((c) => c.name),
          networks: (details?.networks ?? []).map((n) => ({
            id: n.id, name: n.name, image: n.logo_path ?? null,
          })),
        }
      })
    )
    processed.push(...results)
  }

  return NextResponse.json({ items: processed })
}
