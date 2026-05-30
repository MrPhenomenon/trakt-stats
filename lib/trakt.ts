const BASE = "https://api.trakt.tv"

export function traktHeaders(accessToken: string) {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "trakt-api-version": "2",
    "trakt-api-key": process.env.TRAKT_CLIENT_ID!,
    Authorization: `Bearer ${accessToken}`,
    "User-Agent": "TraktStats/1.0",
  }
}

export async function traktGet<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: traktHeaders(accessToken),
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`Trakt ${path} → ${res.status}`)
  return res.json()
}

export async function getMovieHistoryPage(
  username: string,
  accessToken: string,
  page: number,
  limit = 100
) {
  return traktGet<TraktHistoryItem[]>(
    `/users/${username}/history/movies?page=${page}&limit=${limit}`,
    accessToken
  )
}

export async function getEpisodeHistoryPage(
  username: string,
  accessToken: string,
  page: number,
  limit = 100
) {
  return traktGet<TraktHistoryItem[]>(
    `/users/${username}/history/episodes?page=${page}&limit=${limit}`,
    accessToken
  )
}

export async function getWatchedShows(username: string, accessToken: string) {
  return traktGet<TraktWatchedShow[]>(
    `/users/${username}/watched/shows?extended=noseasons`,
    accessToken
  )
}

export async function getRatings(username: string, accessToken: string) {
  return traktGet<TraktRating[]>(`/users/${username}/ratings`, accessToken)
}

export async function getList(listSlug: string, accessToken: string) {
  try {
    return await traktGet<TraktListItem[]>(`/lists/${listSlug}/items`, accessToken)
  } catch {
    return []
  }
}

export interface TraktHistoryItem {
  id: number
  watched_at: string
  action: string
  type: string
  movie?: {
    title: string
    year: number
    ids: { trakt: number; slug: string; imdb?: string; tmdb?: number }
  }
  show?: {
    title: string
    year: number
    ids: { trakt: number; slug: string; imdb?: string; tmdb?: number }
  }
  episode?: {
    season: number
    number: number
    title?: string
    ids: { trakt: number; tvdb?: number; imdb?: string; tmdb?: number }
  }
}

export interface TraktWatchedShow {
  plays: number
  last_watched_at: string
  show: {
    title: string
    year: number
    ids: { trakt: number; slug: string; imdb?: string; tmdb?: number }
  }
}

export interface TraktRating {
  rated_at: string
  rating: number
  type: string
  movie?: { ids: { trakt: number } }
  show?: { ids: { trakt: number } }
  episode?: { ids: { trakt: number } }
}

export interface TraktListItem {
  rank: number
  type: string
  movie?: { title: string; year: number; ids: { trakt: number; imdb?: string; tmdb?: number } }
  show?: { title: string; year: number; ids: { trakt: number; imdb?: string; tmdb?: number } }
}
