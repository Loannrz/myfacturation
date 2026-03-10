# Base de données

## Si `npm run db:migrate` échoue (shadow database)

Ta base a probablement été créée avec `db push`. Dans ce cas, **synchronise le schéma** puis lance le seed :

```bash
npm run db:push
npm run db:seed
```

- **db:push** : applique le schéma Prisma actuel à la base (ajoute les colonnes/tables manquantes comme `User.role`, `Plan`, `plan_features`).
- **db:seed** : crée l’utilisateur admin et les plans/permissions.

## Commandes utiles

- `npm run db:push` — synchroniser le schéma sans passer par les migrations
- `npm run db:seed` — exécuter le seed (admin + plans)
- `npm run db:studio` — ouvrir Prisma Studio
