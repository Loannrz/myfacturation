import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendVerificationCodeEmail } from '@/utils/sendVerificationCodeEmail'

const CODE_LENGTH = 6
const CODE_EXPIRY_MINUTES = 15

function generateCode(): string {
  let s = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    s += Math.floor(Math.random() * 10).toString()
  }
  return s
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = (body.email as string)?.toLowerCase()?.trim()

    if (!email) {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      return NextResponse.json({ error: 'Aucun compte avec cet email' }, { status: 404 })
    }
    if (user.emailVerified) {
      return NextResponse.json({ ok: true, message: 'Email déjà vérifié' })
    }

    const code = generateCode()
    const codeExp = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000)

    await prisma.user.update({
      where: { id: user.id },
      data: { verificationCode: code, verificationCodeExp: codeExp },
    })

    const mailResult = await sendVerificationCodeEmail(email, code, CODE_EXPIRY_MINUTES)

    return NextResponse.json({
      ok: true,
      message: mailResult.ok
        ? 'Nouveau code envoyé par email (vérifiez aussi les spams).'
        : 'L’envoi d’email a échoué. Utilisez le code ci-dessous.',
      verificationCode: code,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
