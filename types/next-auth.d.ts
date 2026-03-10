import 'next-auth'

declare module 'next-auth' {
  interface User {
    id: string
    planType?: string
    emailVerified?: boolean
  }

  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      planType?: string
      emailVerified?: boolean
    }
  }
}
