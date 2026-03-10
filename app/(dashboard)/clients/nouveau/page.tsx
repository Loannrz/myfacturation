'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function NouveauClientPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [type, setType] = useState<'particulier' | 'professionnel'>('particulier')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [address, setAddress] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          companyName: companyName.trim() || undefined,
          address: address.trim() || undefined,
          postalCode: postalCode.trim() || undefined,
          city: city.trim() || undefined,
        }),
      })
      if (res.ok) {
        const client = await res.json()
        router.push(`/clients?created=${client.id}`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <Link href="/clients" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-black mb-6">
        <ArrowLeft className="w-4 h-4" />
        Retour aux clients
      </Link>
      <h1 className="text-2xl font-semibold text-black mb-6">Nouveau client</h1>

      <form onSubmit={handleSubmit} className="space-y-4 border border-gray-200 rounded-xl p-6 bg-white">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as 'particulier' | 'professionnel')} className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-black">
            <option value="particulier">Particulier</option>
            <option value="professionnel">Professionnel</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Prénom</label>
            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Nom</label>
            <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg" />
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Email *</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg" required />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Téléphone</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg" />
        </div>
        {type === 'professionnel' && (
          <div>
            <label className="block text-sm text-gray-600 mb-1">Raison sociale</label>
            <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg" />
          </div>
        )}
        <div>
          <label className="block text-sm text-gray-600 mb-1">Adresse</label>
          <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Code postal</label>
            <input type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Ville</label>
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg" />
          </div>
        </div>
        <div className="flex gap-4 pt-4">
          <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-black text-white font-medium hover:bg-gray-800 disabled:opacity-50">
            {loading ? 'Création…' : 'Créer le client'}
          </button>
          <Link href="/clients" className="px-4 py-2 rounded-lg border border-gray-300 text-black font-medium hover:bg-gray-50">
            Annuler
          </Link>
        </div>
      </form>
    </div>
  )
}
