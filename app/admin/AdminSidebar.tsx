'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Package,
  Key,
  BarChart3,
  Shield,
  Lock,
  MessageCircle,
  Mail,
  FileText,
  MailX,
  Menu,
  X,
  LayoutList,
} from 'lucide-react'

const adminNav = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Utilisateurs', icon: Users },
  { href: '/admin/dashboard-messages', label: 'Messages dashboard', icon: LayoutList },
  { href: '/admin/deleted-emails', label: 'Emails supprimés', icon: MailX },
  { href: '/admin/subscriptions', label: 'Abonnements', icon: CreditCard },
  { href: '/admin/invoices', label: 'Factures', icon: FileText },
  { href: '/admin/plans', label: 'Plans', icon: Package },
  { href: '/admin/features', label: 'Permissions', icon: Key },
  { href: '/admin/emails', label: 'Emails', icon: Mail },
  { href: '/admin/stats', label: 'Statistiques', icon: BarChart3 },
  { href: '/admin/password', label: 'Modifier mon mot de passe', icon: Lock },
]

function NavContent({
  pathname,
  supportUnread,
  onLinkClick,
}: {
  pathname: string | null
  supportUnread: number
  onLinkClick?: () => void
}) {
  return (
    <nav className="p-4 space-y-0.5">
      <Link
        href="/admin/messages"
        onClick={onLinkClick}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
          pathname?.startsWith('/admin/messages') ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 font-medium' : 'text-[var(--muted)] hover:bg-[var(--border)]/20 hover:text-[var(--foreground)]'
        }`}
      >
        <MessageCircle className="w-4 h-4 shrink-0" />
        Support ({supportUnread})
      </Link>
      {adminNav.map(({ href, label, icon: Icon }) => {
        const isActive = href === '/admin' ? pathname === '/admin' : pathname?.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            onClick={onLinkClick}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              isActive ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 font-medium' : 'text-[var(--muted)] hover:bg-[var(--border)]/20 hover:text-[var(--foreground)]'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

export function AdminSidebar() {
  const pathname = usePathname()
  const [supportUnread, setSupportUnread] = useState(0)
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => {
    fetch('/api/admin/conversations/unread-count', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((d) => setSupportUnread(typeof d?.count === 'number' ? d.count : 0))
      .catch(() => setSupportUnread(0))
  }, [pathname])

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--background)]">
        <div className="p-6 border-b border-[var(--border)] flex items-center gap-2">
          <Shield className="w-5 h-5 text-amber-500" />
          <span className="font-semibold">Admin</span>
        </div>
        <NavContent pathname={pathname} supportUnread={supportUnread} />
      </aside>

      {/* Mobile header avec bouton menu (3 traits) */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 flex items-center gap-3 px-4 bg-[var(--background)] border-b border-[var(--border)]">
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          className="p-2 rounded-lg hover:bg-[var(--border)]/20"
          aria-label="Menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-amber-500" />
          <span className="font-semibold">Admin</span>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-[var(--background)] border-r border-[var(--border)] md:hidden pt-14 shadow-xl">
            <div className="p-4 border-b border-[var(--border)] flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-500" />
              <span className="font-semibold">Menu</span>
            </div>
            <NavContent pathname={pathname} supportUnread={supportUnread} onLinkClick={() => setMobileOpen(false)} />
          </aside>
        </>
      )}
    </>
  )
}
