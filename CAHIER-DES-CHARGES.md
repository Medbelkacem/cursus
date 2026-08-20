# Couverture du cahier des charges

Correspondance entre les 25 sections du cahier des charges et leur implémentation.
Le contrôle d'accès est appliqué **en base** (RLS + fonctions `security definer`),
jamais uniquement dans l'interface.

| § | Exigence | Implémentation |
| --- | --- | --- |
| 1 | Base vide, aucune donnée de démonstration | Aucune migration n'insère de donnée métier. Les tableaux de bord affichent 0 / états vides. |
| 2 | Compte ministère, permissions nationales | Rôle `ministry` ; `create_account`, `create_wilaya_with_admin`, `set_account_status`, `delete_account`, `set_permissions`, `broadcast_announcement`. |
| 3 | Comptes de direction de wilaya | Rôle `direction` rattaché à `profiles.wilaya_id` ; cloisonnement par `establishment_in_my_direction()` et `current_wilaya()`. |
| 4 | Gestion des wilayas | Table `wilayas` (code, nom, direction, contact, statut) + page `/ministere/wilayas`. |
| 5 | Établissements et 10 types officiels | Enum `establishment_type` étendu ; nomenclature dans `src/lib/nomenclature.js` ; page `/ministere/etablissements`. |
| 6 | Comptes d'établissement et RBAC | `create_account` (hiérarchie vérifiée en base), `user_permissions`, page Comptes partagée par les 3 niveaux. |
| 7 | Classes, spécialités, programmes, filières, sections, sessions | `fields`, `programs`, `program_semesters`, `program_modules`, `specialties`, `groups`, `sections`, `training_sessions`. |
| 8 | Modes de formation | Table `training_modes` (vide au départ) + import explicite des 5 modes officiels depuis `/ministere/modes`. |
| 9 | Contrats d'apprentissage | Table `contracts` (`kind = 'apprenticeship'`), 5 statuts, historique `contract_reviews`, dépôt étudiant + validation administration. |
| 10 | Parcours S1 → S5 | `student_semesters` (moyenne, rattrapage, crédits, présence, statut) + `students.current_semester`. |
| 11 | Validation semestrielle et rattrapage | `recalc_student_semester()` déclenché à chaque note ; seuils et décision issus de `academic_rules` — **rien n'est codé en dur**. |
| 12 | Programme de formation publié | `program_documents` + bucket `curricula` ; publication → notification aux étudiants inscrits. |
| 13 | Stage pratique S5 | `contracts` (`kind = 'internship'`, `semester = 's5'`), rattachement automatique au relevé S5. |
| 14 | Suivi des stages | Page Stages : déposés / manquants / en attente / approuvés / refusés / terminés, lieux et organismes. |
| 15 | Espace étudiant | `/etudiant` : identité, progression, moyennes, dossiers, notifications. |
| 16 | Espace professeur | Matières, présence, notes, examens, supports, catalogue des programmes. |
| 17 | Tableau de bord national | `stats_national()` — établissements par type et par wilaya, étudiants, académique, formation, apprentissage, stages. |
| 18 | Tableau de bord de wilaya | `stats_wilaya()` — même structure, limitée à la wilaya de l'appelant. |
| 19 | Tableau de bord d'établissement | `stats_establishment()` — effectifs par classe, dossiers en attente, demandes. |
| 20 | Notifications | Table `notifications` + déclencheurs (contrats, semestres, publication) + `broadcast_announcement()`. |
| 21 | Recherche et filtrage | `search_students()` (11 critères, `security invoker` donc cloisonnée) + filtres/tri/pagination du composant `DataTable`. |
| 22 | Rapports | 6 rapports + synthèse, export **PDF** (impression navigateur) et **Excel/CSV** (UTF-8 BOM, séparateur `;`). |
| 23 | Sécurité hiérarchique | RLS sur toutes les tables ; chaque RPC vérifie le rôle et le périmètre avant d'agir. |
| 24 | État initial vide | Aucune insertion automatique ; messages « plateforme vierge » sur les tableaux de bord. |
| 25 | Hiérarchie | Reflétée dans le schéma, les policies, la navigation et les rapports. |

