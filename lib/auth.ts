import NextAuth from "next-auth"
import type { JWT } from "next-auth/jwt"

async function refreshTraktToken(token: JWT): Promise<JWT> {
  const baseUrl = process.env.NEXTAUTH_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

  try {
    const res = await fetch("https://api.trakt.tv/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refresh_token: token.refreshToken,
        client_id: process.env.TRAKT_CLIENT_ID,
        client_secret: process.env.TRAKT_CLIENT_SECRET,
        redirect_uri: `${baseUrl}/api/auth/callback/trakt`,
        grant_type: "refresh_token",
      }),
    })

    if (!res.ok) return { ...token, error: "RefreshAccessTokenError" }

    const data = await res.json()
    return {
      ...token,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? token.refreshToken,
      accessTokenExpires: Date.now() + data.expires_in * 1000,
      error: undefined,
    }
  } catch {
    return { ...token, error: "RefreshAccessTokenError" }
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    {
      id: "trakt",
      name: "Trakt",
      type: "oauth",
      checks: ["state"],
      authorization: {
        url: "https://trakt.tv/oauth/authorize",
        params: {},
      },
      token: {
        url: "https://api.trakt.tv/oauth/token",
        async conform(response: Response) {
          const body = await response.json()
          return new Response(
            JSON.stringify({
              access_token: body.access_token,
              refresh_token: body.refresh_token,
              expires_in: body.expires_in,
              token_type: body.token_type ?? "Bearer",
            }),
            { status: response.status, headers: { "Content-Type": "application/json" } }
          )
        },
      },
      userinfo: {
        url: `${process.env.NEXTAUTH_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")}/api/trakt-profile`,
      },
      profile(profile: {
        ids?: { slug?: string }
        username?: string
        name?: string
        images?: { avatar?: { full?: string } }
      }) {
        const slug = profile.ids?.slug ?? profile.username ?? "unknown"
        return {
          id: slug,
          name: profile.name ?? profile.username ?? slug,
          email: `${slug}@trakt.invalid`,
          image: profile.images?.avatar?.full ?? null,
          username: profile.username ?? slug,
        }
      },
      clientId: process.env.TRAKT_CLIENT_ID,
      clientSecret: process.env.TRAKT_CLIENT_SECRET,
    },
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const p = profile as {
          ids?: { slug?: string }
          username?: string
          name?: string
          joined_at?: string
          images?: { avatar?: { full?: string } }
        }
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        // expires_at from NextAuth is in seconds; convert to ms for consistent comparison
        token.accessTokenExpires = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + 7776000 * 1000 // 90-day default
        token.username = p.ids?.slug ?? p.username ?? token.sub
        token.userId = p.ids?.slug ?? p.username ?? token.sub
        token.joinedAt = p.joined_at ?? null
        return token
      }

      // Token still valid — pass through
      if (Date.now() < (token.accessTokenExpires as number)) return token

      // Token expired — refresh it
      return refreshTraktToken(token)
    },
    async session({ session, token }) {
      session.user.id = token.userId as string
      session.user.username = token.username as string
      session.accessToken = token.accessToken as string
      session.user.joinedAt = token.joinedAt as string | null
      session.error = token.error as string | undefined
      return session
    },
  },
  pages: { signIn: "/" },
})
