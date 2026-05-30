"use client"

const LABELS: Record<string, string> = {
  "10": "TOTALLY NINJA", "9": "SUPERB", "8": "GREAT", "7": "GOOD",
  "6": "FAIR", "5": "MEH", "4": "POOR", "3": "BAD", "2": "TERRIBLE", "1": "WEAK SAUCE",
}

export function RatingsChart({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data)
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .filter(([, v]) => v > 0)

  const max = Math.max(...entries.map(([, v]) => v), 1)

  return (
    <div className="flex flex-col gap-2">
      {entries.map(([rating, count]) => (
        <div key={rating} className="flex items-center gap-3">
          <span className="w-4 text-right text-sm font-bold text-white">{rating}</span>
          <div className="flex-1 bg-zinc-800 rounded-full h-6 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#ed1c24] flex items-center px-2 transition-all"
              style={{ width: `${Math.max((count / max) * 100, count > 0 ? 4 : 0)}%` }}
            />
          </div>
          <span className="w-28 text-xs text-zinc-500 truncate">{LABELS[rating]}</span>
          <span className="w-8 text-right text-xs text-zinc-400">{count}</span>
        </div>
      ))}
      {entries.length === 0 && (
        <p className="text-zinc-600 text-sm">No ratings yet</p>
      )}
    </div>
  )
}
