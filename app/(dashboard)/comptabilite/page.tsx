'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import {
  Wallet,
  Download,
  Lock,
  TrendingUp,
  TrendingDown,
  Receipt,
  CreditCard,
  AlertCircle,
  Pencil,
  Trash2,
  FileText,
  ExternalLink,
} from 'lucide-react'
import { UpgradeGate } from '../components/UpgradeGate'
import { CreateExpenseModal } from '../components/CreateExpenseModal'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts'
type Expense = {
  id: string
  date: string
  amount: number
  category: string
  description: string | null
  supplier: string | null
  invoiceFile: string | null
  companyId: string | null
  company: { id: string; name: string } | null
  clientId: string | null
  client: { id: string; firstName: string; lastName: string; companyName: string | null } | null
  employeeId: string | null
  employee: { id: string; firstName: string; lastName: string } | null
  bankAccountId: string | null
}

type BankAccountEntry = { id: string; name: string; accountHolder: string; bankName: string; iban: string; bic: string }

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

type OverviewSummary = {
  totalRevenue: number
  totalPaidInvoices: number
  totalPaidInvoicesCount: number
  totalUnpaidInvoices: number
  totalExpenses: number
  totalCreditNotesAmount: number
  netProfit: number
  revenueEvolution: number | null
  expensesEvolution: number | null
  netProfitEvolution: number | null
}

type Transaction = {
  id: string
  date: string
  type: 'invoice' | 'expense' | 'credit_note'
  reference: string
  clientOrSupplier: string | null
  amount: number
  status: string
}

function formatEuro(v: number) {
  return `${v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

function formatDateFR(d: string) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

const statusLabels: Record<string, string> = {
  draft: 'Brouillon',
  sent: 'Envoyée',
  paid: 'Payée',
  pending: 'En attente',
  late: 'En retard',
  cancelled: 'Annulée',
  refunded: 'Remboursé',
  completed: 'Effectué',
}

type ChartPoint = { month: string; label: string; paidInvoices: number; expenses: number; creditNotes: number; expensesTotal: number; _padding?: boolean }

/** Tooltip graphique Revenus + Dépenses : factures payées (vert), dépenses + avoirs (rouge), revenu net */
function RevenueExpensesChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ payload?: ChartPoint }>
  label?: string
}) {
  if (!active || !payload?.length || !label) return null
  const point = payload[0]?.payload
  if (!point) return null
  const net = point.paidInvoices - point.expensesTotal
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-lg px-4 py-3 text-sm min-w-[220px]">
      <p className="font-medium text-[var(--foreground)] border-b border-[var(--border)]/50 pb-1.5 mb-2">{label}</p>
      <div className="space-y-1">
        <p className="text-[var(--muted)]">
          Revenus (factures payées) : <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatEuro(point.paidInvoices)}</span>
        </p>
        <p className="text-[var(--muted)]">
          Dépenses + avoirs : <span className="font-semibold text-rose-600 dark:text-rose-400">{formatEuro(point.expensesTotal)}</span>
          {(point.creditNotes > 0 || point.expenses > 0) && (
            <span className="block text-xs mt-0.5 text-[var(--muted)]">
              dont {formatEuro(point.creditNotes)} avoir, {formatEuro(point.expenses)} dépenses
            </span>
          )}
        </p>
        <p className="text-[var(--muted)] pt-1 border-t border-[var(--border)]/50 mt-1.5">
          Revenu net : <span className={`font-semibold ${net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{formatEuro(net)}</span>
          <span className="block text-xs mt-0.5 text-[var(--muted)]">factures payées − dépenses − avoirs</span>
        </p>
      </div>
    </div>
  )
}

