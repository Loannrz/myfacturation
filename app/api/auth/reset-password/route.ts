import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = (body.email as string)?.toLowerCase()?.trim()
    const code = (body.code as string)?.replace(/\s/g, '')
    const newPassword = body.newPassword as string

    if (!email || !code || code.length !== 6) {
      return NextResponse.json({ error: 'Email et code à 6 chiffres requis' }, { status: 400 })
    }
    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json({ error: 'Le nouveau mot de passe doit contenir au moins 8 caractères' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.resetPasswordCode || !user.resetPasswordCodeExp) {
      return NextResponse.json({ error: 'Code invalide ou expiré' }, { status: 400 })
    }
    if (new Date() > user.resetPasswordCodeExp) {
      return NextResponse.json({ error: 'Le code a expiré. Demandez-en un nouveau.' }, { status: 400 })
    }
    if (user.resetPasswordCode !== code) {
      return NextResponse.json({ error: 'Code incorrect' }, { status: 400 })
    }

    const hash = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hash,
        resetPasswordCode: null,
        resetPasswordCodeExp: null,
      },
    })

    return NextResponse.json({ ok: true, message: 'Mot de passe mis à jour. Vous pouvez vous connecter.' })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