---

## Ordre de mise en route

La plateforme démarre vide. Le ministère construit la structure dans cet ordre :

1. **Wilayas** — code, nom, direction, contact, puis le compte de direction.
2. **Modes de formation** — import des 5 modes officiels ou saisie manuelle.
3. **Filières** puis **programmes** — structure semestrielle, modules, documents, publication.
4. **Établissements** — type, wilaya, directeur, puis le compte administrateur.
5. **Règlement pédagogique** — seuils et décision applicable en cas d'échec au rattrapage.

L'établissement prend ensuite le relais : spécialités → classes → sections → matières →
comptes professeurs et étudiants.

## Nombre de wilayas

**Aucune liste ni aucun nombre de wilayas n'est codé dans la plateforme.** La table
`wilayas` est vide à l'installation ; le ministère crée exactement celles dont il a
besoin, avec le code et le libellé de son choix. Le découpage administratif peut donc
évoluer sans aucune modification du code ni migration de base : il suffit d'ajouter,
de renommer ou de désactiver une wilaya depuis `/ministere/wilayas`.

## Règles académiques

Le moteur applique le règlement le plus spécifique disponible :

```
établissement  ›  wilaya  ›  national  ›  valeurs neutres par défaut
```

Les valeurs par défaut (aucun règlement enregistré) sont volontairement prudentes :
validation à 10/20, rattrapage à 10/20, **aucune exclusion automatique** — la décision
reste manuelle tant que l'administration n'a rien configuré.

## Tests

- `db/migrations/` : les 18 migrations sont appliquées et vérifiées sur PostgreSQL 16
  (structure, moteur de calcul, cloisonnement RLS entre wilayas et entre rôles).
- `.smoke/` : harnais de rendu hors ligne — 48 rendus de pages et 40 parcours interactifs
  (ouverture des formulaires, filtres, tri, recherche) exécutés dans Chromium headless.

```bash
npx vite --config .smoke/vite.config.js   # puis ouvrir http://localhost:5199/
```

---

## PWA et affichage multi-supports

L'application est installable sur ordinateur, tablette et téléphone.

| Élément | État |
| --- | --- |
| Manifeste | `public/manifest.webmanifest` — analysé sans erreur par Chromium, mode `standalone`, raccourcis vers les espaces Ministère / Direction / Établissement / Connexion |
| Icônes | 192, 512, 512 maskable, apple-touch 180, favicon SVG |
| Service worker | `public/sw.js` — activé, portée `/` |
| Coquille hors ligne | Navigation en réseau d'abord, repli sur `index.html` en cache : l'application se charge sans réseau, y compris sur une route profonde |
| Cache des assets | Réchauffé dès la première visite (la page transmet au SW les fichiers chargés avant sa prise de contrôle), plafonné à 60 entrées |
| Appels API | Jamais interceptés ni mis en cache — les données restent toujours celles du serveur |

### Mesures d'affichage

Audit automatisé (`.smoke/responsive.js`, Chromium headless) sur sept largeurs :

| Largeur | Débordement horizontal | Cibles tactiles < 32px |
| --- | --- | --- |
| 320 × 568 (petit téléphone) | 0 | 0 |
| 360 × 740 | 0 | 0 |
| 390 × 844 | 0 | 0 |
| 412 × 915 | 0 | 0 |
| 768 × 1024 (tablette portrait) | 0 | 0 |
| 1024 × 768 (tablette paysage) | 0 | 0 |
| 1440 × 900 (ordinateur) | 0 | 0 |

Comportement selon la largeur :

- **≤ 980px** — barre latérale en tiroir (bouton menu, fond cliquable, `Échap`), tableaux
  défilables horizontalement, filtres empilés sur toute la largeur.
