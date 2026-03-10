import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendResetPasswordCodeEmail } from '@/utils/sendResetPasswordCodeEmail'

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

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: 'Aucun compte avec cet email' }, { status: 404 })
    }

    const code = generateCode()
    const codeExp = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000)

    await prisma.user.update({
      where: { id: user.id },
      data: { resetPasswordCode: code, resetPasswordCodeExp: codeExp },
    })

    const mailResult = await sendResetPasswordCodeEmail(email, code, CODE_EXPIRY_MINUTES)

    return NextResponse.json({
      ok: true,
      message: mailResult.ok
        ? 'Un code a été envoyé à votre adresse email (vérifiez aussi les spams).'
        : 'L’envoi d’email a échoué. Réessayez plus tard.',
      email,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
