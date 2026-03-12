/**
 * Sauvegarde la base PostgreSQL (DATABASE_URL dans .env.local).
 * Utilise pg_dump — les outils client PostgreSQL doivent être installés.
 * Sauvegardes dans prisma/backups/ ; conserve les 30 derniers dossiers.
 */
const path = require('path')
const fs = require('fs')
const { spawnSync } = require('child_process')

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const dbUrl =
  process.env.DATABASE_URL ||
  process.env.MYFACTURATION_PRISMA_DATABASE_URL ||
  process.env.MYFACTURATION_POSTGRES_URL ||
  process.env.MYFACTURATION_DATABASE_URL

if (!dbUrl || !dbUrl.startsWith('postgres')) {
  console.error('Erreur: DATABASE_URL (PostgreSQL) introuvable dans .env.local')
  process.exit(1)
}

function parsePgUrl(url) {
  const m = url.match(/^postgres(?:ql)?:\/\/([^@]+)@([^/]+)(\/[^?]*)?/)
  if (!m) return null
  const userPart = m[1]
  const hostPart = m[2]
  const pathPart = (m[3] || '/').replace(/^\//, '') || 'postgres'
  const colonIndex = userPart.indexOf(':')
  const user = colonIndex === -1 ? userPart : userPart.slice(0, colonIndex)
  const password = colonIndex === -1 ? '' : userPart.slice(colonIndex + 1)
  const portIndex = hostPart.lastIndexOf(':')
  const host = portIndex === -1 ? hostPart : hostPart.slice(0, portIndex)
  const port = portIndex === -1 ? '5432' : hostPart.slice(portIndex + 1)
  const database = pathPart.split('?')[0] || 'postgres'
  return { user, password, host, port, database }
}

const parsed = parsePgUrl(dbUrl)
if (!parsed) {
  console.error('Erreur: DATABASE_URL invalide')
  process.exit(1)
}

const backupsDir = path.join(__dirname, '..', 'prisma', 'backups')
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true })
}

const now = new Date()
const stamp = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
const filename = `backup_${stamp}.dump`
const filepath = path.join(backupsDir, filename)

const env = { ...process.env }
if (parsed.password) env.PGPASSWORD = parsed.password

// Si le serveur est en PostgreSQL 17 et pg_dump du PATH en 16, définir PG_DUMP_PATH dans .env.local
// ex. PG_DUMP_PATH=/opt/homebrew/opt/postgresql@17/bin/pg_dump (après: brew install postgresql@17)
const pgDump = process.env.PG_DUMP_PATH || 'pg_dump'

const result = spawnSync(
  pgDump,
  [
    '-h', parsed.host,
    '-p', String(parsed.port),
    '-U', parsed.user,
    '-d', parsed.database,
    '-F', 'c',
    '-f', filepath,
  ],
  { env, stdio: 'inherit', cwd: path.join(__dirname, '..') }
)

if (result.status !== 0) {
  console.error('\nÉchec du backup. Vérifiez que pg_dump est installé (client PostgreSQL) et que la base est accessible.')
  process.exit(1)
}

console.log('Backup créé:', filepath)

const KEEP_LAST = 30
try {
  const files = fs.readdirSync(backupsDir)
    .filter((f) => f.startsWith('backup_') && f.endsWith('.dump'))
    .map((f) => ({ name: f, path: path.join(backupsDir, f), mtime: fs.statSync(path.join(backupsDir, f)).mtime }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
  if (files.length > KEEP_LAST) {
    for (let i = KEEP_LAST; i < files.length; i++) {
      fs.unlinkSync(files[i].path)
      console.log('Ancien backup supprimé:', files[i].name)
    }
  }
} catch (e) {
  // ignore cleanup errors
}

process.exit(0)
