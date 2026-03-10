import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
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

    const hash = await bcrypt.hash(password, 12)
    const code = generateCode()
    const codeExp = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000)

    const user = await prisma.user.create({
      data: {
        email,
        name: name || email.split('@')[0],
        passwordHash: hash,
        verificationCode: code,
        verificationCodeExp: codeExp,
        planType: 'free',
      },
    })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const verifyUrl = `${baseUrl}/verify-email?email=${encodeURIComponent(email)}`
    const html = `
      <!DOCTYPE html>
      <html><body style="font-family: sans-serif; padding: 20px;">
        <h2>Vérification de votre email – Myfacturation</h2>
        <p>Votre code de vérification : <strong>${code}</strong></p>
        <p>Ce code expire dans ${CODE_EXPIRY_MINUTES} minutes.</p>
        <p>Vous pouvez aussi <a href="${verifyUrl}">cliquer ici</a> pour entrer le code sur le site.</p>
        <p>Si vous n'avez pas créé de compte, ignorez cet email.</p>
      </body></html>
    `
    const mailResult = await sendMail({
      to: email,
      subject: 'Vérifiez votre email – Myfacturation',
      html,
      action: 'signup-verification',
    })

    // Si l'email n'a pas été envoyé (SMTP non configuré ou erreur), on renvoie le code dans la réponse
    // pour que l'utilisateur puisse quand même vérifier son compte (affiché sur la page de succès).
    const verificationCode = !mailResult.ok ? code : undefined

    return NextResponse.json({
      ok: true,
      message: mailResult.ok
        ? 'Compte créé. Vérifiez votre email pour le code de vérification (et les spams).'
        : 'Compte créé. Utilisez le code ci-dessous pour vérifier votre email.',
      email,
      ...(verificationCode != null && { verificationCode }),
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
