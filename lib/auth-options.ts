import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import path from 'path'
import fs from 'fs'

/**
 * Trouve la racine du projet (dossier contenant package.json).
 */
function findProjectRoot(): string[] {
  const candidates: string[] = []
  candidates.push(process.cwd(), path.resolve(process.cwd()))
  if (typeof __dirname !== 'undefined') {
    candidates.push(
      path.resolve(__dirname, '..'),
      path.resolve(__dirname, '..', '..'),
      path.resolve(__dirname, '..', '..', '..'),
      path.resolve(__dirname, '..', '..', '..', '..')
    )
    let dir = path.resolve(__dirname)
    for (let i = 0; i < 8; i++) {
      if (fs.existsSync(path.join(dir, 'package.json'))) {
        candidates.push(dir)
        break
      }
      const parent = path.dirname(dir)
      if (parent === dir) break
      dir = parent
    }
  }
  return Array.from(new Set(candidates.map((p) => path.resolve(p))))
}

/**
 * Lit .env.local, parse les lignes CLE=valeur et remplit process.env pour les clés vides.
 */
function loadEnvLocalIntoProcess(): void {
  if (typeof window !== 'undefined' || process.env.NODE_ENV !== 'development') return
  const roots = findProjectRoot()
  for (const root of roots) {
    const filePath = path.join(root, '.env.local')
    if (!fs.existsSync(filePath)) continue
    try {
      const raw = fs.readFileSync(filePath, 'utf8')
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eq = trimmed.indexOf('=')
        if (eq <= 0) continue
        const key = trimmed.slice(0, eq).trim()
        let value = trimmed.slice(eq + 1).trim()
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1)
        }
        if (key && (process.env[key] == null || process.env[key] === '')) {
          process.env[key] = value
        }
      }
      return
    } catch {
      // passer au candidat suivant
    }
  }
}

function getGoogleEnv() {
  loadEnvLocalIntoProcess()
  const id = (process.env['GOOGLE_CLIENT_ID'] ?? '').trim()
  const secret = (process.env['GOOGLE_CLIENT_SECRET'] ?? '').trim()
  return { id, secret, hasGoogle: Boolean(id && secret) }
}

const credentialsProvider = CredentialsProvider({
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
    if ((user as { suspended?: boolean }).suspended) return null
    if (!user.emailVerified) {
      throw new Error('EMAIL_NOT_VERIFIED')
    }
    const role = (user as { role?: string }).role ?? 'user'
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      planType: user.planType,
      subscriptionPlan: (user as { subscriptionPlan?: string }).subscriptionPlan ?? 'starter',
      billingCycle: (user as { billingCycle?: string | null }).billingCycle ?? null,
      emailVerified: !!user.emailVerified,
      role,
    }
  },
})

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions['adapter'],
  session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  get providers() {
    const { id, secret, hasGoogle } = getGoogleEnv()
    if (process.env.NODE_ENV === 'development' && !hasGoogle) {
      console.warn(
        '[NextAuth] Connexion Google désactivée : définissez GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET dans .env.local puis redémarrez le serveur.'
      )
    }
    return [
      ...(hasGoogle
        ? [
            GoogleProvider({
              clientId: id!,
              clientSecret: secret!,
              authorization: {
                params: {
                  prompt: 'select_account',
                  scope: 'openid email profile',
                },
              },
            }),
          ]
        : []),
      credentialsProvider,
    ]
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.planType = (user as { planType?: string }).planType ?? 'free'
        token.subscriptionPlan = (user as { subscriptionPlan?: string }).subscriptionPlan ?? 'starter'
        token.billingCycle = (user as { billingCycle?: string | null }).billingCycle ?? null
        token.emailVerified = !!(user as { emailVerified?: boolean }).emailVerified
        token.role = (user as { role?: string }).role ?? 'user'
      }
      if (token.id && (token.subscriptionPlan == null || token.subscriptionPlan === undefined || token.role == null)) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { subscriptionPlan: true, billingCycle: true, planType: true, role: true, suspended: true },
        })
        if (dbUser) {
          if ((dbUser as { suspended?: boolean }).suspended) {
            token.subscriptionPlan = 'starter'
            token.role = 'user'
          } else {
            token.subscriptionPlan = dbUser.subscriptionPlan ?? 'starter'
            token.billingCycle = dbUser.billingCycle ?? null
            token.planType = dbUser.planType ?? 'free'
            token.role = (dbUser as { role?: string }).role ?? 'user'
          }
        }
      }
      if (trigger === 'update' && session) {
        token.name = session.name
        token.picture = session.image
        if ((session as { subscriptionPlan?: string }).subscriptionPlan != null) token.subscriptionPlan = (session as { subscriptionPlan: string }).subscriptionPlan
        if ((session as { billingCycle?: string | null }).billingCycle !== undefined) token.billingCycle = (session as { billingCycle: string | null }).billingCycle
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        const u = session.user as { id?: string; planType?: string; subscriptionPlan?: string; billingCycle?: string | null; emailVerified?: boolean; role?: string }
        u.id = token.id as string
        u.planType = (token.planType as string) ?? 'free'
        u.subscriptionPlan = (token.subscriptionPlan as string) ?? 'starter'
        u.billingCycle = (token.billingCycle as string | null) ?? null
        u.emailVerified = !!(token.emailVerified as boolean)
        u.role = (token.role as string) ?? 'user'
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
        data: { planType: 'free', subscriptionPlan: 'starter', emailVerified: new Date() },
      })
    },
  },
}
