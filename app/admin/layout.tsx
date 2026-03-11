import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { AdminSidebar } from '@/app/admin/AdminSidebar'
import Link from 'next/link'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const admin = await requireAdmin()
  if (!admin) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex">
      <AdminSidebar />
      <main className="flex-1 min-w-0 pt-14 md:pt-0 p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Administration</h1>
          <Link href="/dashboard" className="text-sm text-[var(--muted)] hover:underline">
            Retour à l&apos;app
          </Link>
        </div>
        {children}
      </main>
    </div>
  )
}
