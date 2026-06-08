"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"

export type PersonEntry = {
  id: number
  name: string
  image: string | null
  gender: number
  count: number
}

type TitleMovie = { title: string; year: number | null; poster: string | null; watchedAt: string[]; plays: number }
type TitleShow  = { title: string; year: number | null; poster: string | null; watchedAt: string[] }
type PersonTitles = { movies: TitleMovie[]; shows: TitleShow[] }

function TitleRow({ poster, title, year, sub }: { poster: string | null; title: string; year: number | null; sub: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="relative w-8 h-12 rounded bg-zinc-800 shrink-0 overflow-hidden">
        {poster && (
          <Image src={`https://image.tmdb.org/t/p/w92${poster}`} alt={title} fill sizes="32px" className="object-cover" />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-white truncate">
          {title}
          {year && <span className="text-zinc-500 font-normal"> ({year})</span>}
        </p>
        <p className="text-xs text-zinc-500">{sub}</p>
      </div>
    </div>
  )
}

function PersonModal({ person, onClose }: { person: PersonEntry; onClose: () => void }) {
  const [data, setData]       = useState<PersonTitles | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  useEffect(() => {
    fetch(`/api/people/${person.id}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [person.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [onClose])

  const fmtDate = useCallback((dates: string[]) => {
    if (!dates.length) return null
    const latest = dates.reduce((m, d) => (d > m ? d : m), "")
    return new Date(latest).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full sm:max-w-lg max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-zinc-800 bg-zinc-950">
        {/* Header */}
        <div className="flex items-center gap-4 p-5 border-b border-zinc-800 shrink-0">
          <div className="relative w-12 h-12 rounded-full overflow-hidden bg-zinc-800 shrink-0">
            {person.image && (
              <Image src={`https://image.tmdb.org/t/p/w185${person.image}`} alt={person.name} fill sizes="48px" className="object-cover" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold leading-tight">{person.name}</h2>
            <p className="text-xs text-zinc-500">{person.count} title{person.count !== 1 ? "s" : ""} in your history</p>
          </div>
          <button onClick={onClose} className="ml-auto text-zinc-500 hover:text-white transition text-lg leading-none p-1">✕</button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-6">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-700 border-t-white" />
            </div>
          )}

          {error && <p className="text-sm text-red-400 py-4 text-center">Failed to load titles.</p>}

          {data && (
            <>
              {data.movies.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                    Movies ({data.movies.length})
                  </h3>
                  <div className="divide-y divide-zinc-800/50">
                    {data.movies.map((m, i) => (
                      <TitleRow
                        key={i}
                        poster={m.poster}
                        title={m.title}
                        year={m.year}
                        sub={[
                          m.plays === 1 ? "Watched once" : `Watched ${m.plays}×`,
                          fmtDate(m.watchedAt),
                        ].filter(Boolean).join(" · ")}
                      />
                    ))}
                  </div>
                </section>
              )}

              {data.shows.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                    TV Shows ({data.shows.length})
                  </h3>
                  <div className="divide-y divide-zinc-800/50">
                    {data.shows.map((s, i) => (
                      <TitleRow
                        key={i}
                        poster={s.poster}
                        title={s.title}
                        year={s.year}
                        sub={[
                          `${s.watchedAt.length} episode${s.watchedAt.length !== 1 ? "s" : ""}`,
                          fmtDate(s.watchedAt) ? `last ${fmtDate(s.watchedAt)}` : null,
                        ].filter(Boolean).join(" · ")}
                      />
                    ))}
                  </div>
                </section>
              )}

              {data.movies.length === 0 && data.shows.length === 0 && (
                <p className="text-sm text-zinc-500 py-4 text-center">No titles found.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function PeopleGrid({ people, label }: { people: PersonEntry[]; label: string }) {
  const [selected, setSelected] = useState<PersonEntry | null>(null)

  return (
    <>
      <section>
        <h2 className="text-lg font-semibold mb-4">{label}</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-10">
          {people.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className="flex flex-col gap-1 items-center text-center group"
            >
              <div className="relative w-16 h-16 rounded-full overflow-hidden bg-zinc-800 shrink-0 ring-2 ring-transparent group-hover:ring-[#ed1c24] transition">
                {p.image && (
                  <Image src={`https://image.tmdb.org/t/p/w185${p.image}`} alt={p.name} fill sizes="64px" className="object-cover" />
                )}
              </div>
              <span className="text-xs text-zinc-300 leading-tight group-hover:text-white transition">{p.name}</span>
              <span className="text-xs text-zinc-600">{p.count} title{p.count !== 1 ? "s" : ""}</span>
            </button>
          ))}
        </div>
      </section>

      {selected && <PersonModal person={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
