# Cursus — Guide de déploiement

Documentation opérationnelle pour mettre Cursus en production, de zéro jusqu'au monitoring post-mise-en-ligne.

---

## 1. Pré-requis

| Élément | Version / spécification |
| --- | --- |
| Node.js | ≥ 18.0.0 (recommandé : 20 LTS) |
| npm | ≥ 9 |
| Compte Supabase | gratuit (Pro recommandé en prod : sauvegardes quotidiennes, PITR) |
| Compte Netlify | gratuit (Pro pour les analytics & formulaires) |
| Compte Resend | gratuit ≤ 3 000 emails/mois |
| Domaine DNS | ex. `cursus.dz` — accès aux enregistrements A / CNAME / TXT |
| CLI Supabase | `npm i -g supabase` (≥ 1.190.0) |

---

## 2. Création du projet Supabase

1. **Créer le projet** sur [app.supabase.com](https://app.supabase.com)
   - Région : **Frankfurt (eu-central-1)** — meilleure latence depuis l'Algérie.
   - Plan : **Pro** en production (backups quotidiens 7 jours + PITR 7 jours).
   - Mot de passe DB : généré, à stocker dans un coffre (1Password, Bitwarden).

2. **Récupérer les clés** dans *Project Settings → API* :
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` → `VITE_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (jamais côté client !)

3. **Lier le projet local**
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>     # ref = identifiant 20 car. dans l'URL
   ```

4. **Appliquer les migrations**
   ```bash
   npx supabase db push
   ```
   Les 5 fichiers sont appliqués dans l'ordre :
   - `20260101000000_schema.sql` — 15 tables, 11 types énumérés, triggers `updated_at`
   - `20260101000100_functions.sql` — fonctions utilitaires
   - `20260101000200_rls.sql` — Row Level Security sur 100 % des tables
   - `20260101000300_storage.sql` — buckets + policies
   - `20260524000000_admin_create_user.sql` — RPC d'invitation

5. **Créer le premier compte ministère** (manuellement, une seule fois)
   ```sql
   -- Dans SQL Editor Supabase (rôle postgres)
   -- 1. Créer l'utilisateur via l'UI Auth → Add user → Send invite
   -- 2. Mettre à jour son profil :
   update public.profiles
      set role = 'ministry', status = 'active'
    where email = 'ministre@formation.gov.dz';
   ```

---

## 3. Configuration Resend (email transactionnel)

1. **Créer un compte** sur [resend.com](https://resend.com).
2. **Ajouter le domaine** `cursus.dz` → Resend affiche 3 enregistrements à ajouter au DNS :
   - `MX` : `feedback-smtp.eu-west-1.amazonses.com` (priorité 10)
   - `TXT` (SPF) : `"v=spf1 include:amazonses.com ~all"`
   - `TXT` (DKIM) : valeur générée par Resend
3. Attendre la propagation DNS (≤ 24 h, en général < 30 min).
4. **Récupérer la clé API** → `Settings → API Keys → Create` → `RESEND_API_KEY=re_…`
5. Définir l'expéditeur vérifié : `documents@cursus.dz`.

---

## 4. Déploiement de l'Edge Function

```bash
# Connecter le projet (si pas déjà fait)
npx supabase link --project-ref <ref>

# Déployer la fonction
npm run supabase:functions:deploy
#  → équivaut à : supabase functions deploy send-document-email

# Déclarer les secrets côté serveur
npx supabase secrets set \
  RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx \
  RESEND_FROM_EMAIL=documents@cursus.dz \
  RESEND_FROM_NAME=Cursus
```

**Test rapide** depuis le terminal :
```bash
curl -X POST \
  "https://<ref>.supabase.co/functions/v1/send-document-email" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"to":"test@exemple.dz","subject":"Test","html":"<p>OK</p>"}'
```

---

## 5. Déploiement sur Netlify

### 5.1 Premier déploiement
1. Pousser le dépôt sur GitHub/GitLab/Bitbucket.
2. **Netlify → Add new site → Import from Git**.
3. Sélectionner le dépôt — build settings auto-détectés depuis `netlify.toml` :
   - Build command : `npm run build`
   - Publish directory : `dist`
   - Node version : 20

### 5.2 Variables d'environnement (Site settings → Environment variables)
| Clé | Valeur | Scope |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` | All |
| `VITE_SUPABASE_ANON_KEY` | clé `anon` | All |
| `VITE_APP_NAME` | `Cursus` | All |
| `VITE_APP_URL` | `https://cursus.dz` | All |
| `VITE_DEFAULT_LANG` | `fr` | All |
| `VITE_DEFAULT_THEME` | `light` | All |

> Les variables `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_*` ne vont **PAS** dans Netlify : elles vivent dans les *Edge Function secrets* de Supabase.

### 5.3 Domaine personnalisé
1. **Domain management → Add domain → `cursus.dz`**.
2. Netlify affiche les enregistrements à pointer chez le registrar :
   - `A` apex → `75.2.60.5` (Netlify load balancer)
   - `CNAME www` → `<site>.netlify.app`