- **641 → 980px (tablette)** — contenu pleine largeur, indicateurs sur une grille plus large.
- **981 → 1180px (tablette paysage, petit portable)** — barre latérale fixe, grilles resserrées.
- **> 1180px** — mise en page complète.
- Encoches et barres système prises en compte via `env(safe-area-inset-*)`, y compris en
  mode application installée.

```bash
npx vite --config .smoke/vite.config.js    # harnais
node <chemin>/responsive.js                # audit multi-viewports
```


---

## Architecture

Aucune dépendance à un fournisseur : la plateforme tourne sur PostgreSQL standard
et un environnement d'exécution Node.

```
Navigateur
   │  cookie httpOnly (JWT signé, révocable)
   ▼
Fonctions serverless  api/
   │  ├── auth/[action]   connexion, inscription, session, mot de passe
   │  ├── db              requêtes de données (remplace PostgREST)
   │  ├── rpc             fonctions PostgreSQL exposées, sur liste blanche
   │  ├── storage         dépôt, liens signés, téléchargement
   │  └── email           envoi d'un document administratif
   │
   │  BEGIN; set_config('request.jwt.claim.sub', <identité vérifiée>, true);
   │         set local role app_authenticated;
   ▼
PostgreSQL — Row Level Security
   └── 32 tables, politiques par rôle et par périmètre
```

### Ce que le remplacement de Supabase a changé

| | Avant | Après |
| --- | --- | --- |
| Identité | Clé anonyme dans le navigateur, JWT posé par le client | Cookie `httpOnly` ; l'identité est posée par le serveur à partir d'un jeton vérifié |
| Vol de session par XSS | Jeton lisible en JavaScript | Jeton illisible en JavaScript |
| Révocation | À l'expiration du jeton | Immédiate — chaque requête vérifie la session en base |
| Surface réseau | Hôte tiers dans la CSP (`connect-src`) | `connect-src 'self'` — aucune origine externe |
| Poids du client | +201 Ko de `supabase-js` | Client maison, ~6 Ko |
| Portabilité | Liée à un fournisseur | Toute base PostgreSQL 14+ |

### Défense en profondeur

L'autorisation est appliquée à quatre niveaux indépendants :

1. **Interface** — la navigation et les écrans s'adaptent au rôle (confort, pas sécurité).
2. **API** — liste blanche des fonctions appelables, tables système inaccessibles,
   écritures refusées sans session.
3. **Privilèges PostgreSQL** — le rôle applicatif ne possède aucune table et n'a
   aucun droit sur le schéma `auth`.
4. **Row Level Security** — dernier mot sur chaque ligne, y compris si les trois
   couches précédentes étaient contournées.

### Contrôles d'authentification

| Contrôle | Mise en œuvre |
| --- | --- |
| Hachage des mots de passe | bcrypt (`pgcrypto`, coût 10) |
| Politique de mot de passe | 10 caractères, lettre + chiffre, ni identifiant ni mot de passe courant — appliquée **en base**, donc valable pour l'API comme pour un script |
| Limitation du débit | 20 tentatives/IP et 10/compte par quart d'heure |
| Verrouillage | 15 minutes après 8 échecs consécutifs |
| Énumération de comptes | Message et temps de réponse identiques qu'un compte existe ou non |
| Élévation par inscription | Seuls `student` et `teacher` sont acceptés à l'auto-inscription |
| Changement de mot de passe | Exige le mot de passe actuel et révoque toutes les autres sessions |
| Journalisation | Chaque tentative, réussie ou non, avec IP et agent |

### Fichiers déposés

Les pièces jointes proviennent d'utilisateurs : elles ne sont jamais servies comme
du contenu actif.

- Types de fichiers restreints par bucket (le dépôt d'un `text/html` est refusé) ;
- `Content-Disposition: attachment` et `X-Content-Type-Options: nosniff` au téléchargement ;
- liens signés valables 5 minutes, portant l'identité du demandeur — la vérification
  RLS est refaite au téléchargement, un lien ne confère donc aucun droit propre.
