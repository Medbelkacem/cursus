# Cursus

**Plateforme nationale de gestion et de suivi des instituts et centres de formation en Algérie.**

Une seule plateforme pour cinq niveaux hiérarchisés :

```
Ministère  →  Wilayas / Directions  →  Établissements  →  Professeurs  →  Étudiants
                                    →  Classes & spécialités
                                    →  Semestres S1 → S5
                                    →  Contrats d'apprentissage & stages
```

Les 10 types d'établissement officiels sont pris en charge : **INSFP, IEP, CFPA, CFPHP,
Centre d'Excellence, INFEP, IFEP, CNEPD, INDEFOC, EPFP**.

> **La plateforme démarre entièrement vide.** Aucune wilaya, aucun établissement,
> aucun programme, aucun étudiant, aucune statistique n'est pré-rempli : toute la
> structure est créée par le ministère depuis l'interface d'administration.
> Voir [CAHIER-DES-CHARGES.md](CAHIER-DES-CHARGES.md) pour la couverture détaillée
> et l'ordre de mise en route.

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
| Hébergement | **Vercel** (`vercel.json`) — Netlify également configuré (`netlify.toml`) |
| Tests | Migrations vérifiées sur PostgreSQL 16 · harnais de rendu Chromium headless (`.smoke/`) |

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

---

## Fonctionnalités par rôle

### Ministère — niveau national
Wilayas et comptes de direction · établissements (10 types) · filières · programmes de
formation (structure S1→S5, modules, documents, publication) · modes de formation ·
suivi national des étudiants · contrats d'apprentissage · stages S5 · règlement
pédagogique · comptes et permissions · rapports PDF/CSV · annonces.

### Direction de wilaya — périmètre wilaya
Tableau de bord de la wilaya · établissements de la wilaya · étudiants · catalogue des
programmes · contrats et stages · règlement de wilaya · comptes des établissements ·
rapports. **Aucun accès aux données d'une autre wilaya** — restriction appliquée par les
policies PostgreSQL, pas seulement par l'interface.

### Établissement
Tableau de bord · étudiants · spécialités, classes, sections et sessions · matières ·
programmes · contrats et stages de ses étudiants · règlement d'établissement · comptes
internes · demandes de documents · rapports.

### Professeur
Matières assignées · présence · notes · examens et TP · supports de cours · consultation
des programmes nationaux.

### Étudiant
Tableau de bord · parcours S1→S5 (moyennes, rattrapages, crédits, assiduité) · programme
de formation et documents · cours · présence · notes · examens · **dépôt du contrat
d'apprentissage** · **dépôt de la convention de stage S5** · documents administratifs ·
notifications.

---

## Moteur académique

À chaque note saisie, la moyenne pondérée du semestre est recalculée en base et le statut
est mis à jour :

| Situation | Statut | Suite |
| --- | --- | --- |
| Moyenne ≥ seuil | **Validé** | Passage automatique au semestre suivant |
| Moyenne < seuil | **Rattrapage à passer** | Notification à l'étudiant |
| Rattrapage ≥ seuil | **Validé** | Passage automatique |
| Rattrapage < seuil | **Rattrapage non validé** | Décision configurée : redoublement, maintien, exclusion ou examen au cas par cas |

Les seuils, la progression automatique et la décision en cas d'échec proviennent tous de
la table `academic_rules` : **aucune règle n'est codée en dur**, et sans configuration la
plateforme n'applique jamais d'exclusion automatique.

L'arrivée en **S5** déclenche l'exigence du stage pratique et la notification associée.

---

## Base de données

12 migrations dans `supabase/migrations/` :

| Fichier | Contenu |
| --- | --- |
| `20260101000000_schema` | Schéma de base (profils, établissements, matières, notes, examens) |
| `20260101000100_functions` | Helpers RLS, trigger de création de profil |
| `20260101000200_rls` | Policies de base |
| `20260101000300_storage` | Buckets cours / copies / documents |
| `20260524000000_admin_create_user` | Création de compte par le ministère (historique) |
| `20260820000000_enum_extensions` | Les 10 types d'établissement officiels |
| `20260820000100_national_structure` | Wilayas, modes, filières, programmes, classes, semestres, contrats, notifications, permissions, audit |
| `20260820000200_academic_engine` | Moyennes, rattrapage, progression, règlement effectif, notifications |
| `20260820000300_stats_rpc` | `stats_national` / `stats_wilaya` / `stats_establishment` / `student_overview` |
| `20260820000400_rls_v2` | RLS des nouvelles tables |
| `20260820000500_storage_v2` | Buckets contrats et curricula |
| `20260820000600_accounts_v2` | Création hiérarchique de comptes, statuts, permissions, annonces |
| `20260820000700_scope_hardening` | Cloisonnement strict des établissements + recherche multicritère |

```bash
npm run supabase:link
npm run supabase:push
```

Le premier compte ministère se crée depuis le Studio Supabase (`role: 'ministry'` dans
les métadonnées, statut `active`). Tous les autres comptes sont ensuite créés depuis
l'interface.