/** Tooltip pour le graphique en barres Revenus vs Dépenses */
type RevenueVsExpensesPoint = { month: string; label: string; revenue: number; expenses: number }
function RevenueVsExpensesTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; name: string; dataKey: string; payload?: RevenueVsExpensesPoint }>
  label?: string
}) {
  if (!active || !payload?.length || !label) return null
  const point = payload[0]?.payload
  if (!point) return null
  const net = point.revenue - point.expenses
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-lg px-4 py-3 text-sm min-w-[200px]">
      <p className="font-medium text-[var(--foreground)] border-b border-[var(--border)]/50 pb-1.5 mb-2">{label}</p>
      <div className="space-y-1">
        <p className="text-[var(--muted)]">
          Revenus : <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatEuro(point.revenue)}</span>
        </p>
        <p className="text-[var(--muted)]">
          Dépenses : <span className="font-semibold text-rose-600 dark:text-rose-400">{formatEuro(point.expenses)}</span>
        </p>
        <p className="text-[var(--muted)] pt-1 border-t border-[var(--border)]/50 mt-1.5">
          Solde : <span className={`font-semibold ${net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{formatEuro(net)}</span>
        </p>
      </div>
    </div>
  )
}

/** Tooltip Analyses avancées — montant (factures payées, avoirs) */
function AnalyticsAmountTooltip({
  active,
  payload,
  label,
  valueLabel = 'Montant',
}: {
  active?: boolean
  payload?: Array<{ payload?: { label: string; amount: number }; value?: number }>
  label?: string
  valueLabel?: string
}) {
  if (!active || !payload?.length || !label) return null
  const point = payload[0]?.payload
  const value = point?.amount ?? payload[0]?.value
  const num = typeof value === 'number' ? value : 0
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-lg px-4 py-3 text-sm min-w-[200px]">
      <p className="font-medium text-[var(--foreground)] border-b border-[var(--border)]/50 pb-1.5 mb-2">{label}</p>
      <p className="text-[var(--muted)]">
        {valueLabel} : <span className="font-semibold text-[var(--foreground)]">{formatEuro(num)}</span>
      </p>
    </div>
  )
}

/** Tooltip Analyses avancées — nombre (devis) */
function AnalyticsCountTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ payload?: { count: number }; value?: number }>
  label?: string
}) {
  if (!active || !payload?.length || !label) return null
  const point = payload[0]?.payload
  const value = point?.count ?? payload[0]?.value
  const num = typeof value === 'number' ? value : 0
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-lg px-4 py-3 text-sm min-w-[200px]">
      <p className="font-medium text-[var(--foreground)] border-b border-[var(--border)]/50 pb-1.5 mb-2">{label}</p>
      <p className="text-[var(--muted)]">
        Nombre : <span className="font-semibold text-[var(--foreground)]">{num}</span>
      </p>
    </div>
  )
}

/** Tooltip graphique Dépenses par catégorie — détail par catégorie pour le mois */
function ExpensesByCategoryTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string; payload?: Record<string, unknown> }>
  label?: string
}) {
  if (!active || !payload?.length || !label) return null
  const raw = payload[0]?.payload as Record<string, unknown> | undefined
  if (!raw || typeof raw !== 'object') return null
  const point = raw as Record<string, string | number>
  const categories = Object.keys(point).filter((k) => k !== 'month' && k !== 'label')
  const total = categories.reduce((s, k) => s + (Number(point[k]) || 0), 0)
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-lg px-4 py-3 text-sm min-w-[220px]">
      <p className="font-medium text-[var(--foreground)] border-b border-[var(--border)]/50 pb-1.5 mb-2">{label}</p>
      <div className="space-y-1 max-h-[240px] overflow-y-auto">
        {categories
          .filter((k) => Number(point[k]) > 0)
          .sort((a, b) => (Number(point[b]) || 0) - (Number(point[a]) || 0))
          .map((k) => (
            <p key={k} className="text-[var(--muted)] flex justify-between gap-4">
              <span>{k}</span>
              <span className="font-medium text-[var(--foreground)]">{formatEuro(Number(point[k]) || 0)}</span>
            </p>
          ))}
      </div>
      <p className="text-[var(--muted)] pt-1.5 border-t border-[var(--border)]/50 mt-1.5 font-medium">
        Total : <span className="text-[var(--foreground)]">{formatEuro(total)}</span>
      </p>
    </div>
  )
}

/** Tooltip CA client — détail Revenus (factures payées), Avoirs, Total net */
type RevenueDetailPoint = { month: string; label: string; paidAmount: number; creditNotesAmount: number; total: number }
function AnalyticsRevenueTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ payload?: RevenueDetailPoint }>
  label?: string
}) {
  if (!active || !payload?.length || !label) return null
  const point = payload[0]?.payload as RevenueDetailPoint | undefined
  if (!point) return null
  const { paidAmount, creditNotesAmount, total } = point
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-lg px-4 py-3 text-sm min-w-[220px]">
      <p className="font-medium text-[var(--foreground)] border-b border-[var(--border)]/50 pb-1.5 mb-2">{label}</p>
      <div className="space-y-1">
        <p className="text-[var(--muted)]">
          Revenus (factures payées) : <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatEuro(paidAmount)}</span>
        </p>
        <p className="text-[var(--muted)]">
          Avoirs (remboursés) : <span className="font-semibold text-rose-600 dark:text-rose-400">{formatEuro(creditNotesAmount)}</span>
        </p>
        <p className="text-[var(--muted)] pt-1 border-t border-[var(--border)]/50 mt-1.5">
          Total CA (net) : <span className={`font-semibold ${total >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{formatEuro(total)}</span>
        </p>
      </div>
    </div>
  )
}

