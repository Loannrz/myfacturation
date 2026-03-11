import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { sendVerificationCodeEmail } from '@/utils/sendVerificationCodeEmail'
import { sendWelcomeEmail } from '@/lib/send-transactional-email'

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
    const password = body.password as string
    const name = (body.name as string)?.trim() || null

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 8 caractères' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      if (existing.passwordHash) {
        return NextResponse.json({ error: 'Un compte existe déjà avec cet email' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Cet email est déjà utilisé (connexion Google)' }, { status: 409 })
    }
    const deleted = await prisma.deletedEmail.findUnique({ where: { email } })
    if (deleted) {
      return NextResponse.json({ error: 'Cet email a été supprimé et ne peut pas être réutilisé pour créer un compte.' }, { status: 409 })
    }

    const hash = await bcrypt.hash(password, 12)
    const code = generateCode()
    const codeExp = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000)
    const skipVerification = process.env.SKIP_EMAIL_VERIFICATION === 'true' || process.env.SKIP_EMAIL_VERIFICATION === '1'

    const user = await prisma.user.create({
      data: {
        email,
        name: name || email.split('@')[0],
        passwordHash: hash,
        verificationCode: skipVerification ? null : code,
        verificationCodeExp: skipVerification ? null : codeExp,
        emailVerified: skipVerification ? new Date() : undefined,
        planType: 'free',
      },
    })
    await prisma.systemEvent.create({
      data: { eventType: 'user_signup', userId: user.id, metadata: JSON.stringify({ email: user.email }) },
    }).catch(() => {})

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'
    sendWelcomeEmail(email, {
      recipientName: user.name,
      loginUrl: `${baseUrl.replace(/\/$/, '')}/login`,
    }).catch((err) => console.error('[signup] welcome email', err))

    let message: string
    if (skipVerification) {
      message = 'Compte créé. Vous pouvez vous connecter.'
    } else {
      const mailResult = await sendVerificationCodeEmail(email, code, CODE_EXPIRY_MINUTES)
      message = mailResult.ok
        ? 'Compte créé. Un email avec votre code de vérification a été envoyé (pensez à vérifier les spams).'
        : 'Compte créé. L’envoi d’email a échoué. Réessayez plus tard ou allez sur la page de vérification pour renvoyer le code.'
    }

    return NextResponse.json({
      ok: true,
      message,
      email,
      skipEmailVerification: skipVerification,
    })
  } catch (e) {
    console.error(e)
    const err = e as Error
    const isDbError =
      err?.name === 'PrismaClientInitializationError' ||
      (typeof err?.message === 'string' && err.message.includes("Can't reach database"))
    const message = isDbError
      ? 'La base de données est indisponible. Vérifiez que PostgreSQL est démarré (localhost:5432).'
      : 'Erreur serveur'
    return NextResponse.json({ error: message }, { status: isDbError ? 503 : 500 })
  }
}
