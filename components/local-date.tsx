"use client"

export function LocalDate({ watchedAt, rating }: { watchedAt: string; rating?: number | null }) {
  const date = new Date(watchedAt)
  return (
    <div className="text-right shrink-0">
      {rating != null && <p className="text-xs text-[#ed1c24] font-bold mb-0.5">★ {rating}</p>}
      <p className="text-xs text-zinc-500">
        {date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
      </p>
      <p className="text-xs text-zinc-700">
        {date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
      </p>
    </div>
  )
}
