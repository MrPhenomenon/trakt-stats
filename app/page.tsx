import { auth, signIn } from "@/lib/auth"
import { redirect } from "next/navigation"
export default async function LoginPage() {
  const session = await auth()
  if (session?.user && !session.error) redirect("/dashboard")

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="flex flex-col items-center gap-3">
        <svg viewBox="0 0 64 64" className="h-16 w-16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="32" cy="32" r="32" fill="#ed1c24"/>
          <path d="M20 20 L32 32 L44 20 M20 44 L32 32 L44 44" stroke="white" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <h1 className="text-4xl font-bold tracking-tight">Trakt Stats</h1>
        <p className="text-center text-zinc-400 max-w-sm">
          Your complete watch history, stats, and insights — no VIP subscription required.
        </p>
      </div>

      <form
        action={async () => {
          "use server"
          await signIn("trakt", { redirectTo: "/dashboard" })
        }}
      >
        <button
          type="submit"
          className="flex items-center gap-3 rounded-lg bg-[#ed1c24] px-6 py-3 font-semibold text-white transition hover:bg-[#c5151c] active:scale-95"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 7.313l-1.56 1.562-1.562-1.562-1.563 1.562 1.563 1.563-1.563 1.562 1.563 1.563 1.562-1.563 1.56 1.563 1.563-1.563-1.562-1.562 1.562-1.563-1.562-1.562zm-9.374 0L6.626 8.875 5.063 7.313 3.5 8.875l1.563 1.563L3.5 12l1.563 1.562 1.563-1.562 1.562 1.562 1.563-1.562-1.563-1.563 1.563-1.562-1.562-1.562z" />
          </svg>
          Login with Trakt
        </button>
      </form>

      <p className="text-xs text-zinc-600">
        We only read your watch history. Nothing is posted or modified.
      </p>
    </div>
  )
}
