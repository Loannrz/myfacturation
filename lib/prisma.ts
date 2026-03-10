// Utiliser la base cloud si DATABASE_URL pointe vers localhost et qu'on a une URL cloud (ex. Vercel)
if (typeof process !== 'undefined') {
  const url = process.env.DATABASE_URL || ''
  const cloud =
    process.env.MYFACTURATION_PRISMA_DATABASE_URL ||
    process.env.MYFACTURATION_POSTGRES_URL ||
    process.env.MYFACTURATION_DATABASE_URL
  if (cloud && (url.includes('localhost') || !url)) {
    process.env.DATABASE_URL = cloud
  } else if (!process.env.DATABASE_URL && cloud) {
    process.env.DATABASE_URL = cloud
  }
}

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
