// Accepter toute variable d’env Postgres (Vercel : DATABASE_URL ou noms personnalisés)
if (typeof process !== 'undefined' && !process.env.DATABASE_URL?.startsWith('postgres')) {
  const cloud =
    process.env.MYFACTURATION_PRISMA_DATABASE_URL?.startsWith('postgres') ? process.env.MYFACTURATION_PRISMA_DATABASE_URL :
    process.env.MYFACTURATION_POSTGRES_URL?.startsWith('postgres') ? process.env.MYFACTURATION_POSTGRES_URL :
    process.env.MYFACTURATION_DATABASE_URL?.startsWith('postgres') ? process.env.MYFACTURATION_DATABASE_URL :
    process.env.POSTGRES_URL?.startsWith('postgres') ? process.env.POSTGRES_URL :
    process.env.URL_DE_LA_BASE_DE_DONNEES_MYFACTURATION_PRISMA?.startsWith('postgres') ? process.env.URL_DE_LA_BASE_DE_DONNEES_MYFACTURATION_PRISMA :
    process.env.URL_POSTGRES_DE_MON_FACTURATION?.startsWith('postgres') ? process.env.URL_POSTGRES_DE_MON_FACTURATION :
    null
  if (cloud) process.env.DATABASE_URL = cloud
}

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
