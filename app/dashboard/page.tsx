import { auth } from "@/lib/auth"
import type { Session } from "next-auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { db } from "@/lib/db"
import SyncPanel from "./sync-panel"
import { LocalDate } from "@/components/local-date"

function ProfileBanner({ session }: { session: Session | null }) {
  if (!session?.user) return null
  const joinedYear = session.user.joinedAt
    ? new Date(session.user.joinedAt).getFullYear()
    : null

  return (
    <div className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      {session.user.image && (
        <Image
          src={session.user.image}
          alt={session.user.name ?? ""}
          width={56}
          height={56}
          className="rounded-full ring-2 ring-zinc-700"
        />
      )}
      <div>
        <p className="text-xl font-bold text-white">{session.user.name}</p>
        <div className="flex items-center gap-3 mt-0.5">
          {session.user.username && (
            <span className="text-sm text-zinc-400">@{session.user.username}</span>
          )}
          {joinedYear && (
            <span className="text-sm text-zinc-600">· Member since {joinedYear}</span>
          )}
        </div>
      </div>
    </div>
  )
}

async function getOverview(userId: string) {
  const [movieAgg, showAgg, episodeAgg, syncStatus, recentMovies, recentEpisodes] = await Promise.all([
    db.movie.aggregate({ where: { userId }, _count: { id: true }, _sum: { plays: true, runtime: true } }),
    db.tVShow.aggregate({ where: { userId }, _count: { id: true }, _sum: { episodePlays: true } }),
    db.episode.aggregate({ where: { userId }, _count: { id: true }, _sum: { runtime: true } }),
    db.syncStatus.findUnique({ where: { userId } }),
    db.movie.findMany({ where: { userId }, select: { title: true, poster: true, watchedAt: true, rating: true } }),
    db.episode.findMany({
      where: { userId },
      select: { episodeTitle: true, showTitle: true, season: true, episode: true, watchedAt: true, tmdbShowId: true },
    }),
  ])
  return { movieAgg, showAgg, episodeAgg, syncStatus, recentMovies, recentEpisodes }
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 flex flex-col gap-1">
      <span className="text-xs text-zinc-500 uppercase tracking-wider">{label}</span>
      <span className="text-3xl font-bold text-white">{typeof value === "number" ? value.toLocaleString() : value}</span>
      {sub && <span className="text-xs text-zinc-500">{sub}</span>}
    </div>
  )
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/")

  const userId = session.user.id
  const { movieAgg, showAgg, episodeAgg, syncStatus, recentMovies, recentEpisodes } = await getOverview(userId)


  const hasData = (movieAgg._count.id ?? 0) > 0
  const totalHours = Math.round(((movieAgg._sum.runtime ?? 0) + (episodeAgg._sum.runtime ?? 0)) / 60)

  const shows = hasData
    ? await db.tVShow.findMany({ where: { userId }, select: { tmdbId: true, poster: true } })
    : []
  const showPosterMap = new Map<string | null, string | null>()
  for (const s of shows) showPosterMap.set(s.tmdbId, s.poster)

  type RecentItem = { type: "movie" | "episode"; title: string; sub: string; poster: string | null; watchedAt: string; rating: number | null }
  const recentItems: RecentItem[] = []

  for (const m of recentMovies) {
    for (const ts of m.watchedAt) {
      recentItems.push({ type: "movie", title: m.title, sub: "Movie", poster: m.poster, watchedAt: ts, rating: m.rating })
    }
  }
  for (const ep of recentEpisodes) {
    const seCode = `S${String(ep.season).padStart(2,"0")}E${String(ep.episode).padStart(2,"0")}`
    const epLabel = ep.episodeTitle ? `${seCode} — ${ep.episodeTitle}` : seCode
    for (const ts of ep.watchedAt) {
      recentItems.push({
        type: "episode",
        title: ep.showTitle,
        sub: epLabel,
        poster: showPosterMap.get(ep.tmdbShowId ?? "") ?? null,
        watchedAt: ts,
        rating: null,
      })
    }
  }
  recentItems.sort((a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime())
  const recent10 = recentItems.slice(0, 10)

  return (
    <div className="flex flex-col gap-8">
      <ProfileBanner session={session} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Overview</h1>
          {syncStatus?.lastSynced && (
            <p className="text-sm text-zinc-500 mt-0.5">
              Last synced {new Date(syncStatus.lastSynced).toLocaleDateString("en-US", {
                month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
              })}
            </p>
          )}
        </div>
        {hasData && <SyncPanel lastSynced={syncStatus?.lastSynced?.toISOString() ?? null} compact />}
      </div>

      {hasData ? (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Movie Plays" value={movieAgg._sum.plays ?? 0} sub={`${movieAgg._count.id} unique`} />
            <StatCard label="TV Episodes" value={showAgg._sum.episodePlays ?? 0} sub={`${showAgg._count.id} shows`} />
            <StatCard label="Hours Watched" value={totalHours} sub={`${Math.round(totalHours / 24)} days`} />
            <StatCard
              label="Movie Hours"
              value={Math.round((movieAgg._sum.runtime ?? 0) / 60)}
              sub={`${Math.round((episodeAgg._sum.runtime ?? 0) / 60)} hrs TV`}
            />
          </div>

          {/* Recent watches */}
          {recent10.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Recently Watched</h2>
                <Link href="/dashboard/history" className="text-sm text-zinc-500 hover:text-white transition">
                  View all →
                </Link>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800">
                {recent10.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <div className="relative w-8 h-11 shrink-0 rounded overflow-hidden bg-zinc-800">
                      {item.poster && (
                        <Image src={`https://image.tmdb.org/t/p/w92${item.poster}`} alt={item.title} fill className="object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate font-medium">{item.title}</p>
                      <p className="text-xs text-zinc-500 truncate">{item.sub}</p>
                    </div>
                    <LocalDate watchedAt={item.watchedAt} rating={item.rating} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick links */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { href: "/dashboard/movies", label: "Movies Stats", icon: "🎬" },
              { href: "/dashboard/tv", label: "TV Stats", icon: "📺" },
              { href: "/dashboard/people", label: "People", icon: "🎭" },
              { href: "/dashboard/history", label: "Full History", icon: "📋" },
            ].map((l) => (
              <Link key={l.href} href={l.href}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 flex items-center gap-3 hover:border-zinc-600 transition">
                <span className="text-2xl">{l.icon}</span>
                <span className="text-sm font-medium text-zinc-300">{l.label}</span>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <SyncPanel lastSynced={null} compact={false} />
      )}
    </div>
  )
}
