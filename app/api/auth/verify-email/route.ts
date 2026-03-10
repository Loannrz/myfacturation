import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = (body.email as string)?.toLowerCase()?.trim()
    const code = (body.code as string)?.trim()?.replace(/\s/g, '')

    if (!email || !code) {
      return NextResponse.json({ error: 'Email et code requis' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      return NextResponse.json({ error: 'Compte introuvable' }, { status: 404 })
    }
    if (user.emailVerified) {
      return NextResponse.json({ ok: true, message: 'Email déjà vérifié' })
    }
    if (!user.verificationCode || user.verificationCode !== code) {
      return NextResponse.json({ error: 'Code invalide' }, { status: 400 })
    }
    if (!user.verificationCodeExp || user.verificationCodeExp < new Date()) {
      return NextResponse.json({ error: 'Code expiré. Demandez un nouveau code.' }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        verificationCode: null,
        verificationCodeExp: null,
      },
    })

    return NextResponse.json({ ok: true, message: 'Email vérifié. Vous pouvez vous connecter.' })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
