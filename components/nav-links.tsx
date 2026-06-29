"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const LINKS = [
  { href: "/dashboard",         label: "Overview" },
  { href: "/dashboard/movies",  label: "Movies" },
  { href: "/dashboard/tv",      label: "TV Shows" },
  { href: "/dashboard/people",  label: "People" },
  { href: "/dashboard/history", label: "History" },
  { href: "/dashboard/sync",    label: "Sync" },
]

export function NavLinks() {
  const pathname = usePathname()

  return (
    <>
      {LINKS.map((link) => {
        const isActive =
          link.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(link.href)

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
              isActive
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
            }`}
          >
            {link.label}
          </Link>
        )
      })}
    </>
  )
}
