import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: { signIn: '/login' },
  callbacks: {
    authorized: ({ token }) => !!token,
  },
})

export const config = {
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
    '/parametres/:path*',
  ],
}
