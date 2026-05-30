import NextAuth from "next-auth"

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
        token.username = p.ids?.slug ?? p.username ?? token.sub
        token.userId = p.ids?.slug ?? p.username ?? token.sub
        token.joinedAt = p.joined_at ?? null
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.userId as string
      session.user.username = token.username as string
      session.accessToken = token.accessToken as string
      session.user.joinedAt = token.joinedAt as string | null
      return session
    },
  },
  pages: { signIn: "/" },
})
