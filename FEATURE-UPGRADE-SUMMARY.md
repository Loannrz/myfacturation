# Résumé des évolutions — MYfacturation

**Date :** 10 mars 2026  
**Objectif :** Mise à niveau fonctionnelle et conformité pour un logiciel de facturation et comptabilité professionnel.

---

## 1. Paramètres / Société (Company settings)

### Nouveaux champs et sections

- **Logo :** URL du logo affichée sur les documents (section « Logo et présentation »).
- **Établissements (émetteur) :** pour chaque établissement :
  - **Pays**
  - **Code APE / NAF** (optionnel)
- **Numérotation :** préfixes personnalisables :
  - **Préfixe facture** (défaut : F) → ex. F-2026-0001
  - **Préfixe devis** (défaut : D) → ex. D-2026-0001
  - **Préfixe avoir** (défaut : A) → ex. A-2026-0001
- **Paiement par défaut :**
  - Mode de paiement par défaut (ex. Virement bancaire, Chèque)
  - Conditions de paiement (ex. 30 jours, 45 jours)
- **Mentions légales (documents) :**
  - Texte des **pénalités de retard** (vide = texte légal par défaut)
  - Texte de l’**indemnité forfaitaire de recouvrement** (vide = 40 €, article L. 441-10)

Les coordonnées bancaires (titulaire, banque, IBAN, BIC) et les établissements existants sont inchangés et restent utilisés sur les factures.

---

## 2. Base de données (BillingSettings)

- **Schéma Prisma :** ajout des champs  
  `apeCode`, `country`, `invoicePrefix`, `quotePrefix`, `creditNotePrefix`,  
  `defaultPaymentMethod`, `defaultPaymentTerms`, `legalPenaltiesText`, `legalRecoveryFeeText`.
- **Migration :** `prisma/migrations/20250310200000_billing_settings_upgrade/migration.sql`  
  À appliquer avec : `npm run db:migrate:deploy` (ou équivalent avec votre env).

---

## 3. PDF (documents)

- **Référence au devis sur la facture :** si la facture est issue d’un devis, le PDF affiche  
  « Réf. devis : D-2026-0001 du 01/03/2026 » (au-dessus du tableau des lignes).
- **Mentions légales :** les textes de pénalités de retard et d’indemnité forfaitaire sont lus depuis les paramètres ; si vides, les textes légaux par défaut sont utilisés.
- **Émetteur :** affichage du **pays** et du **code APE** (quand renseignés) en en-tête et dans le bloc Émetteur.

---

## 4. Factures

- **Statuts :** draft, sent, paid, pending, **late** (en retard), cancelled.  
  Le statut « late » est appliqué automatiquement lorsque la date d’échéance est dépassée.
- **Date de paiement :**  
  - Enregistrée automatiquement lorsque le statut passe à « Payée ».  
  - **Modifiable manuellement** dans la page « Modifier la facture » : champ « Date de paiement » affiché lorsque le statut est « Payée ».
- **API PUT :** accepte `paidAt` (date ISO) pour définir ou corriger la date de paiement.

---

## 5. Devis

- **Statuts :** draft, sent, signed, expired.
- **Passage en « Signé » :** création automatique d’une facture à partir du devis (déjà en place).
- **Référence sur la facture :** la facture générée est liée au devis et le PDF facture affiche la référence au devis (voir § 3).

---

## 6. Avoirs (credit notes)

- Référence à la facture d’origine (optionnelle mais validée si fournie).
- Réduction du revenu dans la comptabilité (overview, exports, journal).
- Numéro, date, motif (reason) déjà gérés.

---

## 7. Produits / services

- Catalogue produits (BillingProduct) : nom, description, prix, TVA, type (service / produit).
- Lors de la création ou modification d’une facture, possibilité d’**ajouter un produit** (liste déroulante « + Ajouter un produit ») ; les lignes sont remplies automatiquement.

---

## 8. Clients

- Champs déjà présents : prénom, nom, raison sociale, email, téléphone, adresse, code postal, ville, pays, SIRET, n° TVA.
- L’historique (factures, devis) est disponible via les listes factures/devis filtrées par client (et les liens depuis les fiches).

---

## 9. Comptabilité

- **Revenu :** somme des factures payées (période ou année).
- **Revenu net :** revenu − avoirs.
- **Résultat / profit :** revenu net − dépenses.
- Les avoirs réduisent bien le revenu dans les vues et exports.

---

## 10. Dashboard

