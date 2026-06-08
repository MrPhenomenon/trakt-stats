import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      username: string | null
      joinedAt: string | null
    } & DefaultSession["user"]
    accessToken: string
    error?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string
    username?: string
    accessToken?: string
    refreshToken?: string
    accessTokenExpires?: number
    joinedAt?: string | null
    error?: string
  }
}
