import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'
import { ThemeProvider } from './theme-provider'

export const metadata: Metadata = {
  title: 'MyFacturation360 – La facturation simple',
  description: 'Créez devis et factures en quelques secondes.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('myfacturation360-theme');document.documentElement.classList.add(t==='dark'?'dark':'light');})();`,
          }}
        />
      </head>
      <body className="antialiased min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <ThemeProvider>
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  )
}
