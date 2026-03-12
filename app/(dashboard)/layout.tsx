'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FileText,
  Receipt,
  Users,
  UserCircle,
  Wallet,
  Settings,
  Menu,
  X,
  LogOut,
  Activity,
  Package,
  FilePlus2,
  RotateCcw,
  Banknote,
  Sparkles,
  Shield,
  MessageCircle,
} from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { canAccessFeatureByPlan, effectiveSubscriptionPlan } from '@/lib/subscription'
import { ThemeToggle } from '@/app/theme-toggle'

type NavItem = {
  href: string
  label: string
  icon: typeof LayoutDashboard
  feature?: keyof typeof import('@/lib/subscription').PLAN_FEATURES
  businessOnly?: boolean
}

const nav: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/activite', label: 'Activité', icon: Activity, businessOnly: true },
  { href: '/creer', label: 'Créer', icon: FilePlus2 },
  { href: '/factures', label: 'Factures', icon: Receipt },
  { href: '/avoirs', label: 'Avoirs', icon: RotateCcw, feature: 'creditNotes' },
  { href: '/devis', label: 'Devis', icon: FileText },
  { href: '/depenses', label: 'Dépenses', icon: Banknote, feature: 'expenses' },
  { href: '/salaries', label: 'Salariés', icon: UserCircle, feature: 'employees' },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/produits', label: 'Produits', icon: Package, feature: 'products' },
  { href: '/comptabilite', label: 'Comptabilité', icon: Wallet, feature: 'accounting' },
  { href: '/formules', label: 'Formules', icon: Sparkles },
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
  const [messagesUnread, setMessagesUnread] = useState(0)
  const hasBeenAuthenticated = useRef(false)
  if (status === 'authenticated' && session) hasBeenAuthenticated.current = true

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/conversations/unread-count').then((r) => r.json()).then((d) => typeof d.count === 'number' && setMessagesUnread(d.count)).catch(() => {})
  }, [status])

  useEffect(() => {
    if (status === 'unauthenticated') {
      window.location.href = '/login?callbackUrl=' + encodeURIComponent(pathname || '/dashboard')
    }
  }, [status, pathname])

  // Ne pas démonter le contenu lors d'un refetch session (évite la boucle sur Paramètres).
  // Afficher "Chargement" uniquement au tout premier chargement, pas quand on a déjà été authentifié.
  const showContent = hasBeenAuthenticated.current || (status === 'authenticated' && session)
  if (!showContent) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-[var(--muted)]">Chargement…</div>
      </div>
    )
  }

  const currentSession = session ?? undefined
  const planType = (currentSession?.user as { planType?: string })?.planType ?? 'free'
  const subscriptionPlan = (currentSession?.user as { subscriptionPlan?: string })?.subscriptionPlan ?? 'starter'
  const role = (currentSession?.user as { role?: string })?.role ?? 'user'
  const effectivePlan = effectiveSubscriptionPlan(subscriptionPlan as 'starter' | 'pro' | 'business', role)

  const isLocked = (item: NavItem) => {
    if (item.businessOnly) return !canAccessFeatureByPlan(effectivePlan, 'activityHistory')
    if (item.feature) return !canAccessFeatureByPlan(effectivePlan, item.feature)
    return false
  }
  const lockTooltip = (item: NavItem) =>
    item.feature === 'employees' || item.businessOnly ? 'Disponible dans la formule Business.' : 'Disponible dans la formule Pro ou Business.'

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
          {role === 'admin' && (
            <Link
              href="/admin"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                pathname?.startsWith('/admin') ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400' : 'text-amber-600 dark:text-amber-400 hover:bg-[var(--border)]/20'
              }`}
            >
              <Shield className="w-4 h-4 shrink-0" />
              Admin
            </Link>
          )}
          {nav.map((item) => {
            const { href, label, icon: Icon } = item
            const key = href
            const locked = isLocked(item)
            if (locked) {
              return (
                <span
                  key={key}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--muted)] cursor-not-allowed opacity-75"
                  title={lockTooltip(item)}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </span>
              )
            }
            const isActive = pathname === href || (href !== '/dashboard' && pathname?.startsWith(href))
            return (
              <span key={key} className="contents">
                {href === '/formules' && (
                  <Link
                    href="/messages"
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      pathname?.startsWith('/messages') ? 'bg-[var(--border)]/30 font-medium' : 'text-[var(--muted)] hover:bg-[var(--border)]/20 hover:text-[var(--foreground)]'
                    }`}
                  >
                    <MessageCircle className="w-4 h-4 shrink-0" />
                    Envoyer un message{messagesUnread > 0 ? ` (${messagesUnread})` : ''}
                  </Link>
                )}
                <Link
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive ? 'bg-[var(--border)]/30 font-medium' : 'text-[var(--muted)] hover:bg-[var(--border)]/20 hover:text-[var(--foreground)]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </Link>
              </span>
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
              {role === 'admin' && (
                <Link href="/admin" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-amber-600 dark:text-amber-400">
                  <Shield className="w-4 h-4" />
                  Admin
                </Link>
              )}
              {nav.map((item) => {
                const { href, label, icon: Icon } = item
                const key = href
                const locked = isLocked(item)
                if (locked) {
                  return (
                    <span key={key} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--muted)] opacity-75" title={lockTooltip(item)}>
                      <Icon className="w-4 h-4" />
                      {label}
                    </span>
                  )
                }
                const isActive = pathname === href || (href !== '/dashboard' && pathname?.startsWith(href))
                return (
                  <span key={key} className="contents">
                    {href === '/formules' && (
                      <Link href="/messages" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--foreground)]">
                        <MessageCircle className="w-4 h-4" />
                        Envoyer un message{messagesUnread > 0 ? ` (${messagesUnread})` : ''}
                      </Link>
                    )}
                    <Link
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                        isActive ? 'bg-[var(--border)]/30 font-medium' : 'text-[var(--muted)]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </Link>
                  </span>
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
