'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { FileText, Receipt, FileMinus, AlertCircle, Info, Lock, AlertTriangle, UserCircle, Wallet, CheckCircle, X } from 'lucide-react'
import { getDashboardMessageIcon } from '@/lib/dashboard-message-icons'
import { canCreateDocument, CANNOT_CREATE_MESSAGE } from '@/lib/can-create-document'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

type SeriesPoint = {
  month: string
  label: string
  ca: number
  invoiceAmount: number
  invoiceCount: number
  collectedCount: number
  collectedAmount: number
  quoteCount: number
  signedQuoteCount: number
  creditNoteCount: number
  creditNoteAmount: number
}

type OverdueInvoiceItem = {
  number: string
  clientName: string
  amount: number
  currency: string
  dueDate: string | null
  overdueDays: number
}

type Stats = {
  year: number
  month: number | null
  from: string | null
  to: string | null
  totalRevenue: number
  totalInvoicesAmount: number
  totalInvoices: number
  paidInvoices: number
  totalQuotes: number
  signedQuotes: number
  totalCreditNotes: number
  totalCreditNotesAmount: number
  paymentDelayAmount: number
  paymentDelayCount: number
  series: SeriesPoint[]
  overdueInvoices?: OverdueInvoiceItem[]
  databaseError?: boolean
  totalExpenses?: number
  expensesByCategory?: Record<string, number>
  expensesByEmployee?: Record<string, number>
  totalEmployeeCost?: number
  monthlySalaryTotal?: number
}

const MONTHS = [
  '', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc',
]

