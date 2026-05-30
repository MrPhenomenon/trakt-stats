import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const status = await db.syncStatus.findUnique({
    where: { userId: session.user.id },
  })

  return NextResponse.json(status ?? { done: false })
}
