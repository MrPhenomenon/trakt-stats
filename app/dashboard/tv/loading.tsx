export default function Loading() {
  return (
    <div className="flex flex-col gap-10 animate-pulse">
      <div className="h-8 w-32 rounded bg-zinc-800" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 h-24" />
        ))}
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 h-64" />
      <div>
        <div className="h-6 w-40 rounded bg-zinc-800 mb-4" />
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className="aspect-[2/3] rounded bg-zinc-800" />
              <div className="h-3 w-full rounded bg-zinc-800" />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 h-48" />
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 h-48" />
    </div>
  )
}
