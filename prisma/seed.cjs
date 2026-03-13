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

  // 4. Messages dashboard (affichés sur le dashboard utilisateur, admin en choisit 0 à 10)
  const existingCount = await prisma.dashboardMessage.count()
  if (existingCount === 0) {
    const defaultMessages = [
      { icon: 'FileCheck', title: 'Factures et avoirs électroniques conformes', body: 'Factur-X / EN16931 — compatibles à 100 % pour les TPE, auto-entrepreneurs, associations et particuliers. Inclus dans toutes les formules.', sortOrder: 0 },
      { icon: 'Shield', title: 'Données sécurisées', body: 'Vos données sont hébergées en France et protégées. Sauvegardes régulières et conformité RGPD.', sortOrder: 1 },
      { icon: 'Zap', title: 'Gain de temps', body: 'Créez devis et factures en quelques clics. Conversion devis → facture en un clic.', sortOrder: 2 },
      { icon: 'BarChart3', title: 'Tableau de bord', body: 'Vue d\'ensemble de votre activité : CA, encaissements, impayés et graphiques par période.', sortOrder: 3 },
      { icon: 'Users', title: 'Multi-utilisateurs (formule Business)', body: 'Ajoutez des employés, gérez les dépenses et le temps par collaborateur.', sortOrder: 4 },
      { icon: 'Building2', title: 'Multi-établissements', body: 'Plusieurs établissements ou sièges : facturation et paramètres par établissement (formules Pro et Business).', sortOrder: 5 },
      { icon: 'Wallet', title: 'Multi comptes bancaires', body: 'Ventilez vos encaissements par compte bancaire pour une comptabilité claire (formules Pro et Business).', sortOrder: 6 },
      { icon: 'FileSpreadsheet', title: 'Exports et comptabilité', body: 'Export comptable, suivi des dépenses et historique d\'activité pour garder la main sur vos chiffres.', sortOrder: 7 },
      { icon: 'Mail', title: 'Envoi par email', body: 'Envoyez devis et factures par email directement depuis l\'application. Suivi des envois.', sortOrder: 8 },
      { icon: 'CheckCircle', title: 'Devis signables en ligne', body: 'Envoyez un lien de signature électronique à vos clients. Recevez le devis signé par email.', sortOrder: 9 },
    ]
    for (const m of defaultMessages) {
      await prisma.dashboardMessage.create({ data: { ...m, isActive: false } })
    }
    // Activer le premier par défaut pour affichage immédiat
    const first = await prisma.dashboardMessage.findFirst({ where: { sortOrder: 0 } })
    if (first) await prisma.dashboardMessage.update({ where: { id: first.id }, data: { isActive: true } })
    console.log('Dashboard messages created (10), 1 active by default')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
