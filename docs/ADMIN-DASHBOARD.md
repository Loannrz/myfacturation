# Dashboard Admin — Données et métriques

## Vue d'ensemble

Le dashboard admin (`/admin`) agrège les données depuis :

- **Prisma** (BDD) : `User`, `Invoice`, `Quote`, `Client`, `ActivityLog`, `SystemEvent`, `EmailLog`, `Plan`
- **API existantes** : `GET /api/admin/subscriptions`, `GET /api/admin/users`

L’endpoint principal est **`GET /api/admin/dashboard`** qui renvoie en une fois : statistiques principales, graphiques, activité récente, stats produit, emails envoyés, alertes, rapport global, paiements récents.

---

## Comment les données sont calculées

### Section 1 — Statistiques principales

| Métrique | Source | Calcul |
|--------|--------|--------|
| Total utilisateurs | `User` | `count(role = 'user')` |
| Actifs aujourd'hui | `User` | `count(updatedAt >= début du jour)` |
| Nouveaux ce mois | `User` | `count(createdAt >= 1er du mois)` |
| En essai gratuit | `User` | `count(subscriptionStatus = 'trialing')` |
| Abonnements actifs | `User` | `count(plan in [pro, business] ET status in [active, trialing])` |
| MRR | `User` + `Plan` | Somme (nb users par plan × prix mensuel du plan) |
| Revenu total | Idem | Même base que MRR (pas d’historique Stripe en BDD) |
| Paiements réussis | `SystemEvent` | `count(eventType = 'payment_success')` |
| Annulations | `User` | `count(subscriptionStatus = 'cancelled')` |
| Conversion essai → abo | Calcul | `(abonnements actifs / max(hasUsedTrial, 1)) * 100` |

### Section 2 — Graphiques

- **Inscriptions par jour** : `User.createdAt` sur les 30 derniers jours, groupé par jour.
- **Inscriptions par mois** : `User.createdAt`, groupé par mois.
- **Répartition des plans** : `User.subscriptionPlan` (Starter / Pro / Business).
- **Paiements réussis vs échoués** : `SystemEvent` avec `eventType` `payment_success` / `payment_failed`.

### Section 3 — Activité récente

- **SystemEvent** : événements Stripe (inscription, abonnement démarré/annulé, paiement réussi/échoué), enregistrés par le webhook et la route signup.
- **ActivityLog** : actions utilisateur (facture/devis/client créé, envoyé, payé, etc.).
- Les deux sont fusionnés, triés par date décroissante, et renvoyés sous forme de liste « Activité récente ».

### Section 4 — Emails envoyés

- **EmailLog** : chaque envoi transactionnel (bienvenue, essai, paiement, annulation, récap hebdo) est enregistré dans `lib/email-log.ts` après un envoi réussi dans `lib/send-transactional-email.ts`.
- Champs stockés : type, destinataire, sujet, aperçu, contenu complet (optionnel), date.

### Section 5 — Abonnements

- Données fournies par **`GET /api/admin/subscriptions`** (liste des users avec plan, statut, dates).
- Filtres côté client : Tous / Essai / Actifs / Annulés.

### Section 6 — Utilisateurs

- Données fournies par **`GET /api/admin/users`** (liste paginée avec plan, dates, compteurs factures/devis/clients).
- Liens : profil utilisateur (`/admin/users/[id]`), envoi d’email (`/admin/emails`).

### Section 7 — Paiements

- **recentPayments** : `SystemEvent` avec `eventType in ['payment_success', 'payment_failed']`, avec jointure utilisateur et montant (depuis `metadata` JSON).
- Les montants viennent du webhook Stripe (`invoice.amount_paid` / `amount_due`), stockés en centimes dans `metadata`.

### Section 8 — Statistiques produit

- **Factures / devis / clients** : `count(Invoice)`, `count(Quote)`, `count(Client)`.
- **Factures envoyées aujourd’hui** : `Invoice` avec `status in ['sent', 'paid']` et `updatedAt` aujourd’hui.
- **Documents ce mois** : factures + devis créés ce mois (`createdAt >= 1er du mois`).

