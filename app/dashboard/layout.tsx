import { auth, signOut } from "@/lib/auth"
import { redirect } from "next/navigation"
import Image from "next/image"
import { NavLinks } from "@/components/nav-links"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect("/")
  if (session.error === "RefreshAccessTokenError") redirect("/")

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-4">
          <span className="text-[#ed1c24] font-bold text-base tracking-tight shrink-0">
            Trakt Stats
          </span>

          <div className="flex items-center gap-2.5">
            {session.user.image && (
              <Image
                src={session.user.image}
                alt={session.user.name ?? ""}
                width={26}
                height={26}
                className="rounded-full ring-1 ring-zinc-700 shrink-0"
              />
            )}
            <div className="flex flex-col items-end leading-none">
              <span className="text-sm text-white font-medium truncate max-w-[120px]">
                {session.user.name}
              </span>
              {session.user.username && (
                <span className="text-[10px] text-zinc-500 hidden sm:block">
                  @{session.user.username}
                </span>
              )}
            </div>
            <form
              action={async () => {
                "use server"
                await signOut({ redirectTo: "/" })
              }}
            >
              <button className="text-xs text-zinc-600 hover:text-white transition">
                Sign out
              </button>
            </form>
          </div>
        </div>

        {/* Nav row: scrollable on mobile, normal on desktop */}
        <div className="border-t border-zinc-800/60">
          <div className="mx-auto max-w-7xl px-4">
            <nav className="flex overflow-x-auto scrollbar-hide gap-1 py-1">
              <NavLinks />
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </div>
  )
}
