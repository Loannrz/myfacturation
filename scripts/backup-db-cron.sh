#!/usr/bin/env bash
# À appeler par cron pour des sauvegardes à intervalle régulier.
# Utilisation : crontab -e puis par ex. :
#   0 */6 * * * /chemin/vers/Facturation/scripts/backup-db-cron.sh >> /tmp/db-backup.log 2>&1
cd "$(dirname "$0")/.." && npm run db:backup