3. Activer **HTTPS** (Let's Encrypt automatique, propagation ≤ 1 h).
4. Forcer **HTTPS** + **www → apex** dans *Domain settings*.

### 5.4 Mettre à jour la CSP
Une fois le projet Supabase créé, modifier `netlify.toml` ligne 32 pour remplacer l'URL Supabase actuelle (`yjtfauvmlimnwcmdqhrp.supabase.co`) par la nouvelle `<ref>.supabase.co` dans :
- `img-src` (uploads de documents)
- `connect-src` (REST + WebSocket realtime)

---

## 6. Build local & tests pré-prod

```bash
# Installation propre
rm -rf node_modules package-lock.json
npm install

# Build
npm run build               # → dist/

# Preview (sert dist/ sur localhost:4173)
npm run preview

# Smoke test des routes critiques
for url in / /login /signup /etudiant /ministere /404; do
  curl -s -o /dev/null -w "%{http_code} %{url_effective}\n" \
    "http://localhost:4173$url"
done
```

Toutes les routes doivent renvoyer `200` (le SPA fallback gère les routes côté client).

---

## 7. Vérifications post-déploiement

### 7.1 Smoke test fonctionnel
- [ ] `/` charge — sélecteur de langue + bascule thème opérationnels
- [ ] Inscription d'un étudiant → statut `pending`
- [ ] Validation admin → statut `active` → connexion réussie
- [ ] Tableau de bord du rôle correspondant s'affiche
- [ ] Demande d'attestation envoyée → email reçu via Resend

### 7.2 Sécurité
- [ ] Test des en-têtes : [securityheaders.com](https://securityheaders.com) → note **A** minimum
- [ ] HTTPS forcé (HSTS preload)
- [ ] CSP sans `unsafe-inline` sur `script-src`
- [ ] Aucun secret exposé : `curl https://cursus.dz/.env` → 404

### 7.3 Performance
- [ ] [PageSpeed Insights](https://pagespeed.web.dev/) → Performance ≥ 90 / 100 sur mobile
- [ ] Premier rendu ≤ 1.5 s sur 4G
- [ ] Bundle initial gzip ≤ 35 kB

### 7.4 Accessibilité
- Voir `ACCESSIBILITY.md` — audit Axe doit retourner **0 violation** sur les pages publiques.

---

## 8. Monitoring & alertes

| Préoccupation | Outil | Configuration |
| --- | --- | --- |
| Disponibilité | Netlify Analytics + [UptimeRobot](https://uptimerobot.com) | Ping `/` toutes les 5 min, alerte email |
| Erreurs JS client | Console navigateur (v0) — [Sentry](https://sentry.io) (v1) | DSN dans `.env` côté client |
| Logs Edge Function | Supabase Dashboard → Functions → Logs | Rétention 7 j (Pro) |
| Quota Resend | Resend Dashboard | Alerte à 80 % de 3000 emails/mois |
| Connexions DB | Supabase → Database → Pooler | Alerte à 80 % du pool (60/75 par défaut) |

---

## 9. Runbook — incidents fréquents

### 9.1 Le site renvoie 500 / page blanche
1. Vérifier le statut de **Netlify** ([status.netlify.com](https://status.netlify.com)) et de **Supabase** ([status.supabase.com](https://status.supabase.com)).
2. Consulter les logs du dernier deploy : `Deploys → <build> → Deploy log`.
3. Rollback rapide : `Deploys → <dernier deploy OK> → Publish deploy`.

### 9.2 Erreurs "JWT expired" en cascade
- Vérifier `VITE_SUPABASE_ANON_KEY` côté Netlify — elle ne doit pas être de l'ancien projet.
- Les utilisateurs doivent rafraîchir la page (cache du SW) — incrémenter la version dans `public/sw.js`.

### 9.3 Aucun email envoyé
1. Tester l'Edge Function avec un `curl` (cf. §4).
2. Vérifier les logs : `supabase functions logs send-document-email --tail`.
3. Resend → Logs → identifier les bounces / blocked.
4. Cas typique : domaine non vérifié → renvoyer le DNS DKIM.

### 9.4 RLS bloque un utilisateur légitime
1. SQL Editor : `set role to authenticated; set request.jwt.claims to '{"sub":"<uuid>","role":"authenticated"}';`
2. `select * from public.<table>;` — identifier la policy qui rejette.
3. Corriger la policy, ne **jamais** désactiver RLS en prod.

### 9.5 Build échoue sur Netlify
- `Error: Cannot find module 'X'` → vérifier que `package-lock.json` est committé.
- `Out of memory` → upgrade vers un build runner plus gros (Pro plan).

---

## 10. Backups & restauration

### Supabase
- **Backups quotidiens** (Pro) : 7 derniers jours, restaurable depuis le dashboard.
- **PITR** (Point-In-Time Recovery) : restauration à n'importe quelle seconde des 7 derniers jours (Pro plan).
- **Exports manuels** mensuels :
  ```bash
  npx supabase db dump --linked --schema public > backups/cursus-$(date +%F).sql
  ```

### Storage (documents PDF)
- Bucket privé, RLS active. Pas de sauvegarde dédiée par défaut ; envisager une sync mensuelle vers un bucket S3 externe pour les attestations critiques.

---

## 11. Cycle de vie des releases

| Étape | Branche | Déclencheur |
| --- | --- | --- |
| Développement | `feature/*` | Deploy preview Netlify automatique |
| Pré-production | `staging` | Auto-deploy sur `staging.cursus.dz` |
| Production | `main` | Auto-deploy sur `cursus.dz` après merge |

Convention de commit : [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`).

---

## 12. Coût mensuel estimé (prod)

| Service | Plan | Coût/mois |
| --- | --- | --- |
| Netlify | Pro | 19 $ |
| Supabase | Pro | 25 $ |
| Resend | Free (≤ 3 000 emails) | 0 $ |
| Domaine `.dz` | NIC.dz | ~10 $/an |
| **Total estimé** | | **≈ 45 $/mois** |

À l'échelle de 2 000 établissements actifs, prévoir :
- Supabase **Team** (599 $/mois) à partir de ~50 000 MAU
- Resend **Pro** (20 $/mois pour 50 000 emails)

---

*Document de référence — mis à jour le 23 mai 2026.*
