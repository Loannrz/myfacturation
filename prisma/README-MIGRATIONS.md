# Base de données

## Si `npm run db:migrate` échoue (shadow database)

Ta base a probablement été créée avec `db push`. Dans ce cas, **synchronise le schéma** puis lance le seed :

```bash
npm run db:push
npm run db:seed
```

- **db:push** : applique le schéma Prisma actuel à la base (ajoute les colonnes/tables manquantes comme `User.role`, `Plan`, `plan_features`).
- **db:seed** : crée l’utilisateur admin et les plans/permissions.

## Sauvegardes

Une **sauvegarde automatique** est créée avant chaque `db:push` et `db:migrate`. Les fichiers sont dans `prisma/backups/` (les 30 derniers sont conservés).

Si tu as l’erreur *server version mismatch* (serveur PostgreSQL 17, pg_dump en 16) : installe le client 17 puis indique son chemin dans `.env.local` :
```bash
brew install postgresql@17
```
Puis dans `.env.local` :
```
PG_DUMP_PATH=/opt/homebrew/opt/postgresql@17/bin/pg_dump
```
(Sur Mac Intel, utilise plutôt `/usr/local/opt/postgresql@17/bin/pg_dump`.)

- **Créer un backup à la demande :** `npm run db:backup`
- **Restaurer un backup :** (remplace toute la base)
  ```bash
  pg_restore -U POSTGRES_USER -d myfacturation360 --clean --if-exists prisma/backups/backup_YYYYMMDDHHMMSS.dump
  ```
  Adapte le nom du fichier et l’utilisateur. Sur macOS/Linux, tu peux utiliser `PGPASSWORD=xxx pg_restore ...` si besoin.

## Sauvegardes à intervalle régulier (cron)

Pour sauvegarder la base automatiquement à intervalles réguliers sur ton Mac :

1. Ouvre la crontab : `crontab -e`
2. Ajoute une des lignes ci‑dessous (remplace `CHEMIN_VERS_FACTURATION` par le chemin réel du projet, ex. `/Users/tonuser/Desktop/Site Web/Facturation` ; pour l’obtenir, va dans le projet et tape `pwd`).

**Toutes les 6 heures :**
```cron
0 */6 * * * CHEMIN_VERS_FACTURATION/scripts/backup-db-cron.sh >> /tmp/db-backup.log 2>&1
```

**Une fois par jour à 8 h :**
```cron
0 8 * * * CHEMIN_VERS_FACTURATION/scripts/backup-db-cron.sh >> /tmp/db-backup.log 2>&1
```

Le script `scripts/backup-db-cron.sh` se place dans le projet et lance `npm run db:backup`. Les sauvegardes vont dans `prisma/backups/` (30 derniers conservés). Les erreurs et la sortie sont dans `/tmp/db-backup.log` si tu rediriges comme ci‑dessus. Si le chemin contient des espaces (ex. `Site Web`), mets‑le entre guillemets dans la crontab.

## Commandes utiles

- `npm run db:backup` — créer une sauvegarde maintenant (sans faire push/migrate)
- `npm run db:push` — backup auto puis synchroniser le schéma
- `npm run db:migrate` — backup auto puis créer/appliquer une migration
- `npm run db:seed` — exécuter le seed (admin + plans)
- `npm run db:studio` — ouvrir Prisma Studio
