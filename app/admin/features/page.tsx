'use client'

import { useEffect, useState } from 'react'
import { Key } from 'lucide-react'

const FEATURE_LABELS: Record<string, string> = {
  factures: 'Factures',
  devis: 'Devis',
  produits: 'Produits / Services',
  clients: 'Clients',
  avoirs: 'Avoirs',
  depenses: 'Dépenses',
  exports: 'Exports CSV / Excel',
  multi_comptes_bancaires: 'Multi comptes bancaires',
  multi_etablissements: 'Multi établissements',
  historique_activite: 'Historique activité',
  comptabilite_avancee: 'Comptabilité avancée',
  parametres_avances: 'Paramètres avancés',
}

type Row = {
  feature: string
  starter: { enabled: boolean; limit: number | null }
  pro: { enabled: boolean; limit: number | null }
  business: { enabled: boolean; limit: number | null }
}

export default function AdminFeaturesPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const fetchFeatures = () => {
    fetch('/api/admin/features')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setRows(data.rows ?? [])
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchFeatures()
  }, [])

  const updateCell = (planKey: string, feature: string, enabled: boolean, limit: number | null) => {
    fetch('/api/admin/features', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planKey, feature, enabled, limit }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setMessage(data.error)
        else { setMessage('Mis à jour.'); fetchFeatures() }
      })
      .catch(() => setMessage('Erreur'))
  }

  if (loading) return <div className="text-[var(--muted)]">Chargement…</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Key className="w-5 h-5" />
        <h2 className="text-lg font-semibold">Permissions des plans</h2>
      </div>
      <p className="text-sm text-[var(--muted)]">Les changements s&apos;appliquent automatiquement sur le site.</p>
      {message && <p className="p-3 rounded-lg bg-[var(--border)]/30 text-sm">{message}</p>}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--background)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--border)]/10">
              <th className="text-left p-4 font-medium">Fonctionnalité</th>
              <th className="p-4 font-medium text-center">Starter</th>
              <th className="p-4 font-medium text-center">Pro</th>
              <th className="p-4 font-medium text-center">Business</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.feature} className="border-b border-[var(--border)]/60">
                <td className="p-4 font-medium">{FEATURE_LABELS[row.feature] ?? row.feature}</td>
                {(['starter', 'pro', 'business'] as const).map((plan) => {
                  const cell = row[plan]
                  return (
                    <td key={plan} className="p-4">
                      <div className="flex flex-col items-center gap-1">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={cell.enabled}
                            onChange={(e) => updateCell(plan, row.feature, e.target.checked, cell.limit)}
                          />
                          Activé
                        </label>
                        {(row.feature === 'factures' || row.feature === 'devis') && (
                          <input
                            type="number"
                            min={0}
                            placeholder="Limite"
                            value={cell.limit ?? ''}
                            onChange={(e) => {
                              const v = e.target.value
                              updateCell(plan, row.feature, cell.enabled, v === '' ? null : parseInt(v, 10) || 0)
                            }}
                            className="w-20 px-2 py-1 border border-[var(--border)] rounded text-center"
                          />
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
