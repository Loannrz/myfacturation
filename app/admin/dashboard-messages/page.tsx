'use client'

import { useEffect, useState } from 'react'
import {
  LayoutList,
  Plus,
  Pencil,
  Trash2,
  Upload,
  X,
  Check,
} from 'lucide-react'
import {
  DASHBOARD_MESSAGE_ICONS,
  getDashboardMessageIcon,
} from '@/lib/dashboard-message-icons'

type DashboardMessage = {
  id: string
  icon: string
  title: string
  body: string
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

const MAX_ACTIVE = 10

export default function AdminDashboardMessagesPage() {
  const [messages, setMessages] = useState<DashboardMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [publishing, setPublishing] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formIcon, setFormIcon] = useState('FileCheck')
  const [formTitle, setFormTitle] = useState('')
  const [formBody, setFormBody] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchMessages = () => {
    fetch('/api/admin/dashboard-messages')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setMessages(Array.isArray(data) ? data : [])
        setSelectedIds((prev) => {
          const next = new Set(prev)
          const active = (Array.isArray(data) ? data : [])
            .filter((m: DashboardMessage) => m.isActive)
            .map((m: DashboardMessage) => m.id)
          next.clear()
          active.forEach((id) => next.add(id))
          return next
        })
      })
      .catch(() => setMessages([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchMessages()
  }, [])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < MAX_ACTIVE) next.add(id)
      return next
    })
  }

  const handlePublish = () => {
    setPublishing(true)
    setFeedback('')
    fetch('/api/admin/dashboard-messages/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeIds: Array.from(selectedIds) }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setFeedback(data.error)
          return
        }
        setMessages(Array.isArray(data) ? data : [])
        setFeedback('Messages mis en ligne.')
      })
      .catch(() => setFeedback('Erreur lors de la mise en ligne.'))
      .finally(() => setPublishing(false))
  }

  const openCreate = () => {
    setEditingId(null)
    setFormIcon('FileCheck')
    setFormTitle('')
    setFormBody('')
    setShowForm(true)
  }

  const openEdit = (m: DashboardMessage) => {
    setEditingId(m.id)
    setFormIcon(m.icon)
    setFormTitle(m.title)
    setFormBody(m.body)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
  }

  const saveMessage = () => {
    if (!formTitle.trim() || !formBody.trim()) {
      setFeedback('Titre et texte requis.')
      return
    }
    setSaving(true)
    setFeedback('')
    const body = { icon: formIcon, title: formTitle.trim(), body: formBody.trim(), sortOrder: 0 }
    if (editingId) {
      fetch(`/api/admin/dashboard-messages/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.error) setFeedback(data.error)
          else { setFeedback('Message mis à jour.'); fetchMessages(); closeForm() }
        })
        .catch(() => setFeedback('Erreur.'))
        .finally(() => setSaving(false))
    } else {
      fetch('/api/admin/dashboard-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.error) setFeedback(data.error)
          else { setFeedback('Message créé.'); fetchMessages(); closeForm() }
        })
        .catch(() => setFeedback('Erreur.'))
        .finally(() => setSaving(false))
    }
  }

  const deleteMessage = (id: string) => {
    if (!confirm('Supprimer ce message ?')) return
    fetch(`/api/admin/dashboard-messages/${id}`, { method: 'DELETE' })
      .then((r) => r.json())
      .then(() => {
        setSelectedIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        fetchMessages()
        setFeedback('Message supprimé.')
      })
      .catch(() => setFeedback('Erreur suppression.'))
  }

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-[var(--muted)]">Chargement…</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-semibold text-[var(--foreground)] flex items-center gap-2">
          <LayoutList className="w-5 h-5" />
          Messages dashboard
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing || selectedIds.size === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            Mettre en ligne ({selectedIds.size}/{MAX_ACTIVE})
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--border)]/20"
          >
            <Plus className="w-4 h-4" />
            Nouveau message
          </button>
        </div>
      </div>

      <p className="text-sm text-[var(--muted)] mb-4">
        Cochez jusqu’à {MAX_ACTIVE} messages à afficher sur le dashboard des utilisateurs, puis cliquez sur « Mettre en ligne ».
      </p>

      {feedback && (
        <div className="mb-4 p-3 rounded-lg bg-[var(--border)]/30 text-sm">
          {feedback}
        </div>
      )}

      <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--background)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--border)]/10">
              <th className="text-left p-3 w-10">Affich.</th>
              <th className="text-left p-3 w-12">Icône</th>
              <th className="text-left p-3 font-medium">Titre</th>
              <th className="text-left p-3 font-medium hidden sm:table-cell">Texte</th>
              <th className="p-3 w-24 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {messages.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-[var(--muted)]">
                  Aucun message. Créez-en un ou exécutez le seed pour en ajouter une dizaine.
                </td>
              </tr>
            ) : (
              messages.map((m) => {
                const IconComponent = getDashboardMessageIcon(m.icon)
                const isChecked = selectedIds.has(m.id)
                const canCheck = isChecked || selectedIds.size < MAX_ACTIVE
                return (
                  <tr key={m.id} className="border-t border-[var(--border)]/60 hover:bg-[var(--border)]/5">
                    <td className="p-3">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={!canCheck}
                          onChange={() => toggleSelect(m.id)}
                          className="rounded border-[var(--border)]"
                        />
                      </label>
                    </td>
                    <td className="p-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                        <IconComponent className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                    </td>
                    <td className="p-3 font-medium text-[var(--foreground)]">{m.title}</td>
                    <td className="p-3 text-[var(--muted)] hidden sm:table-cell max-w-xs truncate">
                      {m.body}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(m)}
                        className="p-2 rounded-lg hover:bg-[var(--border)]/20 text-[var(--muted)] hover:text-[var(--foreground)]"
                        title="Modifier"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMessage(m.id)}
                        className="p-2 rounded-lg hover:bg-red-500/10 text-[var(--muted)] hover:text-red-600"
                        title="Supprimer"
                      >
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

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-[var(--background)] border border-[var(--border)] rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="font-semibold">
                {editingId ? 'Modifier le message' : 'Nouveau message'}
              </h2>
              <button
                type="button"
                onClick={closeForm}
                className="p-2 rounded-lg hover:bg-[var(--border)]/20"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Icône</label>
                <select
                  value={formIcon}
                  onChange={(e) => setFormIcon(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)]"
                >
                  {DASHBOARD_MESSAGE_ICONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Titre</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ex. Factures et avoirs électroniques conformes"
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)]"
                  maxLength={200}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Texte</label>
                <textarea
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  placeholder="Ex. Factur-X / EN16931 — compatibles à 100 %..."
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] min-h-[100px]"
                  maxLength={1000}
                />
              </div>
            </div>
            <div className="p-4 border-t border-[var(--border)] flex justify-end gap-2">
              <button
                type="button"
                onClick={closeForm}
                className="px-4 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--border)]/20"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={saveMessage}
                disabled={saving || !formTitle.trim() || !formBody.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium disabled:opacity-50"
              >
                {saving ? 'Enregistrement…' : editingId ? 'Enregistrer' : 'Créer'}
                <Check className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
