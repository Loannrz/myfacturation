import { NextRequest, NextResponse } from 'next/server'
import { spawnSync } from 'child_process'
import path from 'path'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const CRON_SECRET = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET

function isAuthorized(req: NextRequest): boolean {
  if (!CRON_SECRET) return true
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${CRON_SECRET}`
}

/**
 * Lance la sauvegarde de la BDD (pg_dump → prisma/backups/).
 * À appeler toutes les 6h via Vercel Cron ou un service externe.
 * Nécessite : pg_dump installé, DATABASE_URL, et un système de fichiers inscriptible
 * (sur Vercel serverless ça échouera ; utiliser crontab sur un serveur à la place).
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const projectRoot = process.cwd()
  const scriptPath = path.join(projectRoot, 'scripts', 'backup-db.cjs')

  const result = spawnSync('node', [scriptPath], {
    cwd: projectRoot,
    env: process.env,
    encoding: 'utf8',
    timeout: 100_000,
  })

  if (result.status !== 0) {
    const stderr = result.stderr || result.error?.message || ''
    console.error('backup-db cron:', stderr)
    return NextResponse.json(
      {
        ok: false,
        error: 'Échec du backup',
        details: stderr.slice(0, 500),
        hint: 'Sur Vercel, utilisez plutôt un crontab sur un serveur (voir prisma/README-MIGRATIONS.md).',
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, message: 'Backup créé' })
}

export async function POST(req: NextRequest) {
  return GET(req)
}