function formatEuro(v: number) {
  return `${v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

/** Formate "2026-01" en "Jan 2026" */
function formatMonthYear(monthKey: string) {
  const [y, m] = (monthKey || '').split('-').map(Number)
  if (!m) return monthKey
  return `${MONTHS[m]} ${y}`
}

function ChartTooltip({
  active,
  payload,
  valueLabel,
  formatValue = (v: number) => String(v),
}: {
  active?: boolean
  payload?: Array<{ payload: SeriesPoint; value?: number }>
  valueLabel: string
  formatValue?: (v: number) => string
}) {
  if (!active || !payload?.length || payload[0].value == null) return null
  const p = payload[0].payload
  const value = payload[0].value
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-lg px-3 py-2 text-sm">
      <p className="font-medium text-[var(--foreground)]">{formatMonthYear(p.month)}</p>
      <p className="text-[var(--muted)] mt-0.5">
        {valueLabel} : <span className="font-medium text-[var(--foreground)]">{formatValue(value)}</span>
      </p>
    </div>
  )
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const subscriptionPlan = (session?.user as { subscriptionPlan?: string })?.subscriptionPlan ?? 'starter'
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState<number | ''>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [bankAccounts, setBankAccounts] = useState<{ id: string; name: string; iban?: string }[]>([])
  const [filterBankAccountId, setFilterBankAccountId] = useState('')
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [canCreate, setCanCreate] = useState<boolean | null>(null)
  const [usage, setUsage] = useState<{ invoicesThisMonth: number; quotesThisMonth: number; invoicesLimit: number | null; quotesLimit: number | null } | null>(null)
  const [limitPopupOpen, setLimitPopupOpen] = useState(false)
  const [limitPopupType, setLimitPopupType] = useState<'invoices' | 'quotes'>('invoices')
  const [employeesCount, setEmployeesCount] = useState<number | null>(null)
  const [dashboardMessages, setDashboardMessages] = useState<{ id: string; icon: string; title: string; body: string }[]>([])
  const [recentlySignedQuotes, setRecentlySignedQuotes] = useState<{ id: string; number: string; signedAt: string | null }[]>([])
  const [dismissedSignedIds, setDismissedSignedIds] = useState<Set<string>>(new Set())

  const query = useMemo(() => {
    const p = new URLSearchParams()
    p.set('year', String(year))
    if (month !== '') p.set('month', String(month))
    if (from) p.set('from', from)
    if (to) p.set('to', to)
    if (filterBankAccountId) p.set('bankAccountId', filterBankAccountId)
    return p.toString()
  }, [year, month, from, to, filterBankAccountId])

  useEffect(() => {
    Promise.all([fetch('/api/me').then((r) => (r.ok ? r.json() : null)), fetch('/api/settings').then((r) => (r.ok ? r.json() : null))])
      .then(([me, settings]) => {
        if (me && settings) {
          setCanCreate(canCreateDocument({ name: me.name, ...settings }))
          setBankAccounts(Array.isArray((settings as { bankAccounts?: { id: string; name: string; iban?: string }[] }).bankAccounts) ? (settings as { bankAccounts: { id: string; name: string; iban?: string }[] }).bankAccounts : [])
        } else {
          setCanCreate(false)
        }
      })
      .catch(() => setCanCreate(false))
  }, [])

  const fetchStats = useCallback(() => {
    setLoading(true)
    fetch(`/api/stats?${query}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setStats({
            year: data.year,
            month: data.month,
            from: data.from,
            to: data.to,
            totalRevenue: data.totalRevenue ?? 0,
            totalInvoicesAmount: data.totalInvoicesAmount ?? 0,
            totalInvoices: data.totalInvoices ?? 0,
            paidInvoices: data.paidInvoices ?? 0,
            totalQuotes: data.totalQuotes ?? 0,
            signedQuotes: data.signedQuotes ?? 0,
            totalCreditNotes: data.totalCreditNotes ?? 0,
            totalCreditNotesAmount: data.totalCreditNotesAmount ?? 0,
            paymentDelayAmount: data.paymentDelayAmount ?? 0,
            paymentDelayCount: data.paymentDelayCount ?? 0,
            series: data.series ?? [],
            overdueInvoices: data.overdueInvoices ?? [],
            databaseError: data.databaseError ?? false,
            totalExpenses: data.totalExpenses ?? 0,
            expensesByCategory: data.expensesByCategory ?? {},
            expensesByEmployee: data.expensesByEmployee ?? {},
            totalEmployeeCost: data.totalEmployeeCost ?? 0,
            monthlySalaryTotal: data.monthlySalaryTotal ?? 0,
          })
        } else {
          setStats(null)
        }
      })
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
  }, [query])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    if (subscriptionPlan === 'business') {
      fetch('/api/employees')
        .then((r) => (r.ok ? r.json() : []))
        .then((list: unknown[]) => setEmployeesCount(Array.isArray(list) ? list.length : 0))
        .catch(() => setEmployeesCount(0))
    } else {
      setEmployeesCount(null)
    }
  }, [subscriptionPlan])

  useEffect(() => {
    if (subscriptionPlan !== 'starter') return
    fetch('/api/usage')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setUsage(data))
  }, [subscriptionPlan])

  useEffect(() => {
    if (!usage || !usage.invoicesLimit) return
    if (usage.invoicesThisMonth >= usage.invoicesLimit) {
      setLimitPopupType('invoices')
      setLimitPopupOpen(true)
    } else if (usage.quotesThisMonth >= (usage.quotesLimit ?? 0)) {
      setLimitPopupType('quotes')
      setLimitPopupOpen(true)
    }
  }, [usage])

  // Rafraîchir les stats quand on revient sur l’onglet (ex. après avoir changé une facture en « En retard »)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchStats()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [fetchStats])

  useEffect(() => {
    fetch('/api/dashboard-messages')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setDashboardMessages(Array.isArray(data) ? data : []))
      .catch(() => setDashboardMessages([]))
  }, [])

  const DISMISSED_SIGNED_KEY = 'dashboard_dismissed_signed_quote_ids'

  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(DISMISSED_SIGNED_KEY) : null
      const arr = raw ? (JSON.parse(raw) as unknown) : []
      setDismissedSignedIds(new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []))
    } catch {
      setDismissedSignedIds(new Set())
    }
  }, [])

  useEffect(() => {
    fetch('/api/quotes/recently-signed')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setRecentlySignedQuotes(Array.isArray(data) ? data : []))
      .catch(() => setRecentlySignedQuotes([]))
  }, [])

  const dismissSignedNotification = useCallback((quoteId: string) => {
    setDismissedSignedIds((prev) => {
      const next = new Set(prev)
      next.add(quoteId)
      try {
        if (typeof window !== 'undefined') localStorage.setItem(DISMISSED_SIGNED_KEY, JSON.stringify([...next]))
      } catch {}
      return next
    })
  }, [])

  const periodLabel = useMemo(() => {
    if (from && to) return `${from} → ${to}`
    if (month !== '') return `${MONTHS[month]} ${year}`
    return `${year}`
  }, [year, month, from, to])

  const chartData = stats?.series ?? []
  const chartHeight = 120

  return (
    <div className="max-w-6xl mx-auto">
      {canCreate === false && (
        <div className="mb-6 p-4 rounded-xl border border-amber-500/50 bg-amber-500/10 flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Informations requises</p>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">{CANNOT_CREATE_MESSAGE}</p>
            <Link href="/parametres#etablissements" className="inline-block mt-2 text-sm font-medium text-amber-700 dark:text-amber-200 underline hover:no-underline">
              Remplir dans Paramètres →
            </Link>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-[var(--muted)] text-sm mt-1">Vue d&apos;ensemble de votre activité</p>
        </div>
      </div>

      {/* Messages dashboard (configurés par l’admin) */}
      {dashboardMessages.length > 0 && (
        <div className="mb-6 space-y-4">
          {dashboardMessages.map((msg) => {
            const IconComponent = getDashboardMessageIcon(msg.icon)
            return (
              <div
                key={msg.id}
                className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 flex flex-wrap items-center gap-4"
              >
                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <IconComponent className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-emerald-800 dark:text-emerald-200">{msg.title}</p>
                    <p className="text-sm text-emerald-700 dark:text-emerald-300">{msg.body}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Filtres */}
      <div className="mb-6 p-4 rounded-xl border border-[var(--border)] bg-[var(--background)]">
        <p className="text-sm font-medium text-[var(--foreground)] mb-3">Période</p>
        <div className="flex flex-wrap items-end gap-4">
          {bankAccounts.length > 0 && (
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1">Compte bancaire</label>
              <select
                value={filterBankAccountId}
                onChange={(e) => setFilterBankAccountId(e.target.value)}
                className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm min-w-[180px]"
              >
                <option value="">Tous les comptes</option>
                {bankAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.name || acc.iban || 'Compte'}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1">Année</label>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm"
            >
              {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1">Mois (optionnel)</label>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm"
            >
              <option value="">Toute l&apos;année</option>
              {MONTHS.slice(1).map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1">Du</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1">Au</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm"
            />
          </div>
        </div>
        <p className="text-sm font-medium text-[var(--foreground)] mt-3 pt-3 border-t border-[var(--border)]">
          Période affichée : <span className="text-[var(--muted)] font-normal">{periodLabel}</span>
        </p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-[var(--muted)]">Chargement…</div>
      ) : !stats ? (
        <div className="py-12 text-center text-[var(--muted)]">Impossible de charger les statistiques.</div>
      ) : (
        <>
          {stats.databaseError && (
            <div className="mb-6 p-4 rounded-xl border border-amber-500/50 bg-amber-500/10 flex flex-wrap items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-200 flex-1 min-w-0">
                La base de données est temporairement indisponible. Les statistiques affichées sont vides. Vérifiez votre connexion ou réessayez plus tard.
              </p>
              <button
                type="button"
                onClick={() => fetchStats()}
                className="shrink-0 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-amber-50 text-sm font-medium transition-colors"
              >
                Réessayer
              </button>
            </div>
          )}

          {subscriptionPlan === 'starter' && usage && (usage.invoicesLimit != null || usage.quotesLimit != null) && (
            <div className="mb-6 p-4 rounded-xl border border-[var(--border)] bg-[var(--background)]">
              <p className="text-sm font-medium text-[var(--foreground)] mb-2">Formule gratuite — utilisation du mois</p>
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="text-[var(--muted)]">
                  Factures : <strong className="text-[var(--foreground)]">{usage.invoicesThisMonth} / {usage.invoicesLimit ?? '∞'}</strong>
                </span>
                <span className="text-[var(--muted)]">
                  Devis : <strong className="text-[var(--foreground)]">{usage.quotesThisMonth} / {usage.quotesLimit ?? '∞'}</strong>
                </span>
              </div>
              <Link href="/formules" className="inline-block mt-2 text-sm font-medium text-violet-600 dark:text-violet-400 hover:underline">
                Passer à Pro pour illimité →
              </Link>
            </div>
          )}

          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">{periodLabel}</h2>

          {/* Notification(s) devis signé(s) — visibles 1 semaine ou jusqu’au clic sur la croix */}
          {recentlySignedQuotes
            .filter((q) => !dismissedSignedIds.has(q.id))
            .map((q) => {
              const signedDate = q.signedAt ? new Date(q.signedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
              return (
                <div
                  key={q.id}
                  className="mb-4 p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 flex flex-wrap items-center gap-4"
                >
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-emerald-800 dark:text-emerald-200">
                        Votre devis {q.number} a été signé{signedDate ? ` le ${signedDate}` : ''}.
                      </p>
                      <p className="text-sm text-emerald-700 dark:text-emerald-300">
                        Le document signé a été envoyé par email. Ce message reste affiché 1 semaine ou jusqu’à fermeture.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => dismissSignedNotification(q.id)}
                    className="ml-auto p-2 rounded-lg hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                    aria-label="Fermer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )
            })}

          {/* Retard de paiement + Factures en retard OU CA */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--background)]">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--muted)]">Retard de paiement</span>
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <p className="mt-2 text-xl font-semibold text-red-600 dark:text-red-400">
                {formatEuro(stats.paymentDelayAmount)}
              </p>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                {stats.paymentDelayCount} facture{stats.paymentDelayCount !== 1 ? 's' : ''} en retard
              </p>
            </div>

            {/* Factures en retard : pleine largeur (2 cols) quand il y en a */}
            {stats.overdueInvoices && stats.overdueInvoices.length > 0 ? (
              <div className="lg:col-span-2 p-5 rounded-xl border border-red-500/30 bg-red-500/5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-[var(--foreground)] flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    Factures en retard
                  </span>
                  <Link href="/factures?filter=overdue" className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline">
                    Voir tout
                  </Link>
                </div>
                <ul className="space-y-2">
                  {stats.overdueInvoices.map((inv) => (
                    <li key={inv.number} className="text-sm flex flex-wrap items-baseline gap-2">
                      <span className="text-red-600 dark:text-red-400 font-medium">Facture {inv.number}</span>
                      <span className="text-[var(--muted)]">est impayée depuis {inv.overdueDays} jour{inv.overdueDays !== 1 ? 's' : ''}</span>
                      <span className="text-[var(--muted)]">— {inv.clientName}</span>
                      <span className="font-medium">{inv.amount.toFixed(2)} {inv.currency}</span>
                      <span className="text-[var(--muted)]">échéance {inv.dueDate ?? '—'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              /* Pas de factures en retard : CA à droite de "Retard de paiement" */
              <div className="lg:col-span-2 p-5 rounded-xl border border-[var(--border)] bg-[var(--background)]">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-[var(--muted)]">
                    Chiffre d&apos;affaires (total factures - total avoirs)
                  </span>
                  <Info className="w-4 h-4 text-[var(--muted)]" />
                </div>
                <p className="mt-2 text-2xl font-semibold text-purple-600 dark:text-purple-400">
                  {formatEuro(stats.totalRevenue)}
                </p>
                <div className="mt-4 h-[120px] -mx-2">
                  <ResponsiveContainer width="100%" height={chartHeight}>
                    <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                      <defs>
                        <linearGradient id="caGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="rgb(147 51 234)" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="rgb(147 51 234)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} stroke="var(--muted)" />
                      <YAxis hide domain={['auto', 'auto']} />
                      <Tooltip content={<ChartTooltip valueLabel="CA" formatValue={formatEuro} />} />
                      <Area
                        type="monotone"
                        dataKey="ca"
                        stroke="rgb(147 51 234)"
                        strokeWidth={2}
                        fill="url(#caGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* CA en pleine largeur uniquement quand la liste "Factures en retard" est affichée */}
          {stats.overdueInvoices && stats.overdueInvoices.length > 0 && (
            <div className="mb-6 p-5 rounded-xl border border-[var(--border)] bg-[var(--background)]">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-[var(--muted)]">
                  Chiffre d&apos;affaires (total factures - total avoirs)
                </span>
                <Info className="w-4 h-4 text-[var(--muted)]" />
              </div>
              <p className="mt-2 text-2xl font-semibold text-purple-600 dark:text-purple-400">
                {formatEuro(stats.totalRevenue)}
              </p>
              <div className="mt-4 h-[120px] -mx-2">
                <ResponsiveContainer width="100%" height={chartHeight}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="caGradFull" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(147 51 234)" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="rgb(147 51 234)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} stroke="var(--muted)" />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Tooltip content={<ChartTooltip valueLabel="CA" formatValue={formatEuro} />} />
                    <Area
                      type="monotone"
                      dataKey="ca"
                      stroke="rgb(147 51 234)"
                      strokeWidth={2}
                      fill="url(#caGradFull)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 relative">
            {subscriptionPlan === 'starter' && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-[var(--background)]/80 backdrop-blur-sm">
                <div className="text-center p-6">
                  <Lock className="w-10 h-10 mx-auto text-[var(--muted)] mb-2" />
                  <p className="text-sm font-medium text-[var(--foreground)] mb-1">Disponible avec Business</p>
                  <p className="text-xs text-[var(--muted)] mb-4">Graphiques détaillés et analyses avancées</p>
                  <Link href="/formules" className="inline-flex px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-amber-950 font-medium text-sm">
                    Passer à Business
                  </Link>
                </div>
              </div>
            )}
            {/* Total factures + courbe */}
            <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--background)]">
              <span className="text-sm text-[var(--muted)]">Total factures</span>
              <p className="mt-2 text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
                {formatEuro(stats.totalInvoicesAmount)}
              </p>
              <p className="text-xs text-[var(--muted)]">au total pour {stats.totalInvoices} facture{stats.totalInvoices !== 1 ? 's' : ''}</p>
              <div className="mt-4 h-[140px] -mx-1">
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                    <defs>
                      <linearGradient id="invGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(16 185 129)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} stroke="var(--muted)" />
                    <YAxis hide />
                    <Tooltip content={<ChartTooltip valueLabel="Factures" />} />
                    <Area type="monotone" dataKey="invoiceCount" stroke="rgb(16 185 129)" strokeWidth={1.5} fill="url(#invGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Factures encaissées + courbe */}
            <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--background)]">
              <span className="text-sm text-[var(--muted)]">Factures encaissées</span>
              <p className="mt-2 text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
                {stats.paidInvoices}
              </p>
              <p className="text-xs text-[var(--muted)]">facture{stats.paidInvoices !== 1 ? 's' : ''} encaissée{stats.paidInvoices !== 1 ? 's' : ''} ({formatEuro(stats.totalRevenue)})</p>
              <div className="mt-4 h-[140px] -mx-1">
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                    <defs>
                      <linearGradient id="colGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(16 185 129)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} stroke="var(--muted)" />
                    <YAxis hide />
                    <Tooltip content={<ChartTooltip valueLabel="Encaissées" />} />
                    <Area type="monotone" dataKey="collectedCount" stroke="rgb(16 185 129)" strokeWidth={1.5} fill="url(#colGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Total devis + courbe */}
            <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--background)]">
              <span className="text-sm text-[var(--muted)]">Total devis</span>
              <p className="mt-2 text-2xl font-semibold text-amber-600 dark:text-amber-400">
                {stats.totalQuotes}
              </p>
              <p className="text-xs text-[var(--muted)]">{stats.totalQuotes === 0 ? 'aucun devis' : `devis sur la période`}</p>
              <div className="mt-4 h-[140px] -mx-1">
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                    <defs>
                      <linearGradient id="quoteGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(245 158 11)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="rgb(245 158 11)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} stroke="var(--muted)" />
                    <YAxis hide />
                    <Tooltip content={<ChartTooltip valueLabel="Devis" />} />
                    <Area type="monotone" dataKey="quoteCount" stroke="rgb(245 158 11)" strokeWidth={1.5} fill="url(#quoteGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Devis signés + courbe */}
            <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--background)]">
              <span className="text-sm text-[var(--muted)]">Devis signés</span>
              <p className="mt-2 text-2xl font-semibold text-amber-600 dark:text-amber-400">
                {stats.signedQuotes}
              </p>
              <p className="text-xs text-[var(--muted)]">devis signé{stats.signedQuotes !== 1 ? 's' : ''}</p>
              <div className="mt-4 h-[140px] -mx-1">
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                    <defs>
                      <linearGradient id="signedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(245 158 11)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="rgb(245 158 11)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} stroke="var(--muted)" />
                    <YAxis hide />
                    <Tooltip content={<ChartTooltip valueLabel="Signés" />} />
                    <Area type="monotone" dataKey="signedQuoteCount" stroke="rgb(245 158 11)" strokeWidth={1.5} fill="url(#signedGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Avoirs : nombre + courbe */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--background)]">
              <span className="text-sm text-[var(--muted)]">Nombre d&apos;avoirs</span>
              <p className="mt-2 text-2xl font-semibold text-rose-600 dark:text-rose-400">
                {stats.totalCreditNotes}
              </p>
              <p className="text-xs text-[var(--muted)]">{stats.totalCreditNotes === 0 ? 'aucun avoir' : `avoir${stats.totalCreditNotes !== 1 ? 's' : ''} sur la période`}</p>
              <div className="mt-4 h-[140px] -mx-1">
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                    <defs>
                      <linearGradient id="cnCountGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(244 63 94)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="rgb(244 63 94)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} stroke="var(--muted)" />
                    <YAxis hide />
                    <Tooltip content={<ChartTooltip valueLabel="Avoirs" />} />
                    <Area type="monotone" dataKey="creditNoteCount" stroke="rgb(244 63 94)" strokeWidth={1.5} fill="url(#cnCountGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Montant avoirs + courbe */}
            <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--background)]">
              <span className="text-sm text-[var(--muted)]">Montant des avoirs</span>
              <p className="mt-2 text-2xl font-semibold text-rose-600 dark:text-rose-400">
                {formatEuro(stats.totalCreditNotesAmount)}
              </p>
              <p className="text-xs text-[var(--muted)]">total sur la période</p>
              <div className="mt-4 h-[140px] -mx-1">
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                    <defs>
                      <linearGradient id="cnAmountGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(244 63 94)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="rgb(244 63 94)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} stroke="var(--muted)" />
                    <YAxis hide />
                    <Tooltip content={<ChartTooltip valueLabel="Montant" formatValue={formatEuro} />} />
                    <Area type="monotone" dataKey="creditNoteAmount" stroke="rgb(244 63 94)" strokeWidth={1.5} fill="url(#cnAmountGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Dépenses & Salariés (Pro / Business) */}
          {(subscriptionPlan === 'pro' || subscriptionPlan === 'business') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--background)]">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--muted)]">Total dépenses</span>
                  <Wallet className="w-5 h-5 text-[var(--muted)]" />
                </div>
                <p className="mt-2 text-xl font-semibold text-rose-600 dark:text-rose-400">
                  {formatEuro(stats.totalExpenses ?? 0)}
                </p>
                <p className="text-xs text-[var(--muted)]">sur la période</p>
              </div>
              {subscriptionPlan === 'business' && (
                <>
                  <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--background)]">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[var(--muted)]">Nombre de salariés</span>
                      <UserCircle className="w-5 h-5 text-[var(--muted)]" />
                    </div>
                    <p className="mt-2 text-xl font-semibold text-[var(--foreground)]">
                      {employeesCount ?? '—'}
                    </p>
                    <Link href="/salaries" className="text-xs text-[var(--muted)] hover:underline">Voir les salariés</Link>
                  </div>
                  <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--background)]">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[var(--muted)]">Coût salarial (période)</span>
                    </div>
                    <p className="mt-2 text-xl font-semibold text-amber-600 dark:text-amber-400">
                      {formatEuro(stats.totalEmployeeCost ?? 0)}
                    </p>
                    <p className="text-xs text-[var(--muted)]">Salaires sur la période</p>
                  </div>
                </>
              )}
              <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--background)]">
                <span className="text-sm text-[var(--muted)]">Top catégories de dépenses</span>
                <div className="mt-2 space-y-1 max-h-20 overflow-y-auto">
                  {Object.entries(stats.expensesByCategory ?? {})
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .map(([cat, amount]) => (
                      <p key={cat} className="text-sm flex justify-between gap-2">
                        <span className="truncate text-[var(--muted)]">{cat}</span>
                        <span className="font-medium shrink-0">{formatEuro(amount)}</span>
                      </p>
                    ))}
                  {Object.keys(stats.expensesByCategory ?? {}).length === 0 && (
                    <p className="text-sm text-[var(--muted)]">Aucune dépense</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {limitPopupOpen && subscriptionPlan === 'starter' && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setLimitPopupOpen(false)}>
              <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">Limite gratuite atteinte</h3>
                <p className="text-sm text-[var(--muted)] mb-6">
                  {limitPopupType === 'invoices'
                    ? 'Vous avez atteint la limite de 5 factures ce mois-ci. Passez à Pro pour créer des factures illimitées.'
                    : 'Vous avez atteint la limite de 5 devis ce mois-ci. Passez à Pro pour créer des devis illimités.'}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link href="/formules" className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium">
                    Passer à Pro
                  </Link>
                  <button type="button" onClick={() => setLimitPopupOpen(false)} className="px-4 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--border)]/20">
                    Plus tard
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-4">
            <Link
              href="/factures"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] font-medium hover:bg-[var(--border)]/20 transition-colors"
            >
              <Receipt className="w-4 h-4" />
              Voir les factures
            </Link>
            <Link
              href="/devis"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] font-medium hover:bg-[var(--border)]/20 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Voir les devis
            </Link>
            <Link
              href="/avoirs"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] font-medium hover:bg-[var(--border)]/20 transition-colors"
            >
              <FileMinus className="w-4 h-4" />
              Voir les avoirs
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
