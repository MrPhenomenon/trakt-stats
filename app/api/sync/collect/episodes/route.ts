import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getEpisodeHistoryPage } from "@/lib/trakt"
import { getEpisodeDetails, getEpisodeCredits } from "@/lib/tmdb"
import { chunk } from "@/lib/chunk"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { page } = await req.json()
  const username = session.user.username ?? session.user.name ?? ""
  const accessToken = session.accessToken
  if (!accessToken) return NextResponse.json({ error: "No Trakt token" }, { status: 400 })

  const items = await getEpisodeHistoryPage(username, accessToken, page, 100)
  if (!items.length) return NextResponse.json({ items: [], done: true })

  const grouped = new Map<number, { item: (typeof items)[0]; watchedAt: string[] }>()
  for (const item of items) {
    if (!item.episode || !item.show) continue
    const id = item.episode.ids.trakt
    if (!grouped.has(id)) grouped.set(id, { item, watchedAt: [] })
    grouped.get(id)!.watchedAt.push(item.watched_at)
  }

  const entries = [...grouped.values()]
  const processed: object[] = []

  for (const batch of chunk(entries, 20)) {
    const results = await Promise.all(
      batch.map(async ({ item, watchedAt }) => {
        const ep = item.episode!
        const show = item.show!
        const tmdbShowId = show.ids.tmdb
        const [details, credits] = await Promise.all([
          tmdbShowId ? getEpisodeDetails(tmdbShowId, ep.season, ep.number) : null,
          tmdbShowId ? getEpisodeCredits(tmdbShowId, ep.season, ep.number) : null,
        ])
        return {
          traktId: String(ep.ids.trakt),
          tmdbId: ep.ids.tmdb ? String(ep.ids.tmdb) : null,
          episodeTitle: ep.title ?? null,
          showTitle: show.title,
          season: ep.season,
          episode: ep.number,
          plays: watchedAt.length,
          watchedAt,
          runtime: details?.runtime ?? null,
          tmdbShowId: tmdbShowId ? String(tmdbShowId) : null,
          cast: (credits?.cast ?? []).filter((c) => c.profile_path).slice(0, 15)
            .map((c) => ({ id: c.id, name: c.name, gender: c.gender, image: c.profile_path })),
          crew: (credits?.crew ?? [])
            .filter((c) => c.profile_path && (c.job === "Director" || c.department === "Writing"))
            .slice(0, 5)
            .map((c) => ({ id: c.id, name: c.name, dept: c.department, job: c.job, image: c.profile_path })),
        }
      })
    )
    processed.push(...results)
  }

  return NextResponse.json({ items: processed, done: false })
}
