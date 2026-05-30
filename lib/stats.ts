export function groupByYear(timestamps: string[]): Record<string, number> {
  const result: Record<string, number> = {}
  for (const ts of timestamps) {
    const year = new Date(ts).getFullYear().toString()
    result[year] = (result[year] ?? 0) + 1
  }
  return result
}

export function groupByMonth(timestamps: string[]): Record<string, number> {
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  const result: Record<string, number> = {}
  for (const m of MONTHS) result[m] = 0
  for (const ts of timestamps) {
    const m = MONTHS[new Date(ts).getMonth()]
    result[m] = (result[m] ?? 0) + 1
  }
  return result
}

export function groupByDayOfWeek(timestamps: string[]): Record<string, number> {
  const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
  const result: Record<string, number> = {}
  for (const d of DAYS) result[d] = 0
  for (const ts of timestamps) {
    const d = DAYS[new Date(ts).getDay()]
    result[d] = (result[d] ?? 0) + 1
  }
  return result
}

export function groupByHour(timestamps: string[]): Record<string, number> {
  const result: Record<string, number> = {}
  for (let h = 0; h < 24; h++) result[h.toString().padStart(2, "0")] = 0
  for (const ts of timestamps) {
    const h = new Date(ts).getHours().toString().padStart(2, "0")
    result[h] = (result[h] ?? 0) + 1
  }
  return result
}

export function groupByGenre(items: { genres: string[] }[]): Record<string, number> {
  const result: Record<string, number> = {}
  for (const item of items) {
    for (const g of item.genres) {
      result[g] = (result[g] ?? 0) + 1
    }
  }
  return Object.fromEntries(Object.entries(result).sort((a, b) => b[1] - a[1]))
}

export function groupByCountry(items: { countries: string[] }[]): Record<string, number> {
  const result: Record<string, number> = {}
  for (const item of items) {
    for (const c of item.countries) {
      result[c] = (result[c] ?? 0) + 1
    }
  }
  return Object.fromEntries(Object.entries(result).sort((a, b) => b[1] - a[1]))
}

export function groupByReleasedYear(items: { releasedYear: number | null }[]): Record<string, number> {
  const result: Record<string, number> = {}
  for (const item of items) {
    if (!item.releasedYear) continue
    const y = item.releasedYear.toString()
    result[y] = (result[y] ?? 0) + 1
  }
  return Object.fromEntries(Object.entries(result).sort((a, b) => Number(a[0]) - Number(b[0])))
}

export function ratingDistribution(items: { rating: number | null }[]): Record<string, number> {
  const result: Record<string, number> = {}
  for (let i = 1; i <= 10; i++) result[i.toString()] = 0
  for (const item of items) {
    if (item.rating) result[item.rating.toString()] = (result[item.rating.toString()] ?? 0) + 1
  }
  return result
}

export function perYearAverage(totalHours: number, timestamps: string[]): number {
  if (!timestamps.length) return 0
  const years = new Set(timestamps.map(ts => new Date(ts).getFullYear()))
  return Math.round(totalHours / years.size)
}
