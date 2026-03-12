import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: { signIn: '/login' },
  callbacks: {
    authorized: ({ token }) => !!token,
  },
})

export const config = {
  // Ne pas exécuter le middleware sur les assets statiques (_next, api, etc.)
  matcher: [
    '/dashboard/:path*',
    '/factures/:path*',
    '/devis/:path*',
    '/avoirs/:path*',
    '/clients/:path*',
    '/produits/:path*',
    '/creer/:path*',
    '/activite/:path*',
    '/comptabilite/:path*',
    '/depenses/:path*',
    '/parametres/:path*',
    '/messages/:path*',
    '/settings/:path*',
  ],
}
