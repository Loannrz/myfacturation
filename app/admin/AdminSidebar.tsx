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
} from 'lucide-react'

const adminNav = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Utilisateurs', icon: Users },
  { href: '/admin/subscriptions', label: 'Abonnements', icon: CreditCard },
  { href: '/admin/plans', label: 'Plans', icon: Package },
  { href: '/admin/features', label: 'Permissions', icon: Key },
  { href: '/admin/emails', label: 'Emails', icon: Mail },
  { href: '/admin/stats', label: 'Statistiques', icon: BarChart3 },
  { href: '/admin/password', label: 'Modifier mon mot de passe', icon: Lock },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const [supportUnread, setSupportUnread] = useState(0)
  useEffect(() => {
    fetch('/api/admin/conversations/unread-count').then((r) => r.json()).then((d) => typeof d.count === 'number' && setSupportUnread(d.count)).catch(() => {})
  }, [])

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--background)]">
      <div className="p-6 border-b border-[var(--border)] flex items-center gap-2">
        <Shield className="w-5 h-5 text-amber-500" />
        <span className="font-semibold">Admin</span>
      </div>
      <nav className="p-4 space-y-0.5">
        <Link
          href="/admin/messages"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
            pathname?.startsWith('/admin/messages') ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 font-medium' : 'text-[var(--muted)] hover:bg-[var(--border)]/20 hover:text-[var(--foreground)]'
          }`}
        >
          <MessageCircle className="w-4 h-4 shrink-0" />
          Support{supportUnread > 0 ? ` (${supportUnread})` : ''}
        </Link>
        {adminNav.map(({ href, label, icon: Icon }) => {
          const isActive = href === '/admin' ? pathname === '/admin' : pathname?.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
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
    </aside>
  )
}
