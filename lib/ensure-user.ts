import { db } from "@/lib/db"
import { Session } from "next-auth"

export async function ensureUser(session: Session) {
  const { id, name, image } = session.user
  await db.user.upsert({
    where: { id },
    create: { id, name: name ?? null, image: image ?? null },
    update: { name: name ?? null, image: image ?? null },
  })
}
