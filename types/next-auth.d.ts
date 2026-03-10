import 'next-auth'

declare module 'next-auth' {
  interface User {
    id: string
    planType?: string
    subscriptionPlan?: string
    billingCycle?: string | null
    emailVerified?: boolean
    role?: string
  }

  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      planType?: string
      subscriptionPlan?: string
      billingCycle?: string | null
      emailVerified?: boolean
      role?: string
    }
  }
}
