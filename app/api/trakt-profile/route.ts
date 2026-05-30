import { NextRequest } from "next/server"

export async function GET(req: NextRequest) {
  const authorization = req.headers.get("Authorization") ?? ""

  console.log("[trakt-profile] auth header prefix:", authorization.substring(0, 30))
  console.log("[trakt-profile] TRAKT_CLIENT_ID present:", !!process.env.TRAKT_CLIENT_ID)

  const res = await fetch("https://api.trakt.tv/users/me?extended=full", {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "trakt-api-version": "2",
      "trakt-api-key": process.env.TRAKT_CLIENT_ID!,
      Authorization: authorization,
      "User-Agent": "TraktStats/1.0",
    },
  })

  const text = await res.text()
  console.log("[trakt-profile] trakt status:", res.status)
  console.log("[trakt-profile] trakt response:", text.substring(0, 300))

  try {
    return Response.json(JSON.parse(text), { status: res.status })
  } catch {
    return Response.json(
      { error: "Non-JSON from Trakt", status: res.status, body: text.substring(0, 200) },
      { status: 502 }
    )
  }
}
