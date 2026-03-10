import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendMail } from '@/lib/smtp'

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

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const resetUrl = `${baseUrl}/forgot-password?email=${encodeURIComponent(email)}&step=2`
    const html = `
      <!DOCTYPE html>
      <html><body style="font-family: sans-serif; padding: 20px;">
        <h2>Réinitialisation du mot de passe – Myfacturation</h2>
        <p>Votre code : <strong>${code}</strong></p>
        <p>Ce code expire dans ${CODE_EXPIRY_MINUTES} minutes.</p>
        <p><a href="${resetUrl}">Réinitialiser mon mot de passe</a></p>
        <p>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
      </body></html>
    `
    const mailResult = await sendMail({
      to: email,
      subject: 'Réinitialisation du mot de passe – Myfacturation',
      html,
    })

    const verificationCode = !mailResult.ok ? code : undefined
    return NextResponse.json({
      ok: true,
      message: mailResult.ok
        ? 'Un code a été envoyé à votre adresse email.'
        : 'Utilisez le code affiché ci-dessous pour réinitialiser votre mot de passe.',
      email,
      ...(verificationCode != null && { verificationCode }),
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
