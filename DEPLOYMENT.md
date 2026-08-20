# Déploiement

## 1. Prérequis

| Élément | Détail |
| --- | --- |
| Node.js | ≥ 18 |
| PostgreSQL | ≥ 14 — Neon, Vercel Postgres, Railway, Render ou auto-hébergé |
| Hébergeur | Vercel (`vercel.json` fourni) — toute plateforme exécutant des fonctions Node convient |

Aucun compte fournisseur particulier n'est nécessaire : la plateforme ne dépend que
d'une base PostgreSQL standard et d'un environnement d'exécution Node.

---

## 2. Base de données

Créer une base, puis récupérer sa chaîne de connexion. Sur Neon :

```
postgres://utilisateur:motdepasse@ep-xxxx.eu-central-1.aws.neon.tech/cursus?sslmode=require
```

Appliquer le schéma :

```bash
DATABASE_URL='postgres://…' npm run migrate
```

Les 18 migrations s'appliquent dans l'ordre, chacune dans une transaction, et sont
enregistrées dans `public.schema_migrations`. La commande est ré-exécutable.

---

## 3. Variables d'environnement

| Variable | Obligatoire | Rôle |
| --- | --- | --- |
| `DATABASE_URL` | oui | Connexion PostgreSQL |
| `AUTH_SECRET` | oui | Signature des sessions — 32 caractères minimum |
| `PG_POOL_MAX` | non | Connexions par instance de fonction (défaut 5) |
| `PG_APP_ROLE` | non | Rôle des requêtes utilisateur (défaut `app_authenticated`) |
| `RESEND_API_KEY` | non | Envoi des documents par courriel |
| `RESEND_FROM_EMAIL` | non | Expéditeur affiché |

Générer le secret :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

> Changer `AUTH_SECRET` invalide immédiatement toutes les sessions en cours.
> C'est le moyen le plus rapide de déconnecter tout le monde en cas d'incident.

Sur Vercel : **Settings → Environment Variables**, portée *Production* et *Preview*.

---

## 4. Déploiement

```bash
npx vercel --prod
```

ou en connectant le dépôt GitHub : chaque poussée sur `main` déclenche une mise en
production.

`vercel.json` fournit déjà :

- la réécriture SPA (`/* → /index.html`) pour que les liens profonds fonctionnent ;
- les en-têtes de sécurité (CSP, HSTS, `X-Frame-Options`, `Referrer-Policy`, COOP/CORP) ;
- `Cache-Control: no-store` sur `/api/*` et sur `/sw.js` ;
- un cache immuable d'un an sur `/assets/*`, dont les noms sont hachés.

---

## 5. Premiers comptes

Voir [db/BOOTSTRAP.md](db/BOOTSTRAP.md).

---

## 6. Vérifications après mise en production

```bash
# L'application répond et sert bien le dernier build
curl -sI https://<domaine>/ | head -1

# L'API est raccordée à la base (200 avec user:null si personne n'est connecté)
curl -s https://<domaine>/api/auth/session

# Les liens profonds passent par la réécriture SPA
curl -s -o /dev/null -w '%{http_code}\n' https://<domaine>/ministere/wilayas

# Le manifeste et le service worker sont servis
curl -s -o /dev/null -w '%{http_code}\n' https://<domaine>/manifest.webmanifest
```

Une réponse `503 Plateforme non configurée` signifie que `DATABASE_URL` ou
`AUTH_SECRET` manque dans l'environnement de l'hébergeur.

---

## 7. Sauvegardes

Toutes les données — y compris les fichiers déposés, stockés dans PostgreSQL —
tiennent dans une sauvegarde de base :

```bash
pg_dump "$DATABASE_URL" -Fc -f cursus-$(date +%F).dump
```

Neon et Vercel Postgres proposent en outre une restauration à un instant donné.
