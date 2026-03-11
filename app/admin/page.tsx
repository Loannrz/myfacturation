'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import {
  Users,
  CreditCard,
  Mail,
  FileText,
  AlertTriangle,
  Activity,
  Receipt,
} from 'lucide-react'

type DashboardData = {
  mainStats: {
    totalUsers: number
    activeUsersToday: number
    newUsersThisMonth: number
    trialUsers: number
    activeSubscriptions: number
    mrr: number
    totalRevenue: number
    successfulPayments: number
    cancellations: number
    trialConversionRate: number
  }
  charts: {
    signupsByDay: { day: string; count: number }[]
    usersByMonth: { month: string; count: number }[]
    planDistribution: { name: string; value: number; color: string }[]
    paymentSuccessCount: number
    paymentFailedCount: number
  }
  recentActivity: Array<{
    date: string
    type: string
    eventType?: string
    action?: string
    entityType?: string
    entityId?: string | null
    metadata?: string | null
    userEmail?: string | null
    userName?: string | null
  }>
  productStats: {
    invoicesTotal: number
    quotesTotal: number
    clientsTotal: number
    invoicesSentToday: number
    documentsThisMonth: number
  }
  emailLogs: Array<{
    id: string
    emailType: string
    recipient: string
    subject: string
    bodyPreview?: string
    bodyFull?: string
    userId?: string
    createdAt: string
  }>
  alerts: Array< { type: string; message: string; count?: number }>
  report: { mrr: number; userGrowth: number; churnRate: number; revenueGrowth: number }
  recentPayments: Array<{
    id: string
    eventType: string
    userEmail: string | null
    userName: string | null
    amount: number | null
    createdAt: string
  }>
}

type SubItem = {
  userId: string
  userEmail: string | null
  userName: string | null
  plan: string
  cycle: string
  status: string
  startDate: string | null
  endDate: string | null
  createdAt: string
}

const EVENT_LABELS: Record<string, string> = {
  user_signup: 'Nouvel utilisateur',
  subscription_started: 'Abonnement démarré',
  subscription_canceled: 'Abonnement annulé',
  payment_success: 'Paiement réussi',
  payment_failed: 'Paiement échoué',
}
const ACTIVITY_LABELS: Record<string, string> = {
  created: 'créé',
  sent: 'envoyé',
  paid: 'payé',
  invoice: 'Facture',
  quote: 'Devis',
  client: 'Client',
}
const EMAIL_TYPE_LABELS: Record<string, string> = {
  welcome: 'Bienvenue',
  trial_start: 'Essai démarré',
  trial_ending: 'Fin d\'essai',
  payment_success: 'Paiement reçu',
  cancellation: 'Annulation',
  weekly: 'Récap hebdo',
}

/** Tooltip commun : carte sombre avec bordure et infos claires */
function ChartTooltipWrapper({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-xl px-4 py-3 min-w-[160px]">
      {label != null && label !== '' && (
        <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-2 pb-2 border-b border-[var(--border)]">
          {label}
        </p>
      )}
      <div className="text-sm text-[var(--foreground)]">{children}</div>
    </div>
  )
}

/** Tooltip inscriptions par jour */
function SignupsByDayTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length || label == null) return null
  const date = new Date(label)
  const dateStr = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <ChartTooltipWrapper label={dateStr}>
      <p className="font-semibold text-[var(--foreground)]">{payload[0].value} inscription{payload[0].value > 1 ? 's' : ''}</p>
    </ChartTooltipWrapper>
  )
}

/** Tooltip inscriptions par mois */
function UsersByMonthTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length || label == null) return null
  const [year, month] = label.split('-')
  const monthStr = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  return (
    <ChartTooltipWrapper label={monthStr}>
      <p className="font-semibold text-[var(--foreground)]">{payload[0].value} inscription{payload[0].value > 1 ? 's' : ''}</p>
    </ChartTooltipWrapper>
  )
}

