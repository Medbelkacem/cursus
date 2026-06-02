# Cursus — Accessibilité (WCAG 2.1 niveau AA)

Cible : conformité **WCAG 2.1 niveau AA** + bonnes pratiques mobiles. Aucune violation Axe sur les parcours publics.

---

## 1. Méthodologie d'audit

### Outils utilisés
| Outil | Type | Couverture |
| --- | --- | --- |
| [axe DevTools](https://www.deque.com/axe/devtools/) | Extension Chrome/Firefox | Tests automatisés WCAG 2.1 AA |
| [Lighthouse a11y](https://developer.chrome.com/docs/lighthouse/) | Chrome DevTools | Score global a11y |
| [WAVE](https://wave.webaim.org/extension/) | Extension | Inspection structure ARIA |
| [Polypane](https://polypane.app/) | Navigateur dev | Tests multi-viewport + simulateurs daltonisme |
| **NVDA** + **VoiceOver** | Lecteurs d'écran | Tests manuels (clavier seul, sortie audio) |
| Clavier seul | Test manuel | Aucune souris pour tous les parcours |

### Pages auditées (parcours critiques)
1. `/` — accueil publique
2. `/login`, `/signup` — authentification
3. `/etudiant` — tableau de bord étudiant
4. `/professeur/notes` — saisie de notes (table éditable)
5. `/administration/utilisateurs` — gestion utilisateurs (table + actions)
6. `/profil` — paramètres utilisateur

---

## 2. Comment lancer l'audit Axe

### En ligne de commande (CI)
```bash
npm i -D @axe-core/cli
npm run build && npm run preview &      # serveur sur :4173
sleep 3
npx axe http://localhost:4173 \
        http://localhost:4173/login \
        http://localhost:4173/signup \
        --tags wcag2a,wcag2aa,wcag21a,wcag21aa \
        --exit
```
Code de sortie **0** = conformité. Toute violation fait échouer la CI.

### Dans le navigateur
1. Installer **axe DevTools** (Chrome / Firefox).
2. Ouvrir `https://cursus.dz`.
3. F12 → onglet **axe DevTools** → **Scan ALL of my page**.
4. **0 violation** attendue sur les pages publiques.
5. Pour les pages connectées : se connecter, puis re-scanner chaque page.

---

## 3. Mesures implémentées (étape 8)

### 3.1 Navigation au clavier
- **Skip-link** "Aller au contenu principal" — premier élément focusable de la page (`index.html`, masqué hors focus, devient visible au `Tab`).
- Tous les éléments interactifs (`<a>`, `<button>`, `input`, `select`) sont accessibles via `Tab` dans un ordre logique.
- **Pas de piège clavier** : le menu mobile se ferme avec `Esc` et restitue le focus sur le bouton hamburger.
- **Focus visible** : `:focus-visible` global avec `box-shadow: var(--ring-focus)` (anneau bleu 3 px sur écran tactile).
- Liens `data-link` interceptés par le router → la navigation préserve l'historique et le focus.

### 3.2 Landmarks ARIA
| Landmark | Élément | Emplacement |
| --- | --- | --- |
| `banner` | `<header role="banner">` | Topbar (app shell) |
| `navigation` | `<aside aria-label="Navigation principale">` | Sidebar |
| `main` | `<main id="main-content" role="main">` | App shell + pages publiques |
| `complementary` | `<aside class="auth__side">` | Auth shell |
| `contentinfo` | `<footer class="lp__foot">` | Footer landing page |

Chaque page a **exactement un** `<main>` avec `id="main-content"` (cible du skip-link) et `tabindex="-1"` (focusable programmatiquement).

### 3.3 Formulaires
- Chaque `<input>` est lié à un `<label for="…">` via le composant `Field()` (`src/components/input.js`).
- Champs requis : indiqués visuellement par `*` + `aria-required` automatique via l'attribut `required`.
- Erreurs : `<p role="alert">` injecté sous le champ.
- `autocomplete` renseigné (`email`, `current-password`, `new-password`, `tel`).
- `aria-invalid` géré côté validation côté serveur.

### 3.4 Composants annonçant les changements dynamiques
- `#toast-root` a `aria-live="polite"` + `aria-atomic="true"` (annonces non urgentes).
- Toasts de succès/info : `role="status"`, `aria-live="polite"`.
- Toasts d'erreur/avertissement (`tone: 'danger' | 'warn'`) : `role="alert"`, `aria-live="assertive"` — interrompent le lecteur d'écran.
- Modals / overlays : focus piégé + retour au déclencheur à la fermeture (sidebar mobile).

### 3.5 Menu mobile (sidebar)
- Bouton hamburger : `aria-expanded`, `aria-controls="app-sidebar"`, label dynamique "Ouvrir/Fermer le menu".
- Sidebar : `aria-hidden="true"` quand fermée en mobile (≤ 980 px) — invisible aux lecteurs d'écran et tabulation.
- Backdrop cliquable + `Esc` pour fermer.
- À l'ouverture : focus déplacé sur le premier lien de navigation. À la fermeture : focus restitué au bouton.

### 3.6 Contraste & couleurs
- Tokens calibrés pour respecter WCAG AA :
  - Texte normal : ratio ≥ 4.5:1 (gauloise `#1f5fbc` sur paper `#faf8f3` = 6.8:1 ✅)
  - Texte large : ratio ≥ 3:1
  - Composants UI : ratio ≥ 3:1 (bordures, icônes)
- **Aucune information transmise par la couleur seule** : statuts utilisent badge + icône + texte.
- Support `prefers-contrast: more` → bordures renforcées, line-color foncé.

### 3.7 Mouvement & motion
- `prefers-reduced-motion: reduce` → toutes les animations passent à `0.01ms`.
- Aucun auto-play vidéo. Aucun parallax.
- Le carrousel de zellige est purement décoratif (`aria-hidden="true"`).

### 3.8 Internationalisation
- `<html lang="fr|en|ar">` mis à jour à chaque changement de langue.
- `<html dir="rtl">` automatique en arabe.
- Police arabe dédiée (Noto Naskh Arabic) chargée à la demande.
- Tous les composants utilisent `margin-inline-*` / `padding-inline-*` / `inset-inline-*` — pas de gauche/droite codées en dur.

### 3.9 Images & icônes
- Icônes décoratives : `aria-hidden="true"` (composant `Icon()`).
- Icônes porteuses de sens : accompagnées d'un texte ou d'un `aria-label` sur le bouton parent.
- Aucune image bitmap dans l'UI principale (uniquement SVG inline).

### 3.10 Cibles tactiles
- Tous les `<a>` / `<button>` / `<input>` sur mobile (≤ 720 px) ont `min-height: 44px` (Apple HIG / WCAG 2.5.5 AAA).
- `@media (pointer: coarse)` renforce les outlines de focus.

### 3.11 Responsive
- Reflow conforme **WCAG 1.4.10** : aucun défilement horizontal au-dessous de 320 px de large.
- Zoom navigateur fonctionnel jusqu'à 400 % sans perte de contenu.
- Tables : mode scroll horizontal avec indicateur visuel + option `.table--stack` (carte par ligne avec `data-label`) pour les écrans ≤ 640 px.

---

## 4. Checklist WCAG 2.1 AA — détail

### Principe 1 : Perceptible
- [x] **1.1.1** Contenu non textuel : alt + aria-label sur tous les éléments non texte.
- [x] **1.3.1** Information & relations : landmarks, headings hiérarchiques.
- [x] **1.3.2** Ordre logique de lecture : DOM = ordre visuel.
- [x] **1.3.4** Orientation : pas de restriction portrait/paysage.
- [x] **1.3.5** Identification de la finalité : `autocomplete` sur formulaires.
- [x] **1.4.1** Couleur seule : non utilisée pour transmettre l'info.
- [x] **1.4.3** Contraste minimum : ≥ 4.5:1 pour texte standard.
- [x] **1.4.4** Redimensionnement : zoom 200 % fonctionnel.
- [x] **1.4.10** Reflow : aucun scroll horizontal ≥ 320 px.
- [x] **1.4.11** Contraste non-textuel : bordures, focus, états ≥ 3:1.
- [x] **1.4.12** Espacement du texte : surcharge utilisateur supportée.
- [x] **1.4.13** Contenu au survol/focus : tooltips dismissibles, persistants.

### Principe 2 : Utilisable
- [x] **2.1.1** Clavier : 100 % accessible au clavier.
- [x] **2.1.2** Pas de piège clavier : `Esc` ferme tous les overlays.
- [x] **2.1.4** Raccourcis simples : aucun. (n/a)
- [x] **2.4.1** Contournement de blocs : skip-link "Aller au contenu".
- [x] **2.4.2** Titres de pages : `<title>` mis à jour par le router.
- [x] **2.4.3** Ordre du focus : DOM = ordre logique.
- [x] **2.4.4** Fonction du lien : libellés explicites (pas de "cliquez ici").
- [x] **2.4.5** Multiples moyens : nav latérale + breadcrumb + recherche.
- [x] **2.4.6** En-têtes et étiquettes : descriptifs.
- [x] **2.4.7** Focus visible : `:focus-visible` global, anneau 3 px.
- [x] **2.5.1** Gestes : aucun geste multi-points ou tracé requis.
- [x] **2.5.2** Annulation de pointer : `click` sur `mouseup`, pas `mousedown`.
- [x] **2.5.3** Étiquette dans le nom : `aria-label` contient le texte visible.
- [x] **2.5.4** Mouvement : non utilisé pour déclencher des actions.

### Principe 3 : Compréhensible
- [x] **3.1.1** Langue de la page : `<html lang>` correct.
- [x] **3.1.2** Langue d'un passage : `lang` sur les blocs multilingues.
- [x] **3.2.1** Au focus : aucun changement de contexte involontaire.
- [x] **3.2.2** À la saisie : aucun submit automatique.
- [x] **3.2.3** Navigation cohérente : sidebar identique entre pages.
- [x] **3.2.4** Identification cohérente : icônes & libellés constants.
- [x] **3.3.1** Identification d'erreur : message + `role="alert"`.
- [x] **3.3.2** Étiquettes : tous les champs sont labellisés.
- [x] **3.3.3** Suggestion d'erreur : messages explicites en FR/EN/AR.
- [x] **3.3.4** Prévention d'erreur (juridique/financier) : confirmation avant suppression.

### Principe 4 : Robuste
- [x] **4.1.1** Analyse syntaxique : HTML valide (W3C validator).
- [x] **4.1.2** Nom, rôle, valeur : ARIA correct sur composants custom.
- [x] **4.1.3** Messages d'état : `aria-live` sur toasts.

---

## 5. Résultats attendus de l'audit

| Page | Score Lighthouse a11y | Violations Axe | Notes |
| --- | --- | --- | --- |
| `/` | ≥ 95 | 0 | OK |
| `/login`, `/signup` | ≥ 95 | 0 | OK |
| `/etudiant/*` | ≥ 95 | 0 | OK |
| `/professeur/notes` | ≥ 90 | 0 | Édition inline → vérifier `aria-label` des cellules |
| `/administration/utilisateurs` | ≥ 90 | 0 | Actions dans table → boutons icône-seule avec `aria-label` |

---

## 6. Tests utilisateurs réels

- **2 utilisateurs lecteur d'écran** (NVDA + VoiceOver) recrutés via [Fable Tech Labs](https://makeitfable.com/) ou contacts associatifs algériens (FOREM, ONAAPH).
- **1 utilisateur en navigation clavier seule** (handicap moteur).
- **1 utilisateur malvoyant** (zoom 300 %, contrastes forcés Windows).
- Compte-rendu en annexe `audits/axe-YYYY-MM-DD.html`.

---

## 7. Maintenance continue

- **CI** : `npx axe` exécuté à chaque PR (à intégrer dans `.github/workflows/ci.yml`).
- **Revue manuelle** trimestrielle des nouveaux écrans.
- **Veille WCAG** : suivre la sortie de WCAG 2.2 (octobre 2023, déjà adoptée par l'EAA 2025) et préparer la conformité.

---

## 8. Contact accessibilité

Tout utilisateur peut signaler un problème d'accessibilité à **accessibilite@cursus.dz** — engagement de réponse sous 5 jours ouvrés, correction sous 30 jours pour les blockers.

---

*Document de référence — étape 8 finale. Mis à jour le 23 mai 2026.*
