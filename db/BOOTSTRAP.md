# Mise en route

La plateforme démarre entièrement vide (§1, §24) : aucun compte n'existe, pas même
celui du ministère. L'amorçage se fait une seule fois.

## 1. Une base PostgreSQL

N'importe quelle instance PostgreSQL 14 ou plus récent convient — le schéma n'utilise
que `pgcrypto`, disponible partout :

| Hébergeur | Notes |
| --- | --- |
| **Neon** | Offre gratuite, se branche en un clic depuis Vercel |
| **Vercel Postgres** | Intégré au tableau de bord |
| **Railway / Render** | Offres gratuites également |
| **Auto-hébergé** | `docker run -e POSTGRES_PASSWORD=… postgres:16` suffit |

## 2. Deux variables d'environnement

```bash
DATABASE_URL=postgres://utilisateur:motdepasse@hote/base?sslmode=require
AUTH_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")
```

En production, les définir dans Vercel → Settings → Environment Variables.

## 3. Migrations

```bash
npm run migrate            # applique ce qui manque
npm run migrate -- --status  # liste sans rien appliquer
```

Chaque fichier s'exécute dans une transaction et est enregistré : relancer la
commande est sans effet.

## 4. Comptes initiaux

Éditer `db/setup/01_comptes_initiaux.sql` — remplacer les trois mots de passe et,
si besoin, les adresses email — puis :

```bash
npm run seed
```

Le script crée, dans cet ordre :

1. le compte **ministère** (amorçage direct : `create_account()` exige un appelant
   ministère, il faut bien commencer quelque part) ;
2. la **wilaya 42 — Tipaza** et son compte de **direction** ;
3. l'**INSFP de Bou Ismaïl** et son compte **administrateur**.

Les étapes 2 et 3 passent par les fonctions normales de la plateforme, sous
l'identité du ministère : le chemin d'autorisation réel est donc exercé, pas
contourné.

Le script est ré-exécutable sans effet de bord.

> Les mots de passe doivent respecter la politique appliquée en base :
> 10 caractères minimum, au moins une lettre et un chiffre, ni identifiant
> ni mot de passe courant.

## 5. La suite depuis l'interface

Une fois connecté en ministère, plus aucune intervention en base n'est nécessaire.

| Créé par | Peut créer | Où |
| --- | --- | --- |
| Ministère | direction de wilaya, établissement, professeur, étudiant, ministère | `/ministere/comptes`, `/ministere/wilayas`, `/ministere/etablissements` |
| Direction de wilaya | établissement, professeur, étudiant — **dans sa wilaya** | `/direction/comptes` |
| Établissement | professeur, étudiant, administrateur — **dans son établissement** | `/administration/comptes` |

Ces limites sont vérifiées par `create_account()` côté PostgreSQL : les contourner
depuis l'interface ou l'API est sans effet.

## 6. Ordre de saisie conseillé

1. Wilayas (+ comptes de direction)
2. Modes de formation (import des 5 modes officiels)
3. Filières, puis programmes → structure S1→S5, modules, documents, publication
4. Établissements (+ comptes administrateurs)
5. Règlement pédagogique

L'établissement enchaîne : spécialités → classes → sections → matières → comptes.
