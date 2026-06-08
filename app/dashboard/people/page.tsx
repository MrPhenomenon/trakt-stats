import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { PeopleGrid, type PersonEntry } from "./people-grid"

function aggregateByRuns(
  movies: { cast?: unknown; crew?: unknown }[],
  showGroups: Map<string, { cast?: unknown; crew?: unknown }[]>,
  field: "cast" | "crew",
  filter: (p: Record<string, unknown>) => boolean
): PersonEntry[] {
  const counts = new Map<number, PersonEntry>()

  const bump = (p: Record<string, unknown>) => {
    if (!filter(p)) return
    const id = p.id as number
    const existing = counts.get(id)
    if (existing) existing.count++
    else counts.set(id, { id, name: p.name as string, image: p.image as string | null, gender: (p.gender as number) ?? 0, count: 1 })
  }

  for (const movie of movies) {
    for (const p of (movie[field] ?? []) as Record<string, unknown>[]) bump(p)
  }

  for (const episodes of showGroups.values()) {
    const seenInShow = new Set<number>()
    for (const ep of episodes) {
      for (const p of (ep[field] ?? []) as Record<string, unknown>[]) {
        if (!filter(p)) continue
        const id = p.id as number
        if (!seenInShow.has(id)) {
          seenInShow.add(id)
          bump(p)
        }
      }
    }
  }

  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 20)
}

export default async function PeoplePage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/")

  const userId = session.user.id

  const [episodes, movies] = await Promise.all([
    db.episode.findMany({ where: { userId }, select: { tmdbShowId: true, showTitle: true, cast: true, crew: true } }),
    db.movie.findMany({ where: { userId }, select: { cast: true, crew: true } }),
  ])

  const showGroups = new Map<string, typeof episodes>()
  for (const ep of episodes) {
    const key = ep.tmdbShowId ?? ep.showTitle
    if (!showGroups.has(key)) showGroups.set(key, [])
    showGroups.get(key)!.push(ep)
  }

  const actors    = aggregateByRuns(movies, showGroups, "cast", (p) => p.gender === 2)
  const actresses = aggregateByRuns(movies, showGroups, "cast", (p) => p.gender === 1)
  const directors = aggregateByRuns(movies, showGroups, "crew", (p) => p.job === "Director")
  const writers   = aggregateByRuns(movies, showGroups, "crew", (p) => p.dept === "Writing")

  return (
    <div className="flex flex-col gap-10">
      <h1 className="text-2xl font-bold">People</h1>
      <PeopleGrid people={actors}    label="Most Watched Actors" />
      <PeopleGrid people={actresses} label="Most Watched Actresses" />
      <PeopleGrid people={directors} label="Most Watched Directors" />
      <PeopleGrid people={writers}   label="Most Watched Writers" />
    </div>
  )
}
