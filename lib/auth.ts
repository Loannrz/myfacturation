import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'

export type SessionUser = {
  id: string
  name?: string | null
  email?: string | null
  image?: string | null
  planType?: string
  emailVerified?: boolean
}

/**
 * Récupère la session utilisateur côté serveur (API routes, Server Components).
 * Retourne null si non connecté.
 */
export async function getSession() {
  const session = await getServerSession(authOptions)
  const user = session?.user as SessionUser | undefined
  if (!user?.id || !session) return null
  return { ...session, user: { ...user, id: user.id } }
}

/**
 * Vérifie que l'utilisateur est connecté et que l'email est vérifié (pour login email/password).
 * Redirige ou retourne null selon le contexte.
 */
export async function requireSession(): Promise<{ id: string; email: string | null; name: string | null; planType: string } | null> {
  const session = await getSession()
  if (!session?.user?.id) return null
  const u = session.user as SessionUser
  return {
    id: u.id,
    email: u.email ?? null,
    name: u.name ?? null,
    planType: u.planType ?? 'free',
  }
}
