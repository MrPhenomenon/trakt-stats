import { auth, signOut } from "@/lib/auth"
import { redirect } from "next/navigation"
import Image from "next/image"
import { NavLinks } from "@/components/nav-links"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect("/")

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <nav className="flex items-center gap-6">
            <span className="text-[#ed1c24] font-bold text-base tracking-tight">Trakt Stats</span>
            <NavLinks />
          </nav>

          <div className="flex items-center gap-3">
            {session.user.image && (
              <Image
                src={session.user.image}
                alt={session.user.name ?? ""}
                width={28}
                height={28}
                className="rounded-full ring-1 ring-zinc-700"
              />
            )}
            <div className="flex flex-col items-end leading-none">
              <span className="text-sm text-white font-medium">{session.user.name}</span>
              {session.user.username && (
                <span className="text-[11px] text-zinc-500">@{session.user.username}</span>
              )}
            </div>
            <form
              action={async () => {
                "use server"
                await signOut({ redirectTo: "/" })
              }}
            >
              <button className="text-xs text-zinc-600 hover:text-white transition ml-1">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">{children}</main>
    </div>
  )
}