export default function ComptabilitePage() {
  const { data: session } = useSession()
  const plan = (session?.user as { subscriptionPlan?: string })?.subscriptionPlan ?? 'starter'
  const [forbidden, setForbidden] = useState(false)
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<{
    from: string
    to: string
    summary: OverviewSummary
    revenueByMonth: { month: string; label: string; revenue: number }[]
    paidInvoicesByMonth?: { month: string; label: string; amount: number }[]
    revenueByYear: { year: number; revenue: number }[]
    expensesByMonth: { month: string; label: string; amount: number }[]
    creditNotesByMonth?: { month: string; amount: number }[]
    expensesByCategoryByMonth?: { month: string; label: string; [category: string]: string | number }[]
  } | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [clients, setClients] = useState<{ id: string; firstName: string; lastName: string; companyName: string | null }[]>([])
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [employees, setEmployees] = useState<{ id: string; firstName: string; lastName: string }[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccountEntry[]>([])
  const [filterBankAccountId, setFilterBankAccountId] = useState('')

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1 // 1-12
  const [periodYear, setPeriodYear] = useState(currentYear)
  const [periodMonth, setPeriodMonth] = useState<number | ''>('') // '' = toute l'année par défaut
  const [chartYear, setChartYear] = useState(currentYear)
  const [chartCurveFilter, setChartCurveFilter] = useState<'all' | 'revenue' | 'expenses'>('all')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterClientId, setFilterClientId] = useState('')

  const [expenseModalOpen, setExpenseModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [analyticsEntityType, setAnalyticsEntityType] = useState<'client' | 'company' | ''>('')
  const [analyticsEntityId, setAnalyticsEntityId] = useState('')
  const [analyticsYear, setAnalyticsYear] = useState(currentYear)
  const [analyticsData, setAnalyticsData] = useState<{
    paidInvoicesByMonth: { month: string; label: string; amount: number }[]
    quotesSentByMonth: { month: string; label: string; count: number }[]
    quotesSignedByMonth: { month: string; label: string; count: number }[]
    creditNotesRefundedByMonth: { month: string; label: string; amount: number }[]
    revenueByMonth: { month: string; label: string; amount: number }[]
  } | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [globalCounters, setGlobalCounters] = useState<{ month: string; label: string; clients: number; companies: number; products: number }[]>([])
  const [globalCountersYear, setGlobalCountersYear] = useState(currentYear)

  const { periodFrom, periodTo } = useMemo(() => {
    if (periodMonth === '') {
      return { periodFrom: `${periodYear}-01-01`, periodTo: `${periodYear}-12-31` }
    }
    const m = String(periodMonth).padStart(2, '0')
    const lastDay = new Date(periodYear, periodMonth, 0).getDate()
    return { periodFrom: `${periodYear}-${m}-01`, periodTo: `${periodYear}-${m}-${String(lastDay).padStart(2, '0')}` }
  }, [periodYear, periodMonth])

  const periodLabel = useMemo(() => {
    if (periodMonth === '') return String(periodYear)
    return `${MONTHS[periodMonth - 1]} ${periodYear}`
  }, [periodYear, periodMonth])

  /** Données fusionnées pour le graphique : vert = factures payées, rouge = dépenses + avoirs, revenu net = factures − dépenses − avoirs */
  const chartData = useMemo((): ChartPoint[] => {
    if (!overview?.revenueByMonth?.length) return []
    const rev = overview.revenueByMonth
    const paidMap = new Map((overview.paidInvoicesByMonth ?? []).map((x) => [x.month, x.amount]))
    const exp = overview.expensesByMonth ?? []
    const cnMap = new Map((overview.creditNotesByMonth ?? []).map((x) => [x.month, x.amount]))
    return rev.map((r) => {
      const paidAmount = paidMap.get(r.month) ?? 0
      const expItem = exp.find((e) => e.month === r.month)
      const expensesAmount = expItem?.amount ?? 0
      const creditNotesAmount = cnMap.get(r.month) ?? 0
      return {
        month: r.month,
        label: r.label,
        paidInvoices: paidAmount,
        expenses: expensesAmount,
        creditNotes: creditNotesAmount,
        expensesTotal: expensesAmount + creditNotesAmount,
      }
    })
  }, [overview])

  /** Même données avec points de padding (mois -1 et +1) pour que la ligne s’étende visuellement quand un seul mois est sélectionné, sans afficher ces mois. */
  const chartDataWithPadding = useMemo((): ChartPoint[] => {
    if (!chartData.length) return []
    if (chartData.length >= 6) return chartData
    const first = { ...chartData[0], label: '', _padding: true }
    const last = { ...chartData[chartData.length - 1], label: '', _padding: true }
    return [first, ...chartData, last]
  }, [chartData])

  /** Dépenses par catégorie avec padding pour étendre les lignes visuellement quand peu de mois. */
  const expensesByCategoryWithPadding = useMemo(() => {
    const data = overview?.expensesByCategoryByMonth ?? []
    if (!data.length || data.length >= 6) return data
    const first = { ...data[0], label: '', _padding: true } as typeof data[0] & { _padding?: boolean }
    const last = { ...data[data.length - 1], label: '', _padding: true } as typeof data[0] & { _padding?: boolean }
    return [first, ...data, last]
  }, [overview?.expensesByCategoryByMonth])

  const fetchOverview = useCallback(() => {
    const params = new URLSearchParams()
    params.set('from', periodFrom)
    params.set('to', periodTo)
    params.set('year', String(chartYear))
    fetch(`/api/comptabilite/overview?${params}`)
      .then((r) => {
        if (r.status === 403) {
          setForbidden(true)
          return null
        }
        return r.ok ? r.json() : null
      })
      .then((data) => {
        if (data) setOverview(data)
      })
  }, [periodFrom, periodTo, chartYear])

  const fetchExpenses = useCallback(() => {
    const params = new URLSearchParams()
    params.set('from', periodFrom)
    params.set('to', periodTo)
    if (filterBankAccountId) params.set('bankAccountId', filterBankAccountId)
    fetch(`/api/expenses?${params}`)
      .then((r) => {
        if (r.status === 403) return []
        return r.ok ? r.json() : []
      })
      .then(setExpenses)
  }, [periodFrom, periodTo, filterBankAccountId])

  const fetchTransactions = useCallback(() => {
    const params = new URLSearchParams()
    params.set('from', periodFrom)
    params.set('to', periodTo)
    if (filterType) params.set('type', filterType)
    if (filterStatus) params.set('status', filterStatus)
    if (filterClientId) params.set('clientId', filterClientId)
    if (filterBankAccountId) params.set('bankAccountId', filterBankAccountId)
    fetch(`/api/comptabilite/transactions?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setTransactions)
  }, [periodFrom, periodTo, filterType, filterStatus, filterClientId, filterBankAccountId])

  useEffect(() => {
    Promise.all([
      fetch('/api/clients').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/companies').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/settings').then((r) => (r.ok ? r.json() : null)),
    ]).then(([clientsList, companiesList, settings]) => {
      setClients(clientsList ?? [])
      setCompanies(companiesList ?? [])
      setBankAccounts(Array.isArray(settings?.bankAccounts) ? settings.bankAccounts : [])
    })
  }, [])

  useEffect(() => {
    if (expenseModalOpen && (plan === 'pro' || plan === 'business')) {
      fetch('/api/employees')
        .then((r) => (r.status === 403 ? [] : r.ok ? r.json() : []))
        .then(setEmployees)
    }
  }, [expenseModalOpen, plan])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/comptabilite/overview?from=${periodFrom}&to=${periodTo}&year=${chartYear}`).then((r) => {
        if (r.status === 403) {
          setForbidden(true)
          return null
        }
        return r.ok ? r.json() : null
      }),
      fetch(`/api/expenses?from=${periodFrom}&to=${periodTo}${filterBankAccountId ? `&bankAccountId=${encodeURIComponent(filterBankAccountId)}` : ''}`).then((r) => (r.status === 403 ? [] : r.ok ? r.json() : [])),
    ]).then(([overviewData, expensesData]) => {
      if (overviewData) setOverview(overviewData)
      setExpenses(expensesData ?? [])
      setLoading(false)
    })
  }, [periodFrom, periodTo, chartYear, filterBankAccountId])

  useEffect(() => {
    const params = new URLSearchParams()
    params.set('from', periodFrom)
    params.set('to', periodTo)
    if (filterType) params.set('type', filterType)
    if (filterStatus) params.set('status', filterStatus)
    if (filterClientId) params.set('clientId', filterClientId)
    if (filterBankAccountId) params.set('bankAccountId', filterBankAccountId)
    fetch(`/api/comptabilite/transactions?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setTransactions)
  }, [periodFrom, periodTo, filterType, filterStatus, filterClientId, filterBankAccountId])

  useEffect(() => {
    fetch(`/api/analytics/global-counters?year=${globalCountersYear}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setGlobalCounters)
      .catch(() => setGlobalCounters([]))
  }, [globalCountersYear])

  useEffect(() => {
    if (!analyticsEntityType || !analyticsEntityId) {
      setAnalyticsData(null)
      return
    }
    setAnalyticsLoading(true)
    const base = analyticsEntityType === 'client' ? '/api/analytics/client' : '/api/analytics/company'
    fetch(`${base}/${analyticsEntityId}?year=${analyticsYear}`)
      .then((r) => {
        if (!r.ok) return null
        return r.json()
      })
      .then((data) => {
        setAnalyticsData(data)
      })
      .catch(() => setAnalyticsData(null))
      .finally(() => setAnalyticsLoading(false))
  }, [analyticsEntityType, analyticsEntityId, analyticsYear])

  const handleExport = (format: 'csv' | 'excel' | 'report') => {
    const params = new URLSearchParams()
    params.set('from', periodFrom)
    params.set('to', periodTo)
    if (format !== 'csv') params.set('format', format)
    window.open(`/api/export/accounting?${params}`, '_blank')
  }

  const openEditExpense = (e: Expense) => {
    setEditingExpense(e)
    setExpenseModalOpen(true)
  }

  const onExpenseModalSuccess = () => {
    setExpenseModalOpen(false)
    setEditingExpense(null)
    fetchExpenses()
    fetchOverview()
    fetchTransactions()
  }

  const deleteExpense = async (id: string) => {
    if (!confirm('Supprimer cette dépense ?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setExpenses((prev) => prev.filter((x) => x.id !== id))
        fetchOverview()
        fetchTransactions()
      }
    } finally {
      setDeletingId(null)
    }
  }

  const revenueVsExpensesChart = useMemo(() => {
    if (!overview) return []
    const byMonth: Record<string, { month: string; label: string; revenue: number; expenses: number }> = {}
    overview.revenueByMonth.forEach((r) => {
      byMonth[r.month] = { month: r.month, label: r.label, revenue: r.revenue, expenses: 0 }
    })
    overview.expensesByMonth.forEach((e) => {
      if (!byMonth[e.month]) byMonth[e.month] = { month: e.month, label: e.label, revenue: 0, expenses: 0 }
      byMonth[e.month].expenses = e.amount
    })
    return Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month))
  }, [overview])

  const needsUpgrade = forbidden || plan === 'starter'
  if (needsUpgrade) {
    return (
      <UpgradeGate plan={plan as 'starter' | 'pro' | 'business'} requiredPlan="pro" title="Comptabilité avancée">
        <div className="max-w-6xl mx-auto space-y-8" />
      </UpgradeGate>
    )
  }

  const summary = overview?.summary

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Comptabilité</h1>
        <p className="text-[var(--muted)] text-sm mt-1">Vue d&apos;ensemble financière, revenus, dépenses et rapports</p>
      </div>

      {/* ——— 1. Financial overview ——— */}
      <section>
        <h2 className="text-sm font-medium text-[var(--muted)] uppercase tracking-wider mb-4">Vue d&apos;ensemble</h2>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-28 rounded-xl border border-[var(--border)] bg-[var(--background)] animate-pulse" />
            ))}
          </div>
        ) : summary ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--background)]">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--muted)]">CA net</span>
                <Receipt className="w-5 h-5 text-[var(--muted)]" />
              </div>
              <p className={`mt-2 text-xl font-semibold ${summary.totalRevenue >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{formatEuro(summary.totalRevenue)}</p>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                {summary.revenueEvolution != null && (
                  <span className={summary.revenueEvolution >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                    {summary.revenueEvolution >= 0 ? '+' : ''}{summary.revenueEvolution} % vs période précédente
                  </span>
                )}
                {summary.revenueEvolution == null && 'Factures payées − avoirs'}
              </p>
            </div>
            <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--background)]">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--muted)]">Factures payées</span>
                <CreditCard className="w-5 h-5 text-[var(--muted)]" />
              </div>
              <p className="mt-2 text-xl font-semibold text-[var(--foreground)]">{formatEuro(summary.totalPaidInvoices)}</p>
              <p className="text-xs text-[var(--muted)]">{summary.totalPaidInvoicesCount} facture{summary.totalPaidInvoicesCount !== 1 ? 's' : ''}</p>
            </div>
            <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--background)]">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--muted)]">Factures en attente</span>
                <AlertCircle className="w-5 h-5 text-amber-500" />
              </div>
              <p className="mt-2 text-xl font-semibold text-amber-600 dark:text-amber-400">{formatEuro(summary.totalUnpaidInvoices)}</p>
              <p className="text-xs text-[var(--muted)]">Non payées</p>
            </div>
            <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--background)]">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--muted)]">Dépenses</span>
                <Wallet className="w-5 h-5 text-[var(--muted)]" />
              </div>
              <p className="mt-2 text-xl font-semibold text-rose-600 dark:text-rose-400">{formatEuro(summary.totalExpenses)}</p>
              <p className="text-xs text-[var(--muted)]">
                {summary.expensesEvolution != null && (
                  <span className={summary.expensesEvolution >= 0 ? 'text-rose-500' : 'text-emerald-500'}>
                    {summary.expensesEvolution >= 0 ? '+' : ''}{summary.expensesEvolution} % vs période précédente
                  </span>
                )}
              </p>
            </div>
            <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--background)]">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--muted)]">Résultat net</span>
                {summary.netProfit >= 0 ? <TrendingUp className="w-5 h-5 text-emerald-500" /> : <TrendingDown className="w-5 h-5 text-rose-500" />}
              </div>
              <p className={`mt-2 text-xl font-semibold ${summary.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {formatEuro(summary.netProfit)}
              </p>
              <p className="text-xs text-[var(--muted)]">
                {summary.netProfitEvolution != null && (
                  <span className={summary.netProfitEvolution >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                    {summary.netProfitEvolution >= 0 ? '+' : ''}{summary.netProfitEvolution} % vs période précédente
                  </span>
                )}
              </p>
            </div>
          </div>
        ) : null}
      </section>

      {/* Filtres : compte bancaire (par défaut "Tous les comptes") + période (mois de l'année) */}
      <div className="flex flex-wrap items-center gap-4">
        {bankAccounts.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--muted)]">Compte bancaire</span>
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
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--muted)]">Période</span>
          <select
            value={periodYear}
            onChange={(e) => setPeriodYear(parseInt(e.target.value, 10))}
            className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm"
          >
            {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            value={periodMonth === '' ? '' : periodMonth}
            onChange={(e) => setPeriodMonth(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
            className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm min-w-[140px]"
          >
            <option value="">Toute l&apos;année</option>
            {MONTHS.map((label, i) => (
              <option key={i} value={i + 1}>{label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--muted)]">Graphique</span>
          <select
            value={chartCurveFilter}
            onChange={(e) => setChartCurveFilter(e.target.value as 'all' | 'revenue' | 'expenses')}
            className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm min-w-[180px]"
          >
            <option value="all">Toutes les courbes</option>
            <option value="revenue">Revenus (factures payées) uniquement</option>
            <option value="expenses">Dépenses + avoirs uniquement</option>
          </select>
        </div>
        <p className="text-sm font-medium text-[var(--foreground)] w-full mt-2 pt-2 border-t border-[var(--border)]">
          Période affichée : <span className="text-[var(--muted)] font-normal">{periodLabel}</span>
        </p>
      </div>

      {/* ——— 2. Revenus et Dépenses (courbes) ——— */}
      <section>
        <h2 className="text-sm font-medium text-[var(--muted)] uppercase tracking-wider mb-4">Revenus et dépenses</h2>
        <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--background)]">
          <div className="h-[280px]">
            {chartData.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartDataWithPadding} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgb(16 185 129)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgb(244 63 94)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="rgb(244 63 94)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                    stroke="var(--muted)"
                    tickFormatter={(value, index) => (chartDataWithPadding[index] as ChartPoint)?._padding ? '' : value}
                  />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip content={<RevenueExpensesChartTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
                  {(chartCurveFilter === 'all' || chartCurveFilter === 'revenue') && (
                    <Area type="monotone" dataKey="paidInvoices" name="Revenus (factures payées)" stroke="rgb(16 185 129)" strokeWidth={2} fill="url(#revGrad)" />
                  )}
                  {(chartCurveFilter === 'all' || chartCurveFilter === 'expenses') && (
                    <Area type="monotone" dataKey="expensesTotal" name="Dépenses + avoirs" stroke="rgb(244 63 94)" strokeWidth={2} fill="url(#expGrad)" />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-[var(--muted)] text-sm">Aucune donnée sur la période</div>
            )}
          </div>
          <p className="text-xs text-[var(--muted)] mt-4 pt-3 border-t border-[var(--border)]/50">
            Courbe verte = Revenus (factures payées). Courbe rouge = Dépenses + avoirs. Revenu net = factures payées − dépenses − avoirs.
          </p>
        </div>
      </section>

      {/* ——— 2b. Dépenses par catégorie (lignes) ——— */}
      {overview?.expensesByCategoryByMonth && overview.expensesByCategoryByMonth.length > 0 && (() => {
        const first = overview.expensesByCategoryByMonth[0]
        const categoryKeys = Object.keys(first).filter((k) => k !== 'month' && k !== 'label' && k !== '_padding') as string[]
        const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#eab308', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1', '#14b8a6', '#a855f7']
        return (
          <section>
            <h2 className="text-sm font-medium text-[var(--muted)] uppercase tracking-wider mb-4">Dépenses par catégorie</h2>
            <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--background)]">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={expensesByCategoryWithPadding} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10 }}
                      stroke="var(--muted)"
                      tickFormatter={(value, index) => (expensesByCategoryWithPadding[index] as { _padding?: boolean })?._padding ? '' : value}
                    />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Tooltip content={<ExpensesByCategoryTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
                    <Legend />
                    {categoryKeys.map((cat, i) => (
                      <Line key={cat} type="monotone" dataKey={cat} name={cat} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-[var(--muted)] mt-4 pt-3 border-t border-[var(--border)]/50">
                Une ligne par catégorie de dépense. Survolez un mois pour voir le détail.
              </p>
            </div>
          </section>
        )
      })()}

      {/* ——— 3. Expense management ——— */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-[var(--muted)] uppercase tracking-wider">Dépenses</h2>
          <button
            type="button"
            onClick={() => { setEditingExpense(null); setExpenseModalOpen(true) }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] font-medium text-sm hover:bg-[var(--border)]/20"
          >
            Nouvelle dépense
          </button>
        </div>
        <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--background)]">
          <div className="mb-4">
            <p className="text-sm text-[var(--muted)]">Liste des dépenses sur la période (20 lignes visibles, défilement pour le reste)</p>
          </div>
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(20*2.75rem)] border border-[var(--border)]/50 rounded-lg">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-[var(--background)] shadow-[0_1px_0_0_var(--border)]">
                <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                  <th className="pb-2 pt-2 pr-4 font-medium bg-[var(--background)]">Date</th>
                  <th className="pb-2 pt-2 pr-4 font-medium bg-[var(--background)]">Description</th>
                  <th className="pb-2 pt-2 pr-4 font-medium bg-[var(--background)]">Catégorie</th>
                  <th className="pb-2 pt-2 pr-4 font-medium bg-[var(--background)]">Pour qui</th>
                  <th className="pb-2 pt-2 pr-4 font-medium text-right bg-[var(--background)]">Montant</th>
                  <th className="pb-2 pt-2 pr-4 font-medium bg-[var(--background)]">Fournisseur</th>
                  <th className="pb-2 pt-2 font-medium text-right bg-[var(--background)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[var(--muted)]">Aucune dépense</td>
                  </tr>
                ) : (
                  expenses.map((e) => {
                    const pourQui = e.employee ? `${e.employee.firstName} ${e.employee.lastName}` : e.company?.name ?? (e.client ? [e.client.firstName, e.client.lastName].filter(Boolean).join(' ') || e.client.companyName : null) ?? 'La boîte'
                    return (
                    <tr key={e.id} className="border-b border-[var(--border)]/60 hover:bg-[var(--border)]/10">
                      <td className="py-3 pr-4">{formatDateFR(e.date)}</td>
                      <td className="py-3 pr-4 max-w-[200px] truncate" title={e.description ?? ''}>{e.description || '—'}</td>
                      <td className="py-3 pr-4">{e.category}</td>
                      <td className="py-3 pr-4 text-[var(--muted)]">{pourQui}</td>
                      <td className="py-3 pr-4 text-right font-medium">{formatEuro(e.amount)}</td>
                      <td className="py-3 pr-4">{e.supplier || '—'}</td>
                      <td className="py-3 text-right">
                        {e.invoiceFile && (
                          <a href={e.invoiceFile} target="_blank" rel="noopener noreferrer" className="inline-flex p-2 text-[var(--muted)] hover:text-[var(--foreground)]" title="Voir le reçu">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        <button type="button" onClick={() => openEditExpense(e)} className="inline-flex p-2 text-[var(--muted)] hover:text-[var(--foreground)]" title="Modifier">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => deleteExpense(e.id)} disabled={deletingId === e.id} className="inline-flex p-2 text-[var(--muted)] hover:text-rose-500 disabled:opacity-50" title="Supprimer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ——— 4. Profit + Revenue vs Expenses ——— */}
      <section>
        <h2 className="text-sm font-medium text-[var(--muted)] uppercase tracking-wider mb-4">Revenus vs Dépenses</h2>
        <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--background)]">
          <div className="h-[260px]">
            {revenueVsExpensesChart.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={revenueVsExpensesChart} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--muted)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--muted)" tickFormatter={(v) => `${v} €`} />
                  <Tooltip content={<RevenueVsExpensesTooltip />} cursor={{ fill: 'var(--border)', fillOpacity: 0.1 }} />
                  <Legend />
                  <Bar dataKey="revenue" name="Revenus" fill="rgb(59 130 246)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Dépenses" fill="rgb(244 63 94)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-[var(--muted)] text-sm">Aucune donnée</div>
            )}
          </div>
        </div>
      </section>

      {/* ——— 5. Advanced Analytics ——— */}
      <section>
        <h2 className="text-sm font-medium text-[var(--muted)] uppercase tracking-wider mb-4">Analyses avancées</h2>

        <div className="space-y-8">
          {/* Global counters: clients, companies, products (cumulative by month) */}
          <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--background)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-medium text-[var(--foreground)]">Évolution des effectifs</h3>
              <select
                value={globalCountersYear}
                onChange={(e) => setGlobalCountersYear(parseInt(e.target.value, 10))}
                className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm"
              >
                {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="h-[260px]">
              {globalCounters.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={globalCounters} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--muted)" />
                    <YAxis tick={{ fontSize: 10 }} stroke="var(--muted)" />
                    <Tooltip
                      content={({ active, payload, label }) =>
                        active && payload?.length ? (
                          <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-lg px-4 py-3 text-sm">
                            <p className="font-medium border-b border-[var(--border)]/50 pb-1.5 mb-2">{label}</p>
                            <p className="text-[var(--muted)]">Clients : <span className="font-medium text-[var(--foreground)]">{payload.find((p) => p.dataKey === 'clients')?.value ?? 0}</span></p>
                            <p className="text-[var(--muted)]">Sociétés : <span className="font-medium text-[var(--foreground)]">{payload.find((p) => p.dataKey === 'companies')?.value ?? 0}</span></p>
                            <p className="text-[var(--muted)]">Produits : <span className="font-medium text-[var(--foreground)]">{payload.find((p) => p.dataKey === 'products')?.value ?? 0}</span></p>
                          </div>
                        ) : null
                      }
                    />
                    <Legend />
                    <Area type="monotone" dataKey="clients" name="Clients" stroke="rgb(59 130 246)" fill="rgb(59 130 246)" fillOpacity={0.3} />
                    <Area type="monotone" dataKey="companies" name="Sociétés" stroke="rgb(16 185 129)" fill="rgb(16 185 129)" fillOpacity={0.3} />
                    <Area type="monotone" dataKey="products" name="Produits" stroke="rgb(147 51 234)" fill="rgb(147 51 234)" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-[var(--muted)] text-sm">Chargement…</div>
              )}
            </div>
            <p className="text-xs text-[var(--muted)] mt-3">Effectifs cumulés (clients, sociétés, produits) en fin de chaque mois.</p>
          </div>

          {/* Analyse Client / Société */}
          <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--background)]">
            <h3 className="text-base font-medium text-[var(--foreground)] mb-4">Analyse Client / Société</h3>
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <select
                value={analyticsEntityType}
                onChange={(e) => {
                  const v = e.target.value as 'client' | 'company' | ''
                  setAnalyticsEntityType(v)
                  setAnalyticsEntityId('')
                  setAnalyticsData(null)
                }}
                className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm min-w-[140px]"
              >
                <option value="">Sélectionner…</option>
                <option value="client">Client</option>
                <option value="company">Société</option>
              </select>
              {analyticsEntityType === 'client' && (
                <select
                  value={analyticsEntityId}
                  onChange={(e) => setAnalyticsEntityId(e.target.value)}
                  className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm min-w-[220px]"
                >
                  <option value="">Choisir un client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {[c.firstName, c.lastName].filter(Boolean).join(' ') || c.companyName || c.id}
                    </option>
                  ))}
                </select>
              )}
              {analyticsEntityType === 'company' && (
                <select
                  value={analyticsEntityId}
                  onChange={(e) => setAnalyticsEntityId(e.target.value)}
                  className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm min-w-[220px]"
                >
                  <option value="">Choisir une société</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
              {(analyticsEntityType && analyticsEntityId) ? (
                <select
                  value={analyticsYear}
                  onChange={(e) => setAnalyticsYear(parseInt(e.target.value, 10))}
                  className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm"
                >
                  {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              ) : null}
            </div>

            {!analyticsEntityId ? (
              <p className="text-sm text-[var(--muted)]">Sélectionnez un client ou une société pour afficher les graphiques.</p>
            ) : analyticsLoading ? (
              <div className="py-12 text-center text-[var(--muted)]">Chargement…</div>
            ) : analyticsData ? (
              (() => {
                const revenueChartData = analyticsData.paidInvoicesByMonth.map((p) => {
                  const cn = analyticsData.creditNotesRefundedByMonth.find((c) => c.month === p.month)
                  const paidAmount = p.amount
                  const creditNotesAmount = cn?.amount ?? 0
                  return {
                    month: p.month,
                    label: p.label,
                    paidAmount,
                    creditNotesAmount,
                    total: paidAmount - creditNotesAmount,
                  }
                })
                return (
                  <div className="space-y-8">
                    <div>
                      <h3 className="text-base font-medium text-[var(--foreground)] mb-4">Factures payées (montant par mois)</h3>
                      <div className="h-[220px]">
                        <ResponsiveContainer width="100%" height={200}>
                          <AreaChart data={analyticsData.paidInvoicesByMonth} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                            <defs>
                              <linearGradient id="analyticsPaidGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="rgb(16 185 129)" stopOpacity={0.4} />
                                <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--muted)" />
                            <YAxis tick={{ fontSize: 10 }} stroke="var(--muted)" tickFormatter={(v) => `${v} €`} />
                            <Tooltip content={<AnalyticsAmountTooltip valueLabel="Montant" />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
                            <Area type="monotone" dataKey="amount" name="Montant" stroke="rgb(16 185 129)" strokeWidth={2} fill="url(#analyticsPaidGrad)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-base font-medium text-[var(--foreground)] mb-4">Devis envoyés (nombre par mois)</h3>
                      <div className="h-[220px]">
                        <ResponsiveContainer width="100%" height={200}>
                          <AreaChart data={analyticsData.quotesSentByMonth} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                            <defs>
                              <linearGradient id="analyticsSentGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="rgb(59 130 246)" stopOpacity={0.4} />
                                <stop offset="100%" stopColor="rgb(59 130 246)" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--muted)" />
                            <YAxis tick={{ fontSize: 10 }} stroke="var(--muted)" />
                            <Tooltip content={<AnalyticsCountTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
                            <Area type="monotone" dataKey="count" name="Nombre" stroke="rgb(59 130 246)" strokeWidth={2} fill="url(#analyticsSentGrad)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-base font-medium text-[var(--foreground)] mb-4">Devis signés (nombre par mois)</h3>
                      <div className="h-[220px]">
                        <ResponsiveContainer width="100%" height={200}>
                          <AreaChart data={analyticsData.quotesSignedByMonth} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                            <defs>
                              <linearGradient id="analyticsSignedGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="rgb(147 51 234)" stopOpacity={0.4} />
                                <stop offset="100%" stopColor="rgb(147 51 234)" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--muted)" />
                            <YAxis tick={{ fontSize: 10 }} stroke="var(--muted)" />
                            <Tooltip content={<AnalyticsCountTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
                            <Area type="monotone" dataKey="count" name="Nombre" stroke="rgb(147 51 234)" strokeWidth={2} fill="url(#analyticsSignedGrad)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-base font-medium text-[var(--foreground)] mb-4">Avoirs remboursés (montant par mois)</h3>
                      <div className="h-[220px]">
                        <ResponsiveContainer width="100%" height={200}>
                          <AreaChart data={analyticsData.creditNotesRefundedByMonth} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                            <defs>
                              <linearGradient id="analyticsRefundedGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="rgb(244 63 94)" stopOpacity={0.4} />
                                <stop offset="100%" stopColor="rgb(244 63 94)" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--muted)" />
                            <YAxis tick={{ fontSize: 10 }} stroke="var(--muted)" tickFormatter={(v) => `${v} €`} />
                            <Tooltip content={<AnalyticsAmountTooltip valueLabel="Montant" />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
                            <Area type="monotone" dataKey="amount" name="Montant" stroke="rgb(244 63 94)" strokeWidth={2} fill="url(#analyticsRefundedGrad)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-base font-medium text-[var(--foreground)] mb-4">Total CA client (revenus par mois)</h3>
                      <div className="h-[220px]">
                        <ResponsiveContainer width="100%" height={200}>
                          <AreaChart data={revenueChartData} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                            <defs>
                              <linearGradient id="analyticsRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="rgb(34 197 94)" stopOpacity={0.4} />
                                <stop offset="100%" stopColor="rgb(34 197 94)" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--muted)" />
                            <YAxis tick={{ fontSize: 10 }} stroke="var(--muted)" tickFormatter={(v) => `${v} €`} />
                            <Tooltip content={<AnalyticsRevenueTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
                            <Area type="monotone" dataKey="total" name="CA net" stroke="rgb(34 197 94)" strokeWidth={2} fill="url(#analyticsRevenueGrad)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )
              })()
            ) : (
              <p className="text-sm text-[var(--muted)]">Aucune donnée pour cette sélection.</p>
            )}
          </div>
        </div>
      </section>

      {/* ——— 6. Export ——— */}
      <section>
        <h2 className="text-sm font-medium text-[var(--muted)] uppercase tracking-wider mb-4">Exports et rapports</h2>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => handleExport('csv')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] font-medium hover:bg-[var(--border)]/20"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => handleExport('excel')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] font-medium hover:bg-[var(--border)]/20"
          >
            <Download className="w-4 h-4" />
            Export Excel
          </button>
          <button
            type="button"
            onClick={() => handleExport('report')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] font-medium hover:bg-[var(--border)]/20"
          >
            <FileText className="w-4 h-4" />
            Rapport comptable
          </button>
        </div>
        <p className="text-xs text-[var(--muted)] mt-2">Factures, dépenses et synthèse revenus sur la période sélectionnée.</p>
      </section>

      {/* ——— 6. Accounting table + filters ——— */}
      <section>
        <h2 className="text-sm font-medium text-[var(--muted)] uppercase tracking-wider mb-4">Journal des opérations</h2>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm">
            <option value="">Tous les types</option>
            <option value="invoice">Factures</option>
            <option value="expense">Dépenses</option>
            <option value="credit_note">Avoirs</option>
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm">
            <option value="">Tous les statuts</option>
            <option value="paid">Payée</option>
            <option value="pending">En attente</option>
            <option value="sent">Envoyée</option>
            <option value="draft">Brouillon</option>
            <option value="refunded">Remboursé</option>
          </select>
          <select value={filterClientId} onChange={(e) => setFilterClientId(e.target.value)} className="px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm min-w-[180px]">
            <option value="">Tous les clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{[c.firstName, c.lastName].filter(Boolean).join(' ') || c.companyName || c.id}</option>
            ))}
          </select>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--border)]/20 text-left text-[var(--muted)]">
                  <th className="p-3 font-medium">Date</th>
                  <th className="p-3 font-medium">Type</th>
                  <th className="p-3 font-medium">Référence</th>
                  <th className="p-3 font-medium">Client / Fournisseur</th>
                  <th className="p-3 font-medium text-right">Montant</th>
                  <th className="p-3 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-[var(--muted)]">Aucune opération</td>
                  </tr>
                ) : (
                  transactions.map((t) => (
                    <tr key={`${t.type}-${t.id}`} className="border-b border-[var(--border)]/50 hover:bg-[var(--border)]/10">
                      <td className="p-3">{formatDateFR(t.date)}</td>
                      <td className="p-3">
                        {t.type === 'invoice' && 'Facture'}
                        {t.type === 'expense' && 'Dépense'}
                        {t.type === 'credit_note' && 'Avoir'}
                      </td>
                      <td className="p-3 font-medium">{t.reference}</td>
                      <td className="p-3 text-[var(--muted)]">{t.clientOrSupplier || '—'}</td>
                      <td className={`p-3 text-right font-medium ${t.amount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {t.amount >= 0 ? '' : '−'} {formatEuro(Math.abs(t.amount))}
                      </td>
                      <td className="p-3">{statusLabels[t.status] ?? t.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <CreateExpenseModal
        open={expenseModalOpen}
        onClose={() => { setExpenseModalOpen(false); setEditingExpense(null) }}
        onSuccess={onExpenseModalSuccess}
        editExpense={editingExpense}
      />
    </div>
  )
}
