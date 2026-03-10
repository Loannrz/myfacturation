'use client'

import { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

type Stats = {
  totalUsers: number
  activeUsers: number
  starterCount: number
  proCount: number
  businessCount: number
  revenueMonthly: number
  usersByMonth: { month: string; count: number }[]
  planCounts: { plan: string; count: number }[]
}

const COLORS = ['#94a3b8', '#8b5cf6', '#f59e0b']

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/stats')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setStats(data)
      })
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-[var(--muted)]">Chargement…</div>
  if (!stats) return <div className="text-red-500">Erreur lors du chargement des statistiques.</div>

  const planChartData = stats.planCounts.map((p, i) => ({ name: p.plan, value: p.count, color: COLORS[i % COLORS.length] }))

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[var(--border)] p-6 bg-[var(--background)]">
          <p className="text-sm text-[var(--muted)]">Total utilisateurs</p>
          <p className="text-2xl font-bold mt-1">{stats.totalUsers}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] p-6 bg-[var(--background)]">
          <p className="text-sm text-[var(--muted)]">Utilisateurs actifs</p>
          <p className="text-2xl font-bold mt-1">{stats.activeUsers}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] p-6 bg-[var(--background)]">
          <p className="text-sm text-[var(--muted)]">Starter / Pro / Business</p>
          <p className="text-lg font-semibold mt-1">{stats.starterCount} / {stats.proCount} / {stats.businessCount}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] p-6 bg-[var(--background)]">
          <p className="text-sm text-[var(--muted)]">Revenu mensuel estimé</p>
          <p className="text-2xl font-bold mt-1">{stats.revenueMonthly} €</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-[var(--border)] p-6 bg-[var(--background)]">
          <h3 className="font-medium mb-4">Inscriptions par mois</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.usersByMonth}>
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="count" fill="var(--muted)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border)] p-6 bg-[var(--background)]">
          <h3 className="font-medium mb-4">Abonnements par plan</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={planChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {planChartData.map((_, i) => (
                    <Cell key={i} fill={planChartData[i].color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
