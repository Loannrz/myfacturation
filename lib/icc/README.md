# Profil ICC sRGB pour PDF/A-3B

Pour une conformité PDF/A-3B (éviter « DeviceRGB utilisé sans profil couleur »), placez ici un profil ICC sRGB.

## Fichiers reconnus (par ordre de priorité)

1. **sRGB.icc** — profil standard sRGB IEC61966-2.1 (recommandé)
2. **sRGB2014.icc** — profil sRGB v4 (Color.org)

## Où se le procurer

- **sRGB IEC61966-2.1** : par exemple `sRGB.icc` ou `sRGB_IEC61966-2-1_black_scaled.icc` depuis le registre ICC / Color.org.
- **sRGB2014.icc** : https://www.color.org/srgbprofiles.xalter

Enregistrez le fichier sous le nom **sRGB.icc** (ou **sRGB2014.icc**) dans ce dossier (`lib/icc/`).

Sans aucun de ces fichiers, l’OutputIntent ne sera pas ajouté et les validateurs PDF/A signaleront un profil couleur manquant.