/** Tooltip répartition des plans (camembert) */
function PlanDistributionTooltip({
  active,
  payload,
  total = 0,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  total?: number
}) {
  if (!active || !payload?.length) return null
  const pct = total > 0 ? Math.round((payload[0].value / total) * 100) : 0
  return (
    <ChartTooltipWrapper label={payload[0].name}>
      <p className="font-semibold text-[var(--foreground)]">{payload[0].value} utilisateur{payload[0].value > 1 ? 's' : ''}</p>
      <p className="text-xs text-[var(--muted)] mt-0.5">{pct} % du total</p>
    </ChartTooltipWrapper>
  )
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [subscriptions, setSubscriptions] = useState<SubItem[]>([])
  const [users, setUsers] = useState<Array<{
    id: string
    name: string | null
    email: string | null
    plan: string
    createdAt: string
    invoicesCount?: number
    clientsCount?: number
  }>>([])
  const [loading, setLoading] = useState(true)
  const [emailModal, setEmailModal] = useState<DashboardData['emailLogs'][0] | null>(null)
  const [subFilter, setSubFilter] = useState<'all' | 'trialing' | 'active' | 'cancelled'>('all')
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'success' | 'failed'>('all')

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/dashboard').then((r) => r.json()),
      fetch('/api/admin/subscriptions?limit=100').then((r) => r.json()),
      fetch('/api/admin/users?limit=100').then((r) => r.json()),
    ])
      .then(([d, subRes, usersRes]) => {
        if (d.error) throw new Error(d.error)
        setData(d)
        if (subRes.subscriptions) setSubscriptions(subRes.subscriptions)
        if (usersRes.users) setUsers(usersRes.users)
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-[var(--muted)] p-6">Chargement du dashboard…</div>
  if (!data) return <div className="p-6 text-red-500">Erreur lors du chargement.</div>

  const s = data.mainStats
  const filteredSubs =
    subFilter === 'all'
      ? subscriptions
      : subscriptions.filter((x) =>
          subFilter === 'trialing'
            ? x.status === 'trialing'
            : subFilter === 'active'
              ? x.status === 'active'
              : x.status === 'cancelled'
        )
  const filteredPayments =
    paymentFilter === 'all'
      ? data.recentPayments
      : data.recentPayments.filter((p) =>
          paymentFilter === 'success' ? p.eventType === 'payment_success' : p.eventType === 'payment_failed'
        )

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="space-y-10 pb-12">
      {/* Section 10 — Rapport global */}
      <section className="rounded-xl border border-[var(--border)] p-6 bg-[var(--background)]">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Rapport global</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-[var(--muted)]">Revenu mensuel (MRR)</p>
            <p className="text-xl font-bold text-[var(--foreground)]">{data.report.mrr} €</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">Croissance utilisateurs</p>
            <p className="text-xl font-bold text-emerald-500">{data.report.userGrowth} %</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">Croissance revenus</p>
            <p className="text-xl font-bold text-emerald-500">{data.report.revenueGrowth} %</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">Churn rate</p>
            <p className="text-xl font-bold text-amber-500">{data.report.churnRate} %</p>
          </div>
        </div>
      </section>

      {/* Section 1 — Statistiques principales */}
      <section>
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Statistiques principales</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="rounded-xl border border-[var(--border)] p-4 bg-[var(--background)]">
            <p className="text-xs text-[var(--muted)]">Total utilisateurs</p>
            <p className="text-2xl font-bold mt-1">{s.totalUsers}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-4 bg-[var(--background)]">
            <p className="text-xs text-[var(--muted)]">Actifs aujourd&apos;hui</p>
            <p className="text-2xl font-bold mt-1">{s.activeUsersToday}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-4 bg-[var(--background)]">
            <p className="text-xs text-[var(--muted)]">Nouveaux ce mois</p>
            <p className="text-2xl font-bold mt-1">{s.newUsersThisMonth}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-4 bg-[var(--background)]">
            <p className="text-xs text-[var(--muted)]">En essai gratuit</p>
            <p className="text-2xl font-bold mt-1">{s.trialUsers}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-4 bg-[var(--background)]">
            <p className="text-xs text-[var(--muted)]">Abonnements actifs</p>
            <p className="text-2xl font-bold mt-1">{s.activeSubscriptions}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-4 bg-[var(--background)]">
            <p className="text-xs text-[var(--muted)]">MRR</p>
            <p className="text-2xl font-bold mt-1">{s.mrr} €</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-4 bg-[var(--background)]">
            <p className="text-xs text-[var(--muted)]">Revenu total</p>
            <p className="text-2xl font-bold mt-1">{s.totalRevenue} €</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-4 bg-[var(--background)]">
            <p className="text-xs text-[var(--muted)]">Paiements réussis</p>
            <p className="text-2xl font-bold mt-1">{s.successfulPayments}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-4 bg-[var(--background)]">
            <p className="text-xs text-[var(--muted)]">Annulations</p>
            <p className="text-2xl font-bold mt-1">{s.cancellations}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-4 bg-[var(--background)]">
            <p className="text-xs text-[var(--muted)]">Conversion essai → abo</p>
            <p className="text-2xl font-bold mt-1">{s.trialConversionRate} %</p>
          </div>
        </div>
      </section>

      {/* Section 2 — Graphiques */}
      <section>
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Graphiques</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-[var(--border)] p-6 bg-[var(--background)]">
            <h3 className="font-medium mb-4">Inscriptions par jour (30j)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.charts.signupsByDay}>
                  <XAxis dataKey="day" fontSize={11} tickFormatter={(v) => v.slice(5)} />
                  <YAxis fontSize={11} />
                  <Tooltip content={<SignupsByDayTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
                  <Line type="monotone" dataKey="count" stroke="var(--foreground)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-6 bg-[var(--background)]">
            <h3 className="font-medium mb-4">Inscriptions par mois</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts.usersByMonth}>
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip content={<UsersByMonthTooltip />} cursor={{ fill: 'var(--border)', opacity: 0.2 }} />
                  <Bar dataKey="count" fill="var(--muted)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-6 bg-[var(--background)]">
            <h3 className="font-medium mb-4">Répartition des plans</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.charts.planDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {data.charts.planDistribution.map((e, i) => (
                      <Cell key={i} fill={e.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={
                      <PlanDistributionTooltip
                        total={data.charts.planDistribution.reduce((s, p) => s + p.value, 0)}
                      />
                    }
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] p-6 bg-[var(--background)]">
            <h3 className="font-medium mb-4">Paiements réussis vs échoués</h3>
            <div className="h-64 flex items-center justify-center gap-8">
              <div className="text-center">
                <p className="text-3xl font-bold text-emerald-500">{data.charts.paymentSuccessCount}</p>
                <p className="text-sm text-[var(--muted)]">Réussis</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-red-500">{data.charts.paymentFailedCount}</p>
                <p className="text-sm text-[var(--muted)]">Échoués</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 9 — Alertes */}
      {data.alerts.length > 0 && (
        <section className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-4">
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Alertes
          </h2>
          <ul className="space-y-1">
            {data.alerts.map((a, i) => (
              <li key={i} className="text-sm">
                {a.message}
                {a.count != null && <span className="ml-1 font-medium">({a.count})</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Section 3 — Activité récente */}
      <section className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--background)]">
        <h2 className="text-lg font-semibold text-[var(--foreground)] p-4 border-b border-[var(--border)] flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Activité récente
        </h2>
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--border)]/20 sticky top-0">
              <tr>
                <th className="text-left p-3 font-medium">Date</th>
                <th className="text-left p-3 font-medium">Type</th>
                <th className="text-left p-3 font-medium">Utilisateur</th>
                <th className="text-left p-3 font-medium">Détails</th>
              </tr>
            </thead>
            <tbody>
              {data.recentActivity.slice(0, 30).map((a, i) => (
                <tr key={i} className="border-t border-[var(--border)]/60">
                  <td className="p-3 text-[var(--muted)]">{formatDate(a.date)}</td>
                  <td className="p-3">
                    {a.type === 'system' && a.eventType
                      ? EVENT_LABELS[a.eventType] ?? a.eventType
                      : a.type === 'activity' && a.entityType
                        ? `${ACTIVITY_LABELS[a.entityType] ?? a.entityType} ${ACTIVITY_LABELS[a.action ?? ''] ?? a.action ?? ''}`
                        : '-'}
                  </td>
                  <td className="p-3">{a.userEmail ?? a.userName ?? '—'}</td>
                  <td className="p-3 text-[var(--muted)] max-w-[200px] truncate">{a.entityId ?? a.metadata ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 4 — Emails envoyés */}
      <section className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--background)]">
        <h2 className="text-lg font-semibold text-[var(--foreground)] p-4 border-b border-[var(--border)] flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Emails envoyés
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--border)]/20">
              <tr>
                <th className="text-left p-3 font-medium">Date</th>
                <th className="text-left p-3 font-medium">Type</th>
                <th className="text-left p-3 font-medium">Destinataire</th>
                <th className="text-left p-3 font-medium">Sujet</th>
                <th className="text-left p-3 font-medium">Aperçu</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {data.emailLogs.slice(0, 20).map((e) => (
                <tr key={e.id} className="border-t border-[var(--border)]/60 hover:bg-[var(--border)]/10">
                  <td className="p-3 text-[var(--muted)]">{formatDate(e.createdAt)}</td>
                  <td className="p-3">{EMAIL_TYPE_LABELS[e.emailType] ?? e.emailType}</td>
                  <td className="p-3">{e.recipient}</td>
                  <td className="p-3 max-w-[180px] truncate">{e.subject}</td>
                  <td className="p-3 max-w-[200px] truncate text-[var(--muted)]">{e.bodyPreview?.replace(/<[^>]*>/g, ' ').slice(0, 60)}…</td>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => setEmailModal(e)}
                      className="text-amber-500 hover:underline text-xs"
                    >
                      Voir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.emailLogs.length === 0 && (
          <p className="p-6 text-center text-[var(--muted)]">Aucun email enregistré (les envois sont loggés à partir de maintenant).</p>
        )}
      </section>

      {/* Section 5 — Abonnements */}
      <section className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--background)]">
        <h2 className="text-lg font-semibold text-[var(--foreground)] p-4 border-b border-[var(--border)] flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Abonnements
        </h2>
        <div className="p-3 flex gap-2 border-b border-[var(--border)]/60">
          {(['all', 'trialing', 'active', 'cancelled'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setSubFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm ${subFilter === f ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 font-medium' : 'text-[var(--muted)] hover:bg-[var(--border)]/20'}`}
            >
              {f === 'all' ? 'Tous' : f === 'trialing' ? 'Essai' : f === 'active' ? 'Actifs' : 'Annulés'}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--border)]/20">
              <tr>
                <th className="text-left p-3 font-medium">Email</th>
                <th className="text-left p-3 font-medium">Plan</th>
                <th className="text-left p-3 font-medium">Statut</th>
                <th className="text-left p-3 font-medium">Début</th>
                <th className="text-left p-3 font-medium">Fin essai / période</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubs.slice(0, 25).map((sub) => (
                <tr key={sub.userId} className="border-t border-[var(--border)]/60">
                  <td className="p-3">{sub.userEmail ?? '—'}</td>
                  <td className="p-3">{sub.plan}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${sub.status === 'active' ? 'bg-emerald-500/20 text-emerald-600' : sub.status === 'trialing' ? 'bg-amber-500/20 text-amber-600' : 'bg-[var(--border)]/30'}`}>
                      {sub.status}
                    </span>
                  </td>
                  <td className="p-3 text-[var(--muted)]">{sub.startDate ? formatDate(sub.startDate) : '—'}</td>
                  <td className="p-3 text-[var(--muted)]">{sub.endDate ? formatDate(sub.endDate) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t border-[var(--border)]/60">
          <Link href="/admin/subscriptions" className="text-sm text-amber-500 hover:underline">Voir tous les abonnements</Link>
        </div>
      </section>

      {/* Section 6 — Utilisateurs */}
      <section className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--background)]">
        <h2 className="text-lg font-semibold text-[var(--foreground)] p-4 border-b border-[var(--border)] flex items-center gap-2">
          <Users className="w-5 h-5" />
          Utilisateurs
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--border)]/20">
              <tr>
                <th className="text-left p-3 font-medium">Email</th>
                <th className="text-left p-3 font-medium">Plan</th>
                <th className="text-left p-3 font-medium">Inscription</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {users.slice(0, 25).map((u) => (
                <tr key={u.id} className="border-t border-[var(--border)]/60">
                  <td className="p-3">{u.email ?? '—'}</td>
                  <td className="p-3">{u.plan}</td>
                  <td className="p-3 text-[var(--muted)]">{formatDate(u.createdAt)}</td>
                  <td className="p-3">
                    <Link href={`/admin/users/${u.id}`} className="text-amber-500 hover:underline text-xs">Profil</Link>
                    {' · '}
                    <Link href={`/admin/emails?user=${u.id}`} className="text-amber-500 hover:underline text-xs">Email</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t border-[var(--border)]/60">
          <Link href="/admin/users" className="text-sm text-amber-500 hover:underline">Voir tous les utilisateurs</Link>
        </div>
      </section>

      {/* Section 7 — Paiements */}
      <section className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--background)]">
        <h2 className="text-lg font-semibold text-[var(--foreground)] p-4 border-b border-[var(--border)] flex items-center gap-2">
          <Receipt className="w-5 h-5" />
          Paiements récents
        </h2>
        <div className="p-3 flex gap-2 border-b border-[var(--border)]/60">
          {(['all', 'success', 'failed'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setPaymentFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm ${paymentFilter === f ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 font-medium' : 'text-[var(--muted)] hover:bg-[var(--border)]/20'}`}
            >
              {f === 'all' ? 'Tous' : f === 'success' ? 'Réussis' : 'Échoués'}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--border)]/20">
              <tr>
                <th className="text-left p-3 font-medium">Date</th>
                <th className="text-left p-3 font-medium">Utilisateur</th>
                <th className="text-left p-3 font-medium">Montant</th>
                <th className="text-left p-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.slice(0, 20).map((p) => (
                <tr key={p.id} className="border-t border-[var(--border)]/60">
                  <td className="p-3 text-[var(--muted)]">{formatDate(p.createdAt)}</td>
                  <td className="p-3">{p.userEmail ?? p.userName ?? '—'}</td>
                  <td className="p-3">{p.amount != null ? `${p.amount.toFixed(2)} €` : '—'}</td>
                  <td className="p-3">
                    <span className={p.eventType === 'payment_success' ? 'text-emerald-500' : 'text-red-500'}>
                      {p.eventType === 'payment_success' ? 'Réussi' : 'Échoué'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 8 — Statistiques produit */}
      <section className="rounded-xl border border-[var(--border)] p-6 bg-[var(--background)]">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Statistiques produit
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <p className="text-xs text-[var(--muted)]">Factures créées</p>
            <p className="text-xl font-bold">{data.productStats.invoicesTotal}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">Devis créés</p>
            <p className="text-xl font-bold">{data.productStats.quotesTotal}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">Clients créés</p>
            <p className="text-xl font-bold">{data.productStats.clientsTotal}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">Factures envoyées aujourd&apos;hui</p>
            <p className="text-xl font-bold">{data.productStats.invoicesSentToday}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">Documents ce mois</p>
            <p className="text-xl font-bold">{data.productStats.documentsThisMonth}</p>
          </div>
        </div>
      </section>

      {/* Modal email */}
      {emailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setEmailModal(null)}>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] max-w-lg w-full max-h-[80vh] overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <h3 className="font-semibold">Email envoyé</h3>
              <button type="button" onClick={() => setEmailModal(null)} className="p-1 rounded hover:bg-[var(--border)]/20">×</button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh] text-sm space-y-2">
              <p><span className="text-[var(--muted)]">Destinataire :</span> {emailModal.recipient}</p>
              <p><span className="text-[var(--muted)]">Type :</span> {EMAIL_TYPE_LABELS[emailModal.emailType] ?? emailModal.emailType}</p>
              <p><span className="text-[var(--muted)]">Sujet :</span> {emailModal.subject}</p>
              <p><span className="text-[var(--muted)]">Date :</span> {formatDate(emailModal.createdAt)}</p>
              <div className="mt-4 pt-4 border-t border-[var(--border)]">
                <p className="text-[var(--muted)] mb-2">Contenu :</p>
                <div className="prose prose-sm dark:prose-invert max-w-none text-[var(--foreground)]" dangerouslySetInnerHTML={{ __html: emailModal.bodyFull ?? emailModal.bodyPreview ?? '' }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
