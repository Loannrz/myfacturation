import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type DeletedEmailDelegate = {
  findMany: (args?: { orderBy?: { deletedAt: 'desc' } }) => Promise<{ id: string; email: string; deletedAt: Date }[]>
  delete: (args: { where: { email: string } }) => Promise<unknown>
}

/** GET: liste des emails supprimés (comptes dont l'admin a supprimé le compte → réinscription bloquée) */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  try {
    const list = await (prisma as unknown as { deletedEmail: DeletedEmailDelegate }).deletedEmail.findMany({
      orderBy: { deletedAt: 'desc' },
    })
    return NextResponse.json({ emails: list })
  } catch {
    return NextResponse.json({ emails: [] })
  }
}

/** DELETE: autoriser la réutilisation d'un email (retirer de la liste des emails supprimés) */
export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const email = (await req.json().catch(() => ({}))).email ?? (req.nextUrl.searchParams.get('email') ?? '')
  const normalized = String(email).trim().toLowerCase()
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
  }

  try {
    await (prisma as unknown as { deletedEmail: DeletedEmailDelegate }).deletedEmail.delete({
      where: { email: normalized },
    })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2025'
    if (msg) return NextResponse.json({ error: 'Cet email n\'est pas dans la liste.' }, { status: 404 })
    throw e
  }
}
