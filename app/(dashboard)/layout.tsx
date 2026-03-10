'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FileText,
  Receipt,
  Users,
  Wallet,
  Settings,
  Menu,
  X,
  LogOut,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { canAccessFeature } from '@/lib/features'
import { ThemeToggle } from '@/app/theme-toggle'

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/factures', label: 'Factures', icon: Receipt },
  { href: '/devis', label: 'Devis', icon: FileText },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/comptabilite', label: 'Comptabilité', icon: Wallet, premium: true },
  { href: '/parametres', label: 'Paramètres', icon: Settings },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      window.location.href = '/login?callbackUrl=' + encodeURIComponent(pathname || '/dashboard')
    }
  }, [status, pathname])

  if (status === 'loading' || !session) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-[var(--muted)]">Chargement…</div>
      </div>
    )
  }

  const planType = (session.user as { planType?: string })?.planType ?? 'free'

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-[var(--border)]">
        <div className="p-6 border-b border-[var(--border)]">
          <Link href="/dashboard" className="text-xl font-semibold tracking-tight">
            Myfacturation
          </Link>
        </div>
        <nav className="p-4 space-y-0.5">
          {nav.map(({ href, label, icon: Icon, premium }) => {
            if (premium && !canAccessFeature(planType as 'free' | 'premium', 'accounting')) {
              return (
                <span
                  key={href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--muted)] cursor-not-allowed"
                  title="Fonctionnalité Premium"
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </span>
              )
            }
            const isActive = pathname === href || (href !== '/dashboard' && pathname?.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive ? 'bg-[var(--border)]/30 font-medium' : 'text-[var(--muted)] hover:bg-[var(--border)]/20 hover:text-[var(--foreground)]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>
        <div className="mt-auto p-4 border-t border-[var(--border)] space-y-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/' })}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--muted)] hover:bg-[var(--border)]/20 hover:text-[var(--foreground)] w-full"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-4 bg-[var(--background)] border-b border-[var(--border)]">
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          className="p-2 rounded-lg hover:bg-[var(--border)]/20"
          aria-label="Menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <Link href="/dashboard" className="text-lg font-semibold">
          Myfacturation
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="w-10" />
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setMobileOpen(false)} />
          <aside className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-[var(--background)] border-r border-[var(--border)] md:hidden pt-14">
            <nav className="p-4 space-y-0.5">
              {nav.map(({ href, label, icon: Icon, premium }) => {
                if (premium && !canAccessFeature(planType as 'free' | 'premium', 'accounting')) {
                  return (
                    <span key={href} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--muted)]">
                      <Icon className="w-4 h-4" />
                      {label}
                    </span>
                  )
                }
                const isActive = pathname === href || (href !== '/dashboard' && pathname?.startsWith(href))
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                      isActive ? 'bg-[var(--border)]/30 font-medium' : 'text-[var(--muted)]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </Link>
                )
              })}
            </nav>
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[var(--border)] space-y-2">
              <ThemeToggle />
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/' })}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--muted)] w-full"
              >
                <LogOut className="w-4 h-4" />
                Déconnexion
              </button>
            </div>
          </aside>
        </>
      )}

      <main className="flex-1 min-w-0 pt-14 md:pt-0">
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  )
}