### Section 9 — Alertes

- **Paiements échoués** : `count(SystemEvent où eventType = 'payment_failed') > 0`.
- **Churn élevé** : `churnRate >= 10` (annulations / total users).
- **Pic d’inscriptions** : nouveaux ce mois > 20 et nouveaux le mois dernier < 10.

### Section 10 — Rapport global

- **MRR** : comme en section 1.
- **Croissance utilisateurs** : `(nouveaux ce mois - nouveaux mois dernier) / max(nouveaux mois dernier, 1) * 100`.
- **Croissance revenus** : réutilise la même logique (pour l’instant pas d’historique revenus par mois).
- **Churn rate** : `(count(subscriptionStatus = 'cancelled') / totalUsers) * 100`.

---

## Comment ajouter de nouvelles métriques

### 1. Nouvelle statistique simple (ex. nombre de devis signés)

- Dans **`app/api/admin/dashboard/route.ts`** :
  - Ajouter une requête Prisma (ex. `prisma.quote.count({ where: { status: 'signed' } })`).
  - Mettre le résultat dans l’objet renvoyé (ex. `mainStats.quotesSigned`).
- Dans **`app/admin/page.tsx`** :
  - Afficher la valeur dans la section voulue (ex. une carte « Devis signés » ou dans les stats produit).

### 2. Nouveau type d’événement (ex. « devis converti en facture »)

- Créer un **SystemEvent** au moment de l’action (ex. dans la route qui convertit un devis en facture) :
  ```ts
  await prisma.systemEvent.create({
    data: {
      eventType: 'quote_converted',
      userId: session.id,
      metadata: JSON.stringify({ quoteId, invoiceId }),
    },
  })
  ```
- Dans le dashboard :
  - Les événements sont déjà listés dans `recentActivity` (fusion de `SystemEvent` et `ActivityLog`).
  - Ajouter un libellé dans `EVENT_LABELS` dans `app/admin/page.tsx` pour l’affichage (ex. `quote_converted: 'Devis converti en facture'`).

### 3. Nouveau graphique (ex. factures payées par mois)

- Dans **`app/api/admin/dashboard/route.ts`** :
  - Ajouter une requête (ex. `Invoice` avec `status = 'paid'`, groupé par mois via `createdAt` ou `paidAt`).
  - Exposer le tableau dans la réponse (ex. `charts.invoicesPaidByMonth`).
- Dans **`app/admin/page.tsx`** :
  - Utiliser Recharts (ex. `LineChart` / `BarChart`) avec ces données, comme pour les autres graphiques.

### 4. Nouvelle alerte

- Dans **`app/api/admin/dashboard/route.ts`**, section `alerts` :
  - Calculer la condition (ex. `trialEndingSoonCount > 5`).
  - Pousser un objet `{ type: 'trial_ending', message: '…', count: … }` dans le tableau `alerts`.
- L’UI affiche déjà la section « Alertes » si `alerts.length > 0`.

### 5. Données Stripe non stockées en BDD

- Pour des métriques basées sur l’API Stripe (ex. revenu réel par mois, liste des charges) :
  - Soit appeler Stripe dans **`app/api/admin/dashboard/route.ts`** (ex. `stripe.invoices.list`, `stripe.charges.list`) et formater les données pour le dashboard.
  - Soit enregistrer les événements pertinents en BDD (ex. dans `SystemEvent` ou une table dédiée) depuis le webhook Stripe, puis les utiliser comme les autres métriques.

---

## Modèles utilisés

- **SystemEvent** : `eventType`, `userId?`, `metadata?`, `createdAt`. Rempli par le webhook Stripe et la route signup.
- **EmailLog** : `emailType`, `recipient`, `subject`, `bodyPreview?`, `bodyFull?`, `userId?`, `createdAt`. Rempli par `lib/email-log.ts` après envoi dans `lib/send-transactional-email.ts`.

Après ajout de champs ou de tables, exécuter :

```bash
npx prisma migrate dev   # ou db push
```
