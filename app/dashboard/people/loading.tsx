export default function Loading() {
  return (
    <div className="flex flex-col gap-10 animate-pulse">
      <div className="h-8 w-32 rounded bg-zinc-800" />
      {Array.from({ length: 4 }).map((_, section) => (
        <div key={section}>
          <div className="h-6 w-48 rounded bg-zinc-800 mb-4" />
          <div className="grid grid-cols-5 gap-3 sm:grid-cols-10">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="w-16 h-16 rounded-full bg-zinc-800" />
                <div className="h-2.5 w-12 rounded bg-zinc-800" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
