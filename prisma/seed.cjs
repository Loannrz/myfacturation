const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

const ADMIN_EMAIL = 'noreply@myfacturation360.fr'
const ADMIN_PASSWORD = 'Loul0u2ko5!'

async function main() {
  // 1. Admin user (identifiant noreply@myfacturation360.fr, mot de passe Loul0u2ko5!)
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 10)
  const normalizedEmail = ADMIN_EMAIL.trim().toLowerCase()
  // Trouver l'utilisateur même si l'email en base a une casse différente
  const existing = await prisma.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
  })
  const admin = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          role: 'admin',
          passwordHash: hash,
          name: existing.name || 'Admin',
          email: normalizedEmail,
          subscriptionPlan: 'business',
          planType: 'premium',
          emailVerified: existing.emailVerified || new Date(),
        },
      })
    : await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: 'Admin',
          passwordHash: hash,
          emailVerified: new Date(),
          role: 'admin',
          subscriptionPlan: 'business',
          planType: 'premium',
        },
      })
  console.log('Admin user:', admin.email, 'role:', admin.role)

  // 2. Plans
  const plans = [
    { key: 'starter', name: 'Starter', priceMonthly: 0, priceYearly: 0, description: 'Pour les activités occasionnelles', sortOrder: 0 },
    { key: 'pro', name: 'Pro', priceMonthly: 5, priceYearly: 50, description: 'Pour les freelances et indépendants', sortOrder: 1 },
    { key: 'business', name: 'Business', priceMonthly: 12, priceYearly: 120, description: 'Pour les entreprises et utilisateurs intensifs', sortOrder: 2 },
  ]
  for (const p of plans) {
    await prisma.plan.upsert({
      where: { key: p.key },
      update: { name: p.name, priceMonthly: p.priceMonthly, priceYearly: p.priceYearly, description: p.description, sortOrder: p.sortOrder },
      create: p,
    })
  }
  console.log('Plans created/updated')

  // 3. Plan features (defaults alignés avec lib/subscription.ts)
  const features = [
    { planKey: 'starter', feature: 'factures', enabled: true, limit_: 5 },
    { planKey: 'starter', feature: 'devis', enabled: true, limit_: 5 },
    { planKey: 'starter', feature: 'produits', enabled: false, limit_: null },
    { planKey: 'starter', feature: 'clients', enabled: true, limit_: null },
    { planKey: 'starter', feature: 'avoirs', enabled: false, limit_: null },
    { planKey: 'starter', feature: 'depenses', enabled: false, limit_: null },
    { planKey: 'starter', feature: 'exports', enabled: false, limit_: null },
    { planKey: 'starter', feature: 'multi_comptes_bancaires', enabled: false, limit_: null },
    { planKey: 'starter', feature: 'multi_etablissements', enabled: false, limit_: null },
    { planKey: 'starter', feature: 'historique_activite', enabled: false, limit_: null },
    { planKey: 'starter', feature: 'comptabilite_avancee', enabled: false, limit_: null },
    { planKey: 'starter', feature: 'parametres_avances', enabled: false, limit_: null },
    { planKey: 'pro', feature: 'factures', enabled: true, limit_: null },
    { planKey: 'pro', feature: 'devis', enabled: true, limit_: null },
    { planKey: 'pro', feature: 'produits', enabled: true, limit_: null },
    { planKey: 'pro', feature: 'clients', enabled: true, limit_: null },
    { planKey: 'pro', feature: 'avoirs', enabled: true, limit_: null },
    { planKey: 'pro', feature: 'depenses', enabled: true, limit_: null },
    { planKey: 'pro', feature: 'exports', enabled: false, limit_: null },
    { planKey: 'pro', feature: 'multi_comptes_bancaires', enabled: false, limit_: null },
    { planKey: 'pro', feature: 'multi_etablissements', enabled: false, limit_: null },
    { planKey: 'pro', feature: 'historique_activite', enabled: false, limit_: null },
    { planKey: 'pro', feature: 'comptabilite_avancee', enabled: true, limit_: null },
    { planKey: 'pro', feature: 'parametres_avances', enabled: true, limit_: null },
    { planKey: 'business', feature: 'factures', enabled: true, limit_: null },
    { planKey: 'business', feature: 'devis', enabled: true, limit_: null },
    { planKey: 'business', feature: 'produits', enabled: true, limit_: null },
    { planKey: 'business', feature: 'clients', enabled: true, limit_: null },
    { planKey: 'business', feature: 'avoirs', enabled: true, limit_: null },
    { planKey: 'business', feature: 'depenses', enabled: true, limit_: null },
    { planKey: 'business', feature: 'exports', enabled: true, limit_: null },
    { planKey: 'business', feature: 'multi_comptes_bancaires', enabled: true, limit_: null },
    { planKey: 'business', feature: 'multi_etablissements', enabled: true, limit_: null },
    { planKey: 'business', feature: 'historique_activite', enabled: true, limit_: null },
    { planKey: 'business', feature: 'comptabilite_avancee', enabled: true, limit_: null },
    { planKey: 'business', feature: 'parametres_avances', enabled: true, limit_: null },
  ]
  for (const f of features) {
    await prisma.planFeature.upsert({
      where: { planKey_feature: { planKey: f.planKey, feature: f.feature } },
      update: { enabled: f.enabled, limit_: f.limit_ },
      create: f,
    })
  }
  console.log('Plan features created/updated')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
