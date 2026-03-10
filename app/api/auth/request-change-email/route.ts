import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
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
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
    const body = await req.json()
    const newEmail = (body.newEmail as string)?.toLowerCase()?.trim()

    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    })
    if (!currentUser) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    if (currentUser.email === newEmail) {
      return NextResponse.json({ error: 'Le nouvel email est identique à l\'actuel' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email: newEmail } })
    if (existing) {
      return NextResponse.json({ error: 'Cet email est déjà utilisé par un autre compte' }, { status: 409 })
    }

    const code = generateCode()
    const codeExp = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000)

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        newEmailPending: newEmail,
        newEmailCode: code,
        newEmailCodeExp: codeExp,
      },
    })

    const html = `
      <!DOCTYPE html>
      <html><body style="font-family: sans-serif; padding: 20px;">
        <h2>Changement d'email – Myfacturation</h2>
        <p>Votre code de vérification : <strong>${code}</strong></p>
        <p>Ce code expire dans ${CODE_EXPIRY_MINUTES} minutes.</p>
        <p>Si vous n'avez pas demandé ce changement, ignorez cet email.</p>
      </body></html>
    `
    const mailResult = await sendMail({
      to: newEmail,
      subject: 'Vérifiez votre nouvelle adresse email – Myfacturation',
      html,
    })

    const verificationCode = !mailResult.ok ? code : undefined
    return NextResponse.json({
      ok: true,
      message: mailResult.ok
        ? 'Un code a été envoyé à votre nouvelle adresse email.'
        : 'Utilisez le code affiché dans les paramètres pour confirmer.',
      ...(verificationCode != null && { verificationCode }),
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
