# Rapport d'audit — MYfacturation

**Date :** 10 mars 2026  
**Objectif :** Vérifier la solidité technique, la sécurité et la conformité légale française de l'application de facturation SaaS.

---

## 1. Architecture et structure du code

### Constat
- **Séparation frontend/backend :** Next.js App Router avec `app/api` pour les routes API et `app/(dashboard)` pour l’UI ; séparation claire.
- **Routes API :** Chaque ressource (invoices, quotes, credit-notes, clients, companies, expenses, etc.) dispose de routes GET/POST/PUT/PATCH/DELETE cohérentes.
- **Requêtes base de données :** Utilisation de Prisma (requêtes paramétrées, pas de concaténation SQL brute) → pas de risque d’injection SQL.
- **Composants réutilisables :** Composants partagés dans `app/(dashboard)/_components/` (ex. `InvoiceQuotePreview`), logique commune dans `lib/` (billing-pdf, billing-settings, billing-utils).

### Actions réalisées
- Aucune refactorisation majeure nécessaire. L’architecture est saine.

---

## 2. Multi-tenant (SaaS)

### Constat
- Toutes les entités métier (Invoice, Quote, CreditNote, Client, Company, Expense, etc.) ont un champ **userId** et sont filtrées par `session.id` dans les API.
- Chaque route métier appelle **requireSession()** puis utilise **userId: session.id** dans les `where` Prisma.
- Aucune route ne charge une ressource par `id` sans filtrer par `userId`.

### Actions réalisées
- Vérification systématique des routes API : aucune fuite de données inter-utilisateurs détectée.
- **Middleware :** Extension du matcher pour protéger **/avoirs**, **/produits**, **/creer**, **/activite** (auparavant protégés uniquement par le layout dashboard).

---

## 3. Conformité légale des factures (France)

### Éléments obligatoires vérifiés
| Élément | Présent | Emplacement |
|--------|---------|-------------|
| Numéro de facture | Oui | PDF + base |
| Date d’émission | Oui | PDF (date d’émission) |
| Identité client | Oui | Bloc Destinataire (nom / raison sociale, adresse) |
| Adresse client | Oui | Bloc Destinataire |
| Identité émetteur | Oui | Bloc Émetteur (raison sociale, statut juridique, adresse) |
| Adresse émetteur | Oui | Bloc Émetteur |
| SIRET | Oui | Émetteur + Destinataire si renseigné |
| Description des prestations | Oui | Tableau des lignes (description, qté, PU, total) |
| Prix unitaire HT | Oui | Colonne P.U. HT |
| Quantité | Oui | Colonne Qté |
| Total HT | Oui | Total HT |
| Total TTC | Oui | Total TTC |

### Micro-entrepreneur (TVA non applicable)
- **Mention :** « TVA non applicable, article 293 B du CGI » affichée dans le PDF lorsque `tvaNonApplicable` est coché (conditions de règlement + pied de page).

### Clauses obligatoires
- **Pénalités de retard :** « Pénalités de retard exigibles en cas de non-paiement à la date d’échéance. Taux appliqué : taux légal en vigueur. » (présente dans `lib/billing-pdf.ts`).
- **Indemnité forfaitaire de recouvrement :** « Indemnité forfaitaire pour frais de recouvrement : 40 € (article L. 441-10 du Code de commerce). » (présente dans le PDF).

Aucune modification nécessaire sur le PDF pour la conformité légale.

---

## 4. Numérotation des documents

### Constat
- **Format :** Géré dans `lib/billing-settings.ts` avec préfixes **F-** (facture), **D-** (devis), **A-** (avoir).
- **Unicité :** Contrainte Prisma `@@unique([userId, number])` + incrément de `nextInvoiceNumber` / `nextQuoteNumber` / `nextCreditNoteNumber` dans `BillingSettings`.
- **Séquentiel et chronologique :** Formats possibles `sequential`, `ddmm_seq`, `year_seq`.

### Actions réalisées
- **Nouveaux comptes :** Lors de la création des `BillingSettings`, le format par défaut est désormais **year_seq** pour factures, devis et avoirs. Les numéros prennent la forme **F-2026-0001**, **D-2026-0001**, **A-2026-0001** (année + séquence sur 4 chiffres). Les comptes existants conservent leur configuration actuelle.

