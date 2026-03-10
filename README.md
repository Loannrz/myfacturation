# Myfacturation

Application SaaS de facturation pour indépendants et entreprises. Créez devis et factures en quelques secondes.

## Stack

- **Frontend** : Next.js 14 (App Router), React, TailwindCSS
- **Backend** : API Routes Next.js (Node.js)
- **Base de données** : PostgreSQL avec Prisma
- **Authentification** : NextAuth (Google OAuth + email/mot de passe, vérification email par code)

## Démarrage

1. **Cloner et installer les dépendances**

   ```bash
   cd Facturation
   npm install
   ```

2. **Configurer l'environnement**

   Copier `.env.example` vers `.env.local` et renseigner :

   - `DATABASE_URL` : URL PostgreSQL
   - `NEXTAUTH_URL` : URL de l'app (ex. `http://localhost:3000`)
   - `NEXTAUTH_SECRET` : secret pour les sessions (générer une chaîne aléatoire)
   - Optionnel : `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` pour la connexion Google
   - Optionnel : SMTP (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM) pour les emails (vérification, envoi factures/devis)

3. **Initialiser la base**

   ```bash
   npx prisma db push
   # ou pour des migrations : npx prisma migrate dev
   ```

4. **Lancer le serveur**

   ```bash
   npm run dev
   ```

   Ouvrir [http://localhost:3000](http://localhost:3000).

## Fonctionnalités

- **Landing** : page d'accueil avec CTA Créer un compte / Se connecter
- **Auth** : Google OAuth + inscription email/mot de passe avec vérification par code à 6 chiffres
- **Dashboard** : vue d'ensemble (chiffre d'affaires, factures, devis)
- **Factures** : liste, création, PDF, envoi par email, marquer payée, dupliquer
- **Devis** : liste, création, PDF, envoi par email, convertir en facture
- **Clients** : liste, création (particulier / professionnel)
- **Comptabilité** (Premium) : dépenses, export CSV
- **Paramètres** : profil (nom, email), infos facturation (raison sociale, SIRET, adresse, logo)

Chaque utilisateur ne voit que ses propres données (multi-tenant via `userId`).

## Abonnement (préparé)

Les champs `planType`, `subscriptionStatus`, `subscriptionStart`, `subscriptionEnd` sont présents sur le modèle `User` pour une future intégration Stripe. Le plan **gratuit** donne accès aux factures, devis, clients et tableau de bord ; le plan **Premium** débloque la comptabilité et l’export.

## Sécurité

- Sessions JWT (NextAuth)
- Mots de passe hashés (bcrypt)
- Vérification email obligatoire pour les comptes email/password
- Routes protégées (middleware + vérification session dans les API)
- Données isolées par `userId` sur toutes les entités facturation
