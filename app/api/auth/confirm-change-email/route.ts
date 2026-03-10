import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
    const body = await req.json()
    const code = (body.code as string)?.replace(/\s/g, '')

    if (!code || code.length !== 6) {
      return NextResponse.json({ error: 'Code à 6 chiffres requis' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { newEmailPending: true, newEmailCode: true, newEmailCodeExp: true },
    })
    if (!user?.newEmailPending || !user.newEmailCode || !user.newEmailCodeExp) {
      return NextResponse.json({ error: 'Aucune demande de changement d\'email en cours' }, { status: 400 })
    }
    if (new Date() > user.newEmailCodeExp) {
      return NextResponse.json({ error: 'Le code a expiré. Redemandez un code.' }, { status: 400 })
    }
    if (user.newEmailCode !== code) {
      return NextResponse.json({ error: 'Code incorrect' }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        email: user.newEmailPending,
        emailVerified: new Date(),
        newEmailPending: null,
        newEmailCode: null,
        newEmailCodeExp: null,
      },
    })

    return NextResponse.json({ ok: true, message: 'Adresse email mise à jour.' })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
