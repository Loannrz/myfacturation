'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Pencil, Trash2, Eye, UserCircle } from 'lucide-react'
import { UpgradeGate } from '../components/UpgradeGate'
import { CreateEmployeeModal } from '../components/CreateEmployeeModal'

type Employee = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  address: string | null
  city: string | null
  postalCode: string | null
  country: string | null
  position: string | null
  contractType: string | null
  hireDate: string | null
  status: string
  socialSecurityNumber: string | null
  internalNotes: string | null
  createdAt: string
}

const CONTRACT_LABELS: Record<string, string> = {
  CDI: 'CDI',
  CDD: 'CDD',
  Alternant: 'Alternant',
  Stage: 'Stage',
  'Freelance / Mission': 'Freelance / Mission',
  Autre: 'Autre',
}

function formatDateFR(d: string | null) {
  if (!d) return '—'
  const [y, m, day] = d.slice(0, 10).split('-')
  return `${day}/${m}/${y}`
}

export default function SalariesPage() {
  const { data: session, status } = useSession()
  const plan = (session?.user as { subscriptionPlan?: string })?.subscriptionPlan ?? 'starter'
  const canEmployees = plan === 'business'
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [viewId, setViewId] = useState<string | null>(null)
  const [viewEmployee, setViewEmployee] = useState<Employee | null>(null)
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchEmployees = useCallback(() => {
    if (!canEmployees) return
    setLoading(true)
    fetch('/api/employees')
      .then((r) => {
        if (r.status === 403) return []
        return r.ok ? r.json() : []
      })
      .then(setEmployees)
      .finally(() => setLoading(false))
  }, [canEmployees])

  useEffect(() => {
    if (status !== 'authenticated') return
    if (!canEmployees) {
      setLoading(false)
      return
    }
    fetchEmployees()
  }, [status, canEmployees, fetchEmployees])

  const openView = (id: string) => {
    setViewId(id)
    const emp = employees.find((e) => e.id === id)
    if (emp) setViewEmployee(emp)
    else fetch(`/api/employees/${id}`).then((r) => (r.ok ? r.json() : null)).then(setViewEmployee)
  }

  const openEdit = (emp: Employee) => {
    setEditEmployee(emp)
    setEditModalOpen(true)
  }

  const handleDelete = async (emp: Employee) => {
    if (!confirm(`Supprimer le salarié ${emp.firstName} ${emp.lastName} ?`)) return
    setDeletingId(emp.id)
    try {
      const res = await fetch(`/api/employees/${emp.id}`, { method: 'DELETE' })
      if (res.ok) {
        setEmployees((prev) => prev.filter((e) => e.id !== emp.id))
        setViewId(null)
        setViewEmployee(null)
      }
    } finally {
      setDeletingId(null)
    }
  }

  if (status === 'loading' || !session) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-[var(--muted)]">
        Chargement…
      </div>
    )
  }

  if (!canEmployees) {
    return (
      <UpgradeGate plan={plan as 'starter' | 'pro' | 'business'} requiredPlan="business" title="Salariés">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-semibold tracking-tight">Salariés</h1>
          <p className="text-[var(--muted)] text-sm mt-1">Gérez les salariés de votre entreprise avec la formule Business.</p>
        </div>
      </UpgradeGate>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Salariés</h1>
        <p className="text-[var(--muted)] text-sm mt-1">Liste des salariés de l&apos;entreprise. La création se fait depuis Créer → Créer un salarié.</p>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[var(--muted)]">Chargement…</div>
        ) : employees.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">
            Aucun salarié. Allez sur <strong>Créer</strong> (Devis / Facture / Avoir) et cliquez sur &quot;Créer un salarié&quot; pour en ajouter un.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--border)]/20 text-left text-[var(--muted)]">
                  <th className="p-3 font-medium">Nom</th>
                  <th className="p-3 font-medium">Prénom</th>
                  <th className="p-3 font-medium">Email</th>
                  <th className="p-3 font-medium">Téléphone</th>
                  <th className="p-3 font-medium">Poste</th>
                  <th className="p-3 font-medium">Date d&apos;embauche</th>
                  <th className="p-3 font-medium">Statut</th>
                  <th className="p-3 font-medium">Type de contrat</th>
                  <th className="p-3 font-medium text-right w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.id} className="border-b border-[var(--border)]/60 hover:bg-[var(--border)]/10">
                    <td className="p-3 font-medium">{e.lastName}</td>
                    <td className="p-3">{e.firstName}</td>
                    <td className="p-3">{e.email}</td>
                    <td className="p-3 text-[var(--muted)]">{e.phone || '—'}</td>
                    <td className="p-3 text-[var(--muted)]">{e.position || '—'}</td>
                    <td className="p-3">{formatDateFR(e.hireDate)}</td>
                    <td className="p-3">
                      <span className={e.status === 'active' ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--muted)]'}>
                        {e.status === 'active' ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="p-3 text-[var(--muted)]">{e.contractType ? CONTRACT_LABELS[e.contractType] ?? e.contractType : '—'}</td>
                    <td className="p-3 text-right">
                      <button type="button" onClick={() => openView(e.id)} className="inline-flex p-2 text-[var(--muted)] hover:text-[var(--foreground)]" title="Voir le profil">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => openEdit(e)} className="inline-flex p-2 text-[var(--muted)] hover:text-[var(--foreground)]" title="Modifier">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => handleDelete(e)} disabled={deletingId === e.id} className="inline-flex p-2 text-[var(--muted)] hover:text-rose-500 disabled:opacity-50" title="Supprimer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal voir profil */}
      {viewId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => { setViewId(null); setViewEmployee(null) }}>
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-[var(--border)]/30">
                <UserCircle className="w-8 h-8 text-[var(--muted)]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  {viewEmployee ? `${viewEmployee.firstName} ${viewEmployee.lastName}` : '…'}
                </h3>
                <p className="text-sm text-[var(--muted)]">{viewEmployee?.position || '—'}</p>
              </div>
            </div>
            {viewEmployee && (
              <dl className="space-y-2 text-sm">
                <div><dt className="text-[var(--muted)]">Email</dt><dd>{viewEmployee.email}</dd></div>
                {viewEmployee.phone && <div><dt className="text-[var(--muted)]">Téléphone</dt><dd>{viewEmployee.phone}</dd></div>}
                {(viewEmployee.address || viewEmployee.city) && (
                  <div>
                    <dt className="text-[var(--muted)]">Adresse</dt>
                    <dd>{[viewEmployee.address, [viewEmployee.postalCode, viewEmployee.city].filter(Boolean).join(' '), viewEmployee.country].filter(Boolean).join(', ')}</dd>
                  </div>
                )}
                <div><dt className="text-[var(--muted)]">Type de contrat</dt><dd>{viewEmployee.contractType ? CONTRACT_LABELS[viewEmployee.contractType] ?? viewEmployee.contractType : '—'}</dd></div>
                <div><dt className="text-[var(--muted)]">Date d&apos;embauche</dt><dd>{formatDateFR(viewEmployee.hireDate)}</dd></div>
                <div><dt className="text-[var(--muted)]">Statut</dt><dd>{viewEmployee.status === 'active' ? 'Actif' : 'Inactif'}</dd></div>
                {viewEmployee.internalNotes && <div><dt className="text-[var(--muted)]">Notes</dt><dd className="whitespace-pre-wrap">{viewEmployee.internalNotes}</dd></div>}
              </dl>
            )}
            <div className="mt-6 flex gap-2">
              {viewEmployee && <button type="button" onClick={() => { setEditEmployee(viewEmployee); setEditModalOpen(true); setViewId(null); setViewEmployee(null) }} className="px-4 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] font-medium">Modifier</button>}
              <button type="button" onClick={() => { setViewId(null); setViewEmployee(null) }} className="px-4 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--border)]/20">Fermer</button>
            </div>
          </div>
        </div>
      )}

      <CreateEmployeeModal open={editModalOpen} onClose={() => { setEditModalOpen(false); setEditEmployee(null) }} onSuccess={() => { fetchEmployees(); setEditModalOpen(false); setEditEmployee(null) }} editEmployee={editEmployee} />
    </div>
  )
}
