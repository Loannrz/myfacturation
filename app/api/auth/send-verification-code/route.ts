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

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const verifyUrl = `${baseUrl}/verify-email?email=${encodeURIComponent(email)}`
    const html = `
      <!DOCTYPE html>
      <html><body style="font-family: sans-serif; padding: 20px;">
        <h2>Nouveau code – Myfacturation</h2>
        <p>Votre code : <strong>${code}</strong></p>
        <p>Expire dans ${CODE_EXPIRY_MINUTES} minutes.</p>
        <p><a href="${verifyUrl}">Entrer le code</a></p>
      </body></html>
    `
    const mailResult = await sendMail({
      to: email,
      subject: 'Votre code de vérification – Myfacturation',
      html,
      action: 'resend-verification',
    })

    // Toujours renvoyer le code pour l'afficher sur la page (au cas où l'email n'arrive pas ou part en spam)
    return NextResponse.json({
      ok: true,
      message: mailResult.ok
        ? 'Nouveau code envoyé par email. S\'il n\'apparaît pas, utilisez le code ci-dessous.'
        : 'Email non configuré ou en erreur. Utilisez le code ci-dessous.',
      verificationCode: code,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