---

## 5. Workflow devis

### Statuts
- **draft**, **sent**, **signed**, **expired** sont gérés (schéma et API PATCH).

### Création automatique de la facture au passage en « signé »
- **Avant :** La facture n’était créée que via l’action explicite « Créer facture » (route `convert-to-invoice`).
- **Après :** Lorsqu’un devis passe en statut **signed** (PATCH `/api/quotes/[id]` avec `status: 'signed'`), une facture est **créée automatiquement** si aucune facture liée à ce devis n’existe encore. L’utilisateur est redirigé vers la fiche de la facture créée.

---

## 6. Avoirs (credit notes)

### Constat
- Référence à une facture : champ **invoiceId** (optionnel en base) ; le PDF affiche « Facture d’origine : [numéro] » lorsque l’avoir est lié à une facture.
- Comptabilité : dans `comptabilite/overview` et `comptabilite/transactions`, le revenu net = factures payées − avoirs (et les avoirs sont bien pris en compte dans les exports et le journal).

### Actions réalisées
- **Validation :** Lors de la création d’un avoir (POST `/api/credit-notes`), si **invoiceId** est fourni, vérification que la facture existe et appartient à l’utilisateur. Sinon, retour 400 « Facture introuvable ou non autorisée ».

---

## 7. Calculs comptables

### Vérification
- **Revenu (factures payées) :** Somme des `totalTTC` des factures avec `status: 'paid'` et `paidAt` dans la période.
- **Revenu net :** Revenu − montants des avoirs (période ou global selon l’API).
- **Résultat / profit :** Revenu net − dépenses (expenses) sur la période.

Les formules dans `comptabilite/overview/route.ts` et les exports sont cohérents. Aucune correction nécessaire.

---

## 8. Sécurité

### Authentification
- **Mot de passe :** Hash bcrypt (12 rounds) à l’inscription (`auth/signup`).
- **Session :** NextAuth en stratégie JWT, `maxAge: 7 jours`.
- **Vérification email :** Compte email/password refusé tant que l’email n’est pas vérifié (CredentialsProvider dans `auth-options.ts`).
- **Google OAuth :** Optionnel, scope `openid email profile` ; compte existant non vérifié mis à jour avec `emailVerified` lors de la première connexion Google.

### Protection des routes
- **Middleware :** Toutes les routes métier (dashboard, factures, devis, avoirs, clients, produits, créer, activité, comptabilité, paramètres) sont protégées par `withAuth` (redirection vers `/login` si non connecté).
- **API :** Les routes métier utilisent **requireSession()** et retournent 401 si non authentifié. Les routes Comptabilité / Dépenses vérifient en plus **canAccessFeature(..., 'accounting')** (403 si plan non premium).

Aucune route admin ou métier n’est exposée sans contrôle d’authentification.

---

## 9. Emails (devis / factures)

### Constat
- **Facture :** Route `invoices/[id]/send-email` génère le PDF, appelle `sendMail` avec pièce jointe PDF, template HTML depuis `lib/billing-email-template.ts` (données dynamiques : numéro, montant, date d’échéance, nom client, etc.).
- **Devis :** Même principe pour `quotes/[id]/send-email`.
- **Sécurité :** L’entité (facture/devis) est chargée avec `where: { id, userId: session.id }` avant envoi.

Aucune modification nécessaire.

---

## 10. Génération PDF

### Constat
- **Contenu :** Logo (si configuré), identité émetteur (profil ou paramètres), destinataire, tableau des lignes (description, qté, PU HT, remise, TVA %, total), totaux HT / TVA / TTC, conditions de règlement, coordonnées bancaires (si virement), mentions légales (TVA 293 B si applicable, pénalités de retard, indemnité 40 €).
- **Layout :** pdf-lib, marges et mise en page stables, pagination si nombreuses lignes.

Aucune modification nécessaire pour la conformité ou la stabilité d’impression.

---

## 11. Gestion des erreurs et validation

### Constat
- Les routes API utilisent des `try/catch` et retournent des messages d’erreur explicites (400, 401, 403, 404, 500).
- Les entrées sont normalisées (trim, Number(), tableaux vérifiés). Pas de validation stricte type schéma Zod sur toutes les routes.

