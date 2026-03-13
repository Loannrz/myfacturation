# Signature électronique des PDF (factures / avoirs)

La signature est appliquée **après** la génération Factur-X (PDF/A-3B + XML). Elle est **invisible** (technique) et PAdES-compatible.

## Configuration

Deux options :

### 1. Fichier P12 dans le projet

Placez un fichier **myfacturation360.p12** dans ce dossier (`lib/signing/`).

Variables d’environnement optionnelles :

- **PDF_SIGNING_P12_PASSWORD** : mot de passe du fichier P12 (vide si pas de mot de passe).

### 2. Certificat en variable d’environnement

- **PDF_SIGNING_P12_BASE64** : contenu du fichier .p12 encodé en base64.
- **PDF_SIGNING_P12_PASSWORD** : mot de passe du P12.

Ou :

- **PDF_SIGNING_P12_PATH** : chemin absolu vers un fichier .p12.
- **PDF_SIGNING_P12_PASSWORD** : mot de passe du P12.

## Certificat recommandé

Le certificat X.509 doit contenir au minimum :

- **Common Name (CN)** = MyFacturation360  
- **Organization (O)** = MyFacturation360  
- **Country (C)** = FR  

## Générer un certificat auto-signé (test)

Pour générer un P12 d’essai (OpenSSL) :

```bash
# Clé et certificat (CN=MyFacturation360, O=MyFacturation360, C=FR)
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 3650 -nodes \
  -subj "/CN=MyFacturation360/O=MyFacturation360/C=FR"

# Export P12 (mot de passe vide pour test)
openssl pkcs12 -export -out lib/signing/myfacturation360.p12 -inkey key.pem -in cert.pem -passout pass:
```

En production, utilisez un certificat délivré par une autorité de certification (AC).

## Comportement

- Si **aucun** certificat n’est configuré : le PDF est retourné **non signé** (comportement actuel).
- Si un P12 est configuré : le PDF est signé avec  
  **Reason** = Facture électronique,  
  **Location** = MyFacturation360,  
  **Contact** = support@myfacturation360.com,  
  **SignerName** = MyFacturation360.
