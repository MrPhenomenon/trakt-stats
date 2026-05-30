"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const LINKS = [
  { href: "/dashboard",         label: "Overview" },
  { href: "/dashboard/movies",  label: "Movies" },
  { href: "/dashboard/tv",      label: "TV Shows" },
  { href: "/dashboard/people",  label: "People" },
  { href: "/dashboard/history", label: "History" },
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
            className={`text-sm font-medium transition-colors ${
              isActive ? "text-white" : "text-zinc-400 hover:text-white"
            }`}
          >
            {link.label}
            {isActive && (
              <span className="ml-1 inline-block h-1 w-1 rounded-full bg-[#ed1c24] align-middle" />
            )}
          </Link>
        )
      })}
    </>
  )
}
