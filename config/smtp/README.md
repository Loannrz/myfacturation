# SMTP (Hostinger)

Configuration du client SMTP pour les emails transactionnels.

## Variables d'environnement

| Variable         | Description                    | Exemple                          |
|------------------|--------------------------------|----------------------------------|
| `SMTP_HOST`      | Serveur SMTP                   | `smtp.hostinger.com`             |
| `SMTP_PORT`      | Port (465 pour TLS)            | `465`                            |
| `SMTP_USER`      | Utilisateur (expéditeur)       | `noreply@myfacturation360.fr`    |
| `SMTP_PASSWORD`  | Mot de passe (ou `SMTP_PASS`)  | *(secret)*                       |
| `SMTP_FROM`      | (Optionnel) Adresse "From"     | Par défaut = `SMTP_USER`         |

Copier `.env.example` vers `.env.local` et renseigner les valeurs.

## Utilisation

- **Envoi générique** : `import { sendEmail } from '@/services/emailService'`
- **Vérification email** : `import { sendVerificationEmail } from '@/utils/sendVerificationEmail'`  
  Exemple : `await sendVerificationEmail(user.email, token)`
- **Reset mot de passe** : `import { sendResetPasswordEmail } from '@/utils/sendResetPasswordEmail'`  
  Exemple : `await sendResetPasswordEmail(user.email, resetToken)`

Les tokens sont à générer côté métier (ex. API signup / forgot-password) et stockés en base si besoin.
