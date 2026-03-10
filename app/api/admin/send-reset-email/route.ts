import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendMail } from '@/lib/smtp'

const CODE_LENGTH = 6
const CODE_EXPIRY_MINUTES = 15

function generateCode(): string {
  let s = ''
  for (let i = 0; i < CODE_LENGTH; i++) s += Math.floor(Math.random() * 10).toString()
  return s
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const body = await req.json()
  const userId = body.userId as string | undefined
  const email = (body.email as string)?.toLowerCase()?.trim()

  const user = userId
    ? await prisma.user.findFirst({ where: { id: userId, role: 'user' } })
    : email
      ? await prisma.user.findUnique({ where: { email } })
      : null

  if (!user || !user.email) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
  if (!user.passwordHash) return NextResponse.json({ error: 'Ce compte n\'a pas de mot de passe (connexion OAuth)' }, { status: 400 })

  const code = generateCode()
  const codeExp = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000)
  await prisma.user.update({
    where: { id: user.id },
    data: { resetPasswordCode: code, resetPasswordCodeExp: codeExp },
  })

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const resetUrl = `${baseUrl}/forgot-password?email=${encodeURIComponent(user.email)}&step=2`
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
  await sendMail({
    to: user.email,
    subject: 'Réinitialisation du mot de passe – Myfacturation',
    html,
  })

  return NextResponse.json({ ok: true, message: 'Email envoyé.', email: user.email })
}
