import NextAuth from 'next-auth'
import path from 'path'
import { authOptions } from '@/lib/auth-options'

function loadEnvLocal() {
  if (process.env.NODE_ENV !== 'development') return
  try {
    require('dotenv').config({ path: path.join(process.cwd(), '.env.local') })
  } catch {
    // dotenv optionnel
  }
}

const nextAuthHandler = NextAuth(authOptions)

function handler(req: Request, context: { params: Promise<{ nextauth: string[] }> }) {
  loadEnvLocal()
  return nextAuthHandler(req, context)
}

export { handler as GET, handler as POST }
