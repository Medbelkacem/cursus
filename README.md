# Cursus

**Plateforme nationale de gestion et de suivi des instituts et centres de formation en Algérie.**

Une seule plateforme pour cinq rôles hiérarchisés :

```
Ministère  →  Direction  →  Établissement (Admin)  →  Professeur  →  Étudiant
```

Cible : ~2 000 établissements (CFPA, INSFP, IFPM, IAP, INFS, Instituts paramédicaux, centres privés, écoles spécialisées, centres sectoriels et d'excellence, formation à distance, apprentissage, écoles supérieures professionnelles, perfectionnement).

---

## Stack

| Couche | Technologie |
| --- | --- |
| Build | **Vite** (vanilla JS, ES modules, code-split) |
| UI | HTML / CSS modulaire / JS vanilla — pas de framework lourd |
| i18n | Système maison à 3 langues : **fr** · **en** · **ar** (avec RTL) |
| Thèmes | Clair / sombre via `data-theme` et variables CSS |
| Backend | **Supabase** (PostgreSQL + Auth + Row Level Security + Storage) |
| Email | Supabase **Edge Function** + **Resend** |
| Hébergement | **Netlify** (build statique + SPA fallback configuré dans `netlify.toml`) |

---

## Démarrage rapide

```bash
# 1. Cloner et installer
git clone <repo> cursus && cd cursus
npm install

# 2. Configurer l'environnement
cp .env.example .env
# Éditer .env : VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY au minimum

# 3. Lancer le serveur de dev (port 5173 par défaut)
npm run dev
```

Le site s'ouvre sur **http://localhost:5173** avec la page d'accueil (sélecteur de langue, bascule de thème, deux CTA). Les autres écrans arrivent aux étapes suivantes.

---

## Structure du projet

```
.
├── index.html                  # Entrée HTML (pré-application de thème/langue)
├── netlify.toml                # Build + SPA fallback + en-têtes de sécurité
├── package.json                # Scripts npm
├── vite.config.js              # Vite + code-splitting
├── .env.example                # Variables d'environnement documentées
│
├── public/                     # Statique (favicon, robots.txt à venir)
│
├── src/
│   ├── main.js                 # Point d'entrée — orchestre i18n / thème / supabase / router
│   ├── pages/                  # Une fonction par page (returns HTMLElement)
│   │   ├── home.js
│   │   └── not-found.js
│   ├── components/             # Composants réutilisables (Sidebar, Topbar, Card…)
│   ├── lib/
│   │   ├── supabase.js         # Client Supabase singleton
│   │   ├── i18n.js             # 3 langues + RTL automatique
│   │   ├── theme.js            # Clair / sombre persistant
│   │   └── router.js           # Router vanilla pushState
│   ├── locales/
│   │   ├── fr.json
│   │   ├── en.json
│   │   └── ar.json
│   └── styles/
│       ├── tokens.css          # Couleurs · typo · espacement · ombres
│       ├── base.css            # Reset + écran d'amorçage
│       ├── components.css      # Boutons, page d'accueil
│       └── rtl.css             # Surcharges arabe
│
└── supabase/
    ├── config.toml             # Configuration CLI
    ├── migrations/             # SQL (tables + RLS) — étape 4
    └── functions/
        └── send-document-email/
            └── index.ts        # Edge Function — étape 7
```

---

## Configuration Supabase

1. Créer un projet sur [supabase.com](https://supabase.com) (région Frankfurt recommandée).
2. Copier l'URL et la clé `anon` dans `.env` :
   ```env
   VITE_SUPABASE_URL=https://xxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
3. À l'étape 4, exécuter les migrations :
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
4. À l'étape 7, déployer l'Edge Function :
   ```bash
   npx supabase functions deploy send-document-email
   npx supabase secrets set RESEND_API_KEY=re_... RESEND_FROM_EMAIL=documents@cursus.dz
   ```

> **Pas de données fictives** : la base ne contient que le schéma. Le client ajoutera les vraies données via l'interface après déploiement.

---

## Déploiement sur Netlify

1. Pousser le repo sur GitHub / GitLab.
2. Sur Netlify : **Add new site → Import from Git → sélectionner le repo**.
   Build settings auto-détectés depuis `netlify.toml` :
   - Build command : `npm run build`
   - Publish directory : `dist`
3. Dans **Site settings → Environment variables**, déclarer :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_APP_NAME` (optionnel)
   - `VITE_APP_URL` (optionnel)
4. Déclencher un déploiement. Le SPA fallback (`netlify.toml`) assure que les liens profonds fonctionnent.

---

## Avancement — étapes

- [x] **Étape 1** — Initialisation : Vite, structure, `netlify.toml`, `.env.example`, README, écran d'accueil minimal.
- [x] **Étape 2** — Design system (tokens, composants Card/Button/Badge/Input, AppShell, Sidebar, Topbar, Zellige).
- [x] **Étape 3** — i18n complet (fr · en · ar avec RTL automatique).
- [x] **Étape 4** — Migrations SQL Supabase (schéma + RLS + Storage + fonctions utilitaires).
- [x] **Étape 5** — Authentification + flux `pending` / `active` / `rejected` (login, signup, /en-attente, /refuse).
- [x] **Étape 6** — Tableaux de bord pour les 5 rôles : étudiant, professeur, administration, direction, ministère.
- [x] **Étape 7** — Sous-pages métier (cours, présence, notes, examens, documents) + Edge Function `send-document-email` (Resend).
- [x] **Étape 8** — Responsive mobile complet (breakpoints 480/640/720/980/1180, tables `--stack`, focus tactile renforcé, print CSS), accessibilité WCAG 2.1 AA (skip-link, landmarks, ARIA menu mobile, `prefers-contrast`, `.sr-only`), documentation finale.

📄 **Voir aussi** : [`DEPLOYMENT.md`](./DEPLOYMENT.md) (guide complet Supabase + Netlify + Resend) · [`ACCESSIBILITY.md`](./ACCESSIBILITY.md) (audit Axe + checklist WCAG 2.1 AA) · [`FICHE-TECHNIQUE.md`](./FICHE-TECHNIQUE.md) (fiche projet) · [`FICHE-TECHNIQUE.pdf`](./FICHE-TECHNIQUE.pdf) (version imprimable).

### Routes câblées

| Public | Étudiant | Professeur | Administration | Direction | Ministère |
| --- | --- | --- | --- | --- | --- |
| `/`, `/login`, `/signup` | `/etudiant` | `/professeur` | `/administration` | `/direction` | `/ministere` |
| `/en-attente`, `/refuse` | `/etudiant/cours` | `/professeur/matieres` | `/administration/utilisateurs` | `/direction/etablissements` | `/ministere/directions` |
| `/design`, `/profil` | `/etudiant/presence` | `/professeur/presence` | `/administration/specialites` | `/direction/statistiques` | `/ministere/etablissements` |
|  | `/etudiant/notes` | `/professeur/notes` | `/administration/matieres` |  | `/ministere/statistiques` |
|  | `/etudiant/examens` | `/professeur/examens` | `/administration/demandes` |  |  |
|  | `/etudiant/documents` | `/professeur/supports` |  |  |  |

---

## Licence

Propriétaire — usage réservé aux établissements de formation en Algérie. Toute redistribution requiert un accord écrit.
