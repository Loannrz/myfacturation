/**
 * Charge .env.local et assure que DATABASE_URL est défini (depuis les variables
 * préfixées Vercel si besoin), puis exécute la commande Prisma passée en arguments.
 */
const path = require('path')
const { spawnSync } = require('child_process')

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const dbUrl =
  process.env.DATABASE_URL ||
  process.env.MYFACTURATION_PRISMA_DATABASE_URL ||
  process.env.MYFACTURATION_POSTGRES_URL ||
  process.env.MYFACTURATION_DATABASE_URL
if (dbUrl) process.env.DATABASE_URL = dbUrl

const prismaBin = path.join(__dirname, '..', 'node_modules', '.bin', 'prisma')
const result = spawnSync(process.execPath, [prismaBin, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
  cwd: path.join(__dirname, '..'),
})
process.exit(result.status ?? 1)
