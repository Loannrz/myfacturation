'use client'

import { useEffect, useState } from 'react'
import { Package } from 'lucide-react'

type Plan = {
  id: string
  key: string
  name: string
  priceMonthly: number
  priceYearly: number
  description: string | null
  enabled: boolean
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Record<string, Partial<Plan>>>({})
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/admin/plans')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setPlans(Array.isArray(data) ? data : [])
      })
      .catch(() => setPlans([]))
      .finally(() => setLoading(false))
  }, [])

  const savePlan = (plan: Plan) => {
    const d = editing[plan.key] ?? {}
    const payload = {
      key: plan.key,
      name: d.name ?? plan.name,
      priceMonthly: d.priceMonthly ?? plan.priceMonthly,
      priceYearly: d.priceYearly ?? plan.priceYearly,
      description: d.description !== undefined ? d.description : plan.description,
      enabled: d.enabled ?? plan.enabled,
    }
    fetch('/api/admin/plans', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setMessage(data.error)
        else {
          setPlans((prev) => prev.map((p) => (p.key === plan.key ? { ...p, ...data } : p)))
          setEditing((e) => { const n = { ...e }; delete n[plan.key]; return n })
          setMessage('Plan mis à jour.')
        }
      })
      .catch(() => setMessage('Erreur'))
  }

  if (loading) return <div className="text-[var(--muted)]">Chargement…</div>

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Plans</h2>
      {message && <p className="p-3 rounded-lg bg-[var(--border)]/30 text-sm">{message}</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const e = editing[plan.key] ?? {}
          return (
            <div key={plan.key} className="rounded-xl border border-[var(--border)] p-6 bg-[var(--background)]">
              <div className="flex items-center gap-2 mb-4">
                <Package className="w-5 h-5 text-[var(--muted)]" />
                <span className="font-medium">{plan.name}</span>
                {!plan.enabled && <span className="text-xs text-amber-600">(désactivé)</span>}
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="text-[var(--muted)] block mb-1">Prix mensuel (€)</label>
                  <input
                    type="number"
                    min={0}
                    value={e.priceMonthly ?? plan.priceMonthly}
                    onChange={(ev) => setEditing((prev) => ({ ...prev, [plan.key]: { ...prev[plan.key], priceMonthly: parseInt(ev.target.value, 10) || 0 } }))}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)]"
                  />
                </div>
                <div>
                  <label className="text-[var(--muted)] block mb-1">Prix annuel (€)</label>
                  <input
                    type="number"
                    min={0}
                    value={e.priceYearly ?? plan.priceYearly}
                    onChange={(ev) => setEditing((prev) => ({ ...prev, [plan.key]: { ...prev[plan.key], priceYearly: parseInt(ev.target.value, 10) || 0 } }))}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)]"
                  />
                </div>
                <div>
                  <label className="text-[var(--muted)] block mb-1">Description</label>
                  <input
                    type="text"
                    value={e.description ?? plan.description ?? ''}
                    onChange={(ev) => setEditing((prev) => ({ ...prev, [plan.key]: { ...prev[plan.key], description: ev.target.value } }))}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)]"
                  />
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={e.enabled ?? plan.enabled}
                    onChange={(ev) => setEditing((prev) => ({ ...prev, [plan.key]: { ...prev[plan.key], enabled: ev.target.checked } }))}
                  />
                  <span className="text-sm">Plan activé</span>
                </label>
              </div>
              <button
                type="button"
                onClick={() => savePlan(plan)}
                className="mt-4 w-full px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] text-sm font-medium"
              >
                Enregistrer
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
