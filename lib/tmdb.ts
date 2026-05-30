const BASE = "https://api.themoviedb.org/3"
const KEY = process.env.TMDB_API_KEY

async function tmdbGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}?api_key=${KEY}`, {
      next: { revalidate: 86400 }, // cache 24h
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export interface TMDbMovie {
  genres?: { id: number; name: string }[]
  runtime?: number
  poster_path?: string | null
  production_companies?: { id: number; name: string; logo_path?: string; origin_country: string }[]
  production_countries?: { iso_3166_1: string; name: string }[]
}

export interface TMDbMovieCredits {
  cast?: { id: number; name: string; gender: number; profile_path?: string | null }[]
  crew?: { id: number; name: string; department: string; job: string; profile_path?: string | null }[]
}

export interface TMDbShow {
  genres?: { id: number; name: string }[]
  poster_path?: string | null
  networks?: { id: number; name: string; logo_path?: string }[]
  production_countries?: { iso_3166_1: string; name: string }[]
}

export interface TMDbEpisode {
  runtime?: number
}

export interface TMDbEpisodeCredits {
  cast?: { id: number; name: string; gender: number; profile_path?: string | null }[]
  crew?: { id: number; name: string; department: string; job: string; profile_path?: string | null }[]
}

export async function getMovieDetails(tmdbId: number) {
  return tmdbGet<TMDbMovie>(`/movie/${tmdbId}`)
}

export async function getMovieCredits(tmdbId: number) {
  return tmdbGet<TMDbMovieCredits>(`/movie/${tmdbId}/credits`)
}

export async function getShowDetails(tmdbId: number) {
  return tmdbGet<TMDbShow>(`/tv/${tmdbId}`)
}

export async function getEpisodeDetails(tmdbShowId: number, season: number, episode: number) {
  return tmdbGet<TMDbEpisode>(`/tv/${tmdbShowId}/season/${season}/episode/${episode}`)
}

export async function getEpisodeCredits(tmdbShowId: number, season: number, episode: number) {
  return tmdbGet<TMDbEpisodeCredits>(
    `/tv/${tmdbShowId}/season/${season}/episode/${episode}/credits`
  )
}

export function parseGenres(genres?: { name: string }[]): string[] {
  const result: string[] = []
  for (const g of genres ?? []) {
    if (g.name.includes(" & ")) result.push(...g.name.split(" & "))
    else result.push(g.name)
  }
  return result
}
