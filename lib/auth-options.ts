import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions['adapter'],
  session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      authorization: {
        params: {
          prompt: 'select_account', // Ouvre l’interface Google pour choisir le compte à chaque fois
          scope: 'openid email profile', // Pour récupérer nom, email, photo
        },
      },
    }),
    CredentialsProvider({
      name: 'Email et mot de passe',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        })
        if (!user?.passwordHash) return null
        const ok = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!ok) return null
        if (!user.emailVerified) {
          throw new Error('EMAIL_NOT_VERIFIED')
        }
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          planType: user.planType,
          emailVerified: !!user.emailVerified,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.planType = (user as { planType?: string }).planType ?? 'free'
        token.emailVerified = !!(user as { emailVerified?: boolean }).emailVerified
      }
      if (trigger === 'update' && session) {
        token.name = session.name
        token.picture = session.image
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        const u = session.user as { id?: string; planType?: string; emailVerified?: boolean }
        u.id = token.id as string
        u.planType = (token.planType as string) ?? 'free'
        u.emailVerified = !!(token.emailVerified as boolean)
      }
      return session
    },
    async signIn({ user, account }) {
      if (account?.provider === 'google' && user.email) {
        const existing = await prisma.user.findUnique({
          where: { email: user.email },
        })
        if (existing && !existing.emailVerified) {
          await prisma.user.update({
            where: { id: existing.id },
            data: { emailVerified: new Date(), verificationCode: null, verificationCodeExp: null },
          })
        }
      }
      return true
    },
  },
  events: {
    async createUser({ user }) {
      // Compte créé via Google (ou autre OAuth) : plan gratuit + email considérée vérifiée
      await prisma.user.update({
        where: { id: user.id },
        data: { planType: 'free', emailVerified: new Date() },
      })
    },
  },
}