- Cartes et graphiques existants : CA (chiffre d’affaires), factures payées / en attente, retard de paiement, devis, avoirs.
- Filtres : année, mois, plage de dates.

---

## 11. Activité (logs)

- Types d’entités : Factures, Devis, **Avoirs**, Clients, Sociétés, Dépenses.
- Filtres : type, date (du / au).
- Les actions (création, mise à jour, paiement, envoi, suppression, etc.) sont enregistrées et affichées.

---

## 12. Exports

- Export comptable (CSV, Excel, rapport) : factures, dépenses, avoirs, résumé revenus (déjà en place).

---

## 13. Recherche globale

- **API GET `/api/search?q=...&type=all|invoice|quote|client`**  
  Recherche dans :
  - numéro de facture (et montant si la requête est un nombre),
  - numéro de devis,
  - nom / prénom / raison sociale / email du client.
- Réponse : listes `invoices`, `quotes`, `clients` (ids et champs utiles pour affichage et liens).

---

## 14. Notifications internes

- **API GET `/api/notifications`** (réservée aux utilisateurs connectés)  
  Retourne :
  - **overdueInvoices :** factures en retard (échéance dépassée),
  - **expiringQuotes :** devis dont l’échéance est dans les 7 jours,
  - **recentExpenses :** 5 dernières dépenses,
  - **count :** nombre total (factures en retard + devis à échéance proche).

Vous pouvez consommer cette API dans le front (ex. indicateur ou page « Notifications »).

---

## 15. Sécurité

- Toutes les routes métier sont protégées par **requireSession()** et filtrage par **userId**.
- Mots de passe hashés (bcrypt), session JWT, Google OAuth optionnel.
- Chaque utilisateur n’accède qu’à ses propres données (multi-tenant).

---

## 16. Vérifications finales

- **Factures → Comptabilité :** les factures payées alimentent le revenu (stats, comptabilité, exports).
- **Avoirs :** réduisent le revenu dans tous les calculs.
- **Dépenses :** réduisent le résultat (profit) dans la vue Comptabilité.
- **Devis :** pris en compte dans les statistiques du dashboard (nombre, signés).
- **Liens entre modules :** facture liée au devis, avoir lié à la facture, produits sélectionnables sur les factures.

---

## Fichiers modifiés / ajoutés (principaux)

| Fichier | Modification |
|--------|---------------|
| `prisma/schema.prisma` | Champs BillingSettings (apeCode, country, préfixes, paiement, légal) |
| `prisma/migrations/20250310200000_.../migration.sql` | Nouvelle migration |
| `lib/billing-settings.ts` | Préfixes configurables, updateBillingSettings étendu, EmitterProfileEntry (apeCode, country) |
| `lib/billing-pdf.ts` | Mentions légales depuis paramètres, pays/APE émetteur, référence devis sur facture |
| `app/api/settings/route.ts` | GET/PUT avec les nouveaux champs |
| `app/(dashboard)/parametres/page.tsx` | Sections Logo, Numérotation (préfixes), Paiement, Mentions légales ; APE/Pays par établissement |
| `app/api/invoices/[id]/route.ts` | Gestion de `paidAt` (saisie manuelle, réinitialisation si non payée) |
| `app/(dashboard)/factures/[id]/modifier/page.tsx` | Champ « Date de paiement » lorsque statut = Payée |
| `app/(dashboard)/activite/page.tsx` | Filtre et icône « Avoirs » (credit_note) |
| `app/api/search/route.ts` | **Nouveau** — recherche globale |
| `app/api/notifications/route.ts` | **Nouveau** — factures en retard, devis à échéance, dépenses récentes |

---

## Utilisation recommandée après déploiement

1. **Appliquer la migration** (nouveaux champs BillingSettings).
2. **Paramètres :** renseigner au moins un établissement (raison sociale, SIRET, adresse, ville, pays, APE si besoin), un compte bancaire, et éventuellement logo, paiement par défaut et textes légaux.
3. **Factures :** utiliser le statut « Payée » et, si besoin, corriger la « Date de paiement » en édition.
4. **Recherche :** intégrer l’appel à `GET /api/search?q=...` dans une barre de recherche ou une page dédiée.
5. **Notifications :** utiliser `GET /api/notifications` pour afficher un bandeau ou une page « Alertes » (factures en retard, devis à échéance).

MYfacturation est à jour avec des paramètres société complets, des mentions légales configurables, une date de paiement modifiable, une référence devis sur les factures, une recherche globale et des notifications internes, tout en restant multi-tenant et conforme aux usages professionnels de facturation en France.