### Recommandation
- Pour aller plus loin : ajouter une couche de validation (ex. Zod) sur les body JSON des POST/PUT/PATCH pour les routes critiques (factures, devis, avoirs, clients) afin de rejeter les champs manquants ou invalides de façon uniforme.

Aucune correction bloquante appliquée ; le comportement actuel évite déjà les crashs grâce aux valeurs par défaut et aux contrôles existants.

---

## 12. Performance et indexation

### Constat
- Prisma : index sur **userId** pour les modèles métier (Invoice, Quote, CreditNote, Client, Company, Expense, ActivityLog, etc.).
- Les listes (factures, devis, avoirs, clients, dépenses) sont chargées avec `findMany` + `where` + `orderBy` ; pas de N+1 évident grâce aux `include` maîtrisés.

### Recommandation
- Pour de très gros volumes : envisager des index composites (ex. `(userId, paidAt)` pour les factures, `(userId, issueDate)` pour les avoirs) pour les rapports comptables par période. Non implémenté dans cet audit pour éviter des migrations non demandées.

---

## 13. Logging et page Activité

### Constat
- **lib/billing-activity.ts :** `logBillingActivity(userId, action, entityType, entityId?, metadata?)` enregistre dans **ActivityLog**.
- **Actions déjà tracées :** création/mise à jour/suppression/paiement/envoi pour factures, devis, avoirs ; création/mise à jour/suppression pour clients, sociétés, dépenses ; conversion devis → facture.

### Actions réalisées
- Ajout du log **« expense updated »** lors de la modification d’une dépense (PUT `/api/expenses/[id]`).
- La création automatique de facture lors du passage en « signé » est loguée via les appels existants (« invoice created », « quote status updated »).

La page Activité affiche bien les logs filtrés par `userId`.

---

## 14. Synthèse des corrections appliquées

| # | Sujet | Correction |
|---|--------|------------|
| 1 | Middleware | Extension du matcher à `/avoirs`, `/produits`, `/creer`, `/activite`. |
| 2 | Numérotation | Format par défaut **year_seq** pour les nouveaux comptes (F-YYYY-NNNN, D-YYYY-NNNN, A-YYYY-NNNN). |
| 3 | Devis → facture | Passage d’un devis en « signé » (PATCH) crée automatiquement une facture si aucune n’existe ; redirection vers la facture créée. |
| 4 | Avoirs | Validation de **invoiceId** à la création : la facture doit exister et appartenir à l’utilisateur. |
| 5 | Logging | Log « expense updated » ajouté pour la modification des dépenses. |

---

## 15. État final

- **Architecture :** Propre, séparation claire, API et Prisma utilisés correctement.
- **Multi-tenant :** Toutes les requêtes sont filtrées par **userId** ; middleware étendu ; pas de fuite de données identifiée.
- **Légalité France :** Factures et PDF conformes (numéro, dates, identités, adresses, SIRET, description, PU, qté, totaux HT/TTC, TVA 293 B si applicable, pénalités de retard, indemnité 40 €).
- **Numérotation :** Unicité et séquence par utilisateur ; format chronologique par défaut pour les nouveaux comptes.
- **Workflow devis :** Statuts draft/sent/signed/expired ; création automatique de la facture au passage en « signé ».
- **Avoirs :** Référence facture optionnelle mais validée si fournie ; impact correct sur le revenu net et les exports.
- **Comptabilité :** Revenu, revenu net et profit cohérents avec les factures payées, avoirs et dépenses.
- **Sécurité :** Bcrypt, JWT, protection des routes et des API ; pas de route sensible sans authentification.
- **Emails et PDF :** Envoi avec pièce jointe et contenu dynamique ; PDF complets et conformes.
- **Logging :** Actions importantes (création facture/devis/avoir, paiement, envoi, conversion, mise à jour dépense, etc.) enregistrées et visibles sur la page Activité.

L’application MYfacturation est **robuste, sécurisée et conforme** aux exigences légales françaises pour un usage en production, sous réserve des bonnes pratiques opérationnelles (sauvegardes, RGPD, politique de rétention des logs, etc.).
