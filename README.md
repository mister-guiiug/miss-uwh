# Miss UWH — Bilan comptable d'un club de Hockey Subaquatique

PWA mobile-first qui **remplace le classeur Excel de gestion comptable
saisonnière** d'une association sportive de Hockey Subaquatique (UWH — _Under
Water Hockey_). Journal comptable, recettes/dépenses par catégorie, résultat par
événement, clôture de saison verrouillée, justificatifs, audit, exports.

- **Démo / app** : https://mister-guiiug.github.io/miss-uwh/ _(100 % local, hors ligne, installable)_
- **Code** : https://github.com/mister-guiiug/miss-uwh
- Membre de la famille de PWA `miss-*` / `mister-*` (React 19 + Vite + Tailwind v4).

> Conçu à partir d'un classeur réel (`Bilan comptable 2025-2026.xlsx`, club
> _Clermont Hockey Sub_) : synthèse bilan, journal `Compte`, 24 sous-feuilles de
> catégories R1–R9 / D1–D13, et l'onglet `Evolution` multi-saisons.

---

## 1. Vision produit

Donner au **trésorier** d'un petit club un outil aussi souple qu'un tableur mais
**fiable, traçable et partageable** :

- saisie d'écritures en quelques secondes sur mobile, **solde recalculé en temps réel** ;
- **bilan de saison automatique** (totaux par catégorie, solde créditeur, résultat
  d'exploitation, trésorerie) — fini les formules cassées ;
- **suivi par événement** (Tournoi des Arvernes, Buvette, stages, championnat) avec
  résultat net ;
- **clôture de saison verrouillée** et report du reliquat sur la saison suivante ;
- **transparence et contrôle** : audit complet, suppression logique réversible,
  rôles (trésorier, président, contrôleur…) avec sécurité côté serveur ;
- **migration immédiate depuis l'Excel existant** et exports PDF/CSV/Excel pour
  l'assemblée générale.

Principe directeur : **local-first** (l'app marche seule, hors ligne, gratuitement
sur GitHub Pages) avec une **montée en sécurité optionnelle via Supabase**
(multi-utilisateurs, RBAC serveur, MFA, audit serveur, justificatifs chiffrés).

---

## 2. Architecture

```
┌──────────────────────────── Frontend (GitHub Pages, statique) ───────────────────────────┐
│  React 19 + TypeScript strict + Vite 7 + Tailwind v4 + vite-plugin-pwa (offline)          │
│                                                                                            │
│  features/        bilan · journal · categories · seasons · audit · settings · import      │
│  shared/lib/      engine.ts (moteur comptable PUR & testé) · categories · schema(zod)     │
│  store/           useAppStore (Zustand) — point unique de persistance + audit             │
│  backend/config   VITE_BACKEND = local | supabase  (switch)                               │
└───────────────┬───────────────────────────────────────────────────────────┬──────────────┘
                │ mode local (défaut)                                         │ mode supabase
        ┌───────▼─────────┐                                        ┌──────────▼───────────────┐
        │ localStorage    │                                        │ Supabase (eu-central-1)  │
        │ enveloppe       │                                        │  Postgres + RLS (RBAC)   │
        │ versionnée +    │                                        │  Auth + MFA (TOTP)       │
        │ migrations zod  │                                        │  Storage privé (PJ)      │
        └─────────────────┘                                        │  Triggers d'audit        │
                                                                   └──────────────────────────┘
```

- **Pourquoi local-first ?** GitHub Pages ne sert que du statique : une PWA locale
  fonctionne immédiatement, gratuitement, hors ligne, sans donnée qui sort de
  l'appareil. Parfait pour un club mono-trésorier.
- **Pourquoi Supabase pour la sécurité ?** Les exigences RBAC strict _deny-by-default_,
  MFA, audit séparé, protection des accès horizontaux/verticaux, justificatifs
  sécurisés et verrouillage de clôture **ne peuvent pas être garanties par un
  bundle statique** : elles exigent un serveur. Supabase (Postgres + **RLS** +
  **Auth/MFA** + **Storage** + Edge Functions) applique tout cela **côté serveur**.
  La clé `anon` publiée dans le bundle est inoffensive car chaque table est
  protégée par RLS, jamais par le client.
- **Moteur comptable pur** (`src/shared/lib/engine.ts`) : aucune dépendance UI ni
  réseau, 100 % testé — la logique métier est identique en local et en serveur.

**Stack** : React 19, TypeScript ~6 strict (ES2025), Vite 7, Tailwind v4
(`@tailwindcss/vite`), Vitest 3, vite-plugin-pwa, Zustand, Zod, lucide-react,
`@supabase/supabase-js`. Conventions partagées via `@mister-guiiug/dev-wpa-config`.

---

## 3. Modèle de données

Types : [`src/shared/types/domain.ts`](src/shared/types/domain.ts) · Validation zod :
[`schema.ts`](src/shared/lib/schema.ts) · Schéma SQL : [`supabase/migrations/0001_schema.sql`](supabase/migrations/0001_schema.sql).

| Entité           | Champs clés                                                                                                                                                                                                              | Règles                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| **Club**         | `name`, `affiliation`, `treasurer`                                                                                                                                                                                       |                        |
| **Season**       | `label` (« 2025-2026 »), `startDate`, `endDate`, `status` (ouverte/clôturée), `openingBalance` (reliquat), `closingBalance`, `lockedAt/By`, `reopenedAt`, `reopenReason`                                                 | 1, 5, 6, 7             |
| **Category**     | `code` (R1…R9, D1…D13, R-INT, R-COMP, R-REG, D-COMP, D-REG), `label`, `sens` (recette/dépense), `kind` (exploitation/compensee/regularisation/transfert), `components[]`                                                 | 2, 11                  |
| **JournalEntry** | `seasonId`, `categoryCode`, `date`, `label`, `sens` (crédit/débit), `amount` (> 0), `method`, `pieceRef`, `invoiceCode`, `eventId`, `components{}`, `attachments[]`, `version`, `deletedAt/By`, `createdBy`, `updatedBy` | 2, 3, 8, 9, 13, 14, 15 |
| **EventLedger**  | `seasonId`, `name`, `kind` (tournoi/buvette/stage/autre)                                                                                                                                                                 | 10                     |
| **Attachment**   | `entryId`, `name`, `mime`, `size`, `storagePath` (Supabase) / `dataUrl` (local)                                                                                                                                          | 15                     |
| **AuditEvent**   | `ts`, `actor`, `action`, `category` (**métier** vs **sécurité**), `targetType/Id`, `summary`, `before`, `after`                                                                                                          | 13, 14                 |

**Invariants comptables clés** (démontrés par les tests `engine.test.ts`) :

- `solde courant(n) = reliquat + Σ montants signés des écritures ≤ n` _(crédit +, débit −)_.
- `solde créditeur = total recettes (reliquat inclus) − total dépenses` → **égal à la
  trésorerie de clôture** : les écritures **compensées** (gratuité de piscine
  valorisée en recette ET en dépense, 28 341,50 €) gonflent les deux totaux mais
  **s'annulent** dans le solde.
- `résultat d'exploitation = recettes − dépenses d'exploitation`, **hors** compensées,
  régularisations et transferts.
- `résultat d'un événement = recettes − dépenses rattachées` (ex. TDA 2026 : 4 350 −
  4 064,75).
- Reliquat d'ouverture(N+1) ← solde de clôture(N), reporté explicitement.

---

## 4. Cas d'usage par rôle

| Rôle                          | Parcours principal                                                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Trésorier**                 | Saisir/modifier des écritures, rapprocher avec le relevé, joindre les pièces, clôturer la saison, exporter le bilan AG. |
| **Trésorier adjoint**         | Mêmes droits comptables que le trésorier (suppléance), sans clôture/validation.                                         |
| **Président**                 | Consulter, **valider/clôturer** la saison, autoriser une réouverture exceptionnelle.                                    |
| **Responsable événement**     | Saisir les écritures rattachées à « son » événement (buvette, TDA) et suivre son résultat net.                          |
| **Responsable matériel**      | Saisir achats (D4) et ventes (R7) de matériel.                                                                          |
| **Contrôleur / vérificateur** | **Lecture seule de tout**, y compris l'audit sécurité ; vérifie sans pouvoir modifier.                                  |
| **Membre**                    | Consultation transparente du bilan et du journal.                                                                       |
| **Admin technique**           | Gestion des membres/rôles, paramétrage, réouverture de saison, accès à tous les logs.                                   |

---

## 5. Rôles & permissions (RBAC)

Modèle **deny-by-default**, appliqué **côté serveur** par les politiques RLS
([`0002_rls.sql`](supabase/migrations/0002_rls.sql)). Aucune ligne n'est lisible ou
écrivable sans politique explicite (`force row level security` sur chaque table).

| Rôle                | Lire compta | Écrire compta                  | Clôture / validation | Audit sécurité | Gérer membres |
| ------------------- | :---------: | ------------------------------ | :------------------: | :------------: | :-----------: |
| `admin_technique`   |      ✔      | ✔                              |          ✔           |       ✔        |       ✔       |
| `tresorier`         |      ✔      | ✔                              |          ✔           |       —        |       —       |
| `tresorier_adjoint` |      ✔      | ✔                              |          —           |       —        |       —       |
| `president`         |      ✔      | —                              |          ✔           |       —        |       —       |
| `resp_evenement`    |      ✔      | écritures liées à un événement |          —           |       —        |       —       |
| `resp_materiel`     |      ✔      | catégories D4 / R7             |          —           |       —        |       —       |
| `controleur`        |      ✔      | —                              |          —           |       ✔        |       —       |
| `membre`            |      ✔      | —                              |          —           |       —        |       —       |

Protections :

- **Accès vertical** (élévation de privilège) : chaque opération vérifie le rôle via
  des fonctions `SECURITY DEFINER` (`app_roles()`, `app_can_write_accounting()`…).
- **Accès horizontal** : périmètre limité au club ; `resp_evenement`/`resp_materiel`
  ne peuvent écrire que dans leur domaine (event lié / catégories D4-R7).
- **Suppression** : aucune politique `DELETE` accordée → **suppression uniquement
  logique** (`deleted_at`), réversible et tracée.
- **Verrou de clôture** : trigger `enforce_season_lock` refuse toute écriture sur une
  saison clôturée, en plus des politiques.

En mode **local**, l'app applique les mêmes garde-fous fonctionnels (verrou de
clôture, suppression logique, audit) côté client — la vraie sécurité multi-acteurs
nécessite le mode Supabase.

---

## 6. Sécurité, audit & conformité

- **Authentification** : Supabase Auth (email + mot de passe), **MFA TOTP** activable
  et imposée pour les rôles sensibles (`mfa_required`, AAL2).
- **Audit complet & séparé** : deux tables _append-only_ alimentées par triggers
  `SECURITY DEFINER` — `audit_metier` (créations/modifications d'écritures, reports de
  reliquat) et `audit_securite` (connexions, suppressions, clôtures/réouvertures,
  exports). Seuls `admin_technique` et `controleur` lisent l'audit sécurité.
- **Historisation** : `version` incrémentée à chaque modification + diff `before/after`
  conservé dans l'audit.
- **Clôture / réouverture** : verrouillage au gel du solde ; **réouverture
  exceptionnelle avec motif obligatoire**, tracée en audit sécurité.
- **Justificatifs** : bucket Supabase **privé** `justificatifs`, politiques d'accès par
  rôle ; en local, fichiers en data URL (rester léger).
- **Données UE / RGPD** : région Supabase **Frankfurt (eu-central-1)** recommandée.
- **Validation défensive** : front ET back rejouent les mêmes règles
  ([`entryValidation.ts`](src/features/journal/entryValidation.ts) + contraintes SQL
  `check (amount > 0)`, FK catégories, triggers). Jamais de confiance au client.

Détails et mise en place : [`supabase/README.md`](supabase/README.md).

---

## 7. Écrans (wireframes)

Mobile-first, bottom-nav 5 onglets, utilisable aussi sur desktop (max-width 2xl).

- **Bilan** — KPI (recettes, dépenses, solde créditeur, résultat d'exploitation),
  trésorerie, recettes/dépenses par catégorie, **résultat par événement**, bouton PDF.
- **Journal** — liste chronologique inversée avec **solde courant**, recherche
  multicritères, filtre recette/dépense, feuille de saisie/édition.
- **Saisie d'écriture** (bottom sheet) — catégorie (sens déduit), date, montant,
  libellé, mode de règlement, n° pièce, code facture, **événement**, **composantes
  tarifaires** (inscriptions/licences/assurances), observation, **pièces jointes**.
- **Catégories** — totaux et statut « à compléter » par catégorie, détail des écritures.
- **Saisons** — liste, activation, **clôture/verrouillage**, **réouverture** (motif),
  **report du reliquat**, comparaison des soldes.
- **Audit** — onglets Tout / Métier / Sécurité, **corbeille** d'écritures supprimées
  (restaurables).
- **Réglages** — club, affichage, **statut backend**, exports (Journal/Bilan CSV,
  sauvegarde JSON, PDF), **import Excel**, restauration, réinitialisation.

```
┌─ Bilan ───────────────┐   ┌─ Journal ─────────────┐   ┌─ Saisie ──────────────┐
│ Clermont Hockey Sub   │   │ 26 écritures   [+]    │   │ Catégorie [R1 ▾]      │
│ ┌─────────┐┌────────┐ │   │ 🔍 …        [Tout ▾]  │   │ Sens: ● Crédit        │
│ │Recettes ││Dépenses│ │   │ ─────────────────────  │  │ Date [..]  Montant[..] │
│ │43 499 € ││34 109 €│ │   │ Buvette Stripe +807 € │   │ Libellé [...........] │
│ └─────────┘└────────┘ │   │   solde 9 390 €       │   │ Mode [Virement ▾]     │
│ ┌─────────┐┌────────┐ │   │ Bourriches TDA −1200 €│   │ Événement [TDA ▾]     │
│ │Solde   +││Résultat│ │   │   solde 8 583 €       │   │ Composantes […]       │
│ │9 390 €  ││7 026 € │ │   │ …                     │   │ 📎 Pièces  [Ajouter]   │
│ └─────────┘└────────┘ │   │                       │   │ [Supprimer] [Ajouter] │
│ Recettes par catégorie│   │                       │   │                       │
│ Dépenses par catégorie│   └───────────────────────┘   └───────────────────────┘
│ Résultat / événement  │
└───────────────────────┘
   Bilan · Journal · Catégories · Saisons · Réglages
```

---

## 8. Backlog MVP → Roadmap V2

**MVP (livré dans ce dépôt)**

- [x] Moteur comptable pur & testé (solde courant, bilan, événements, compensées).
- [x] Journal : saisie/édition/suppression logique, solde courant, recherche/filtre.
- [x] Catégories R1–R9 / D1–D13 + composantes (inscriptions, licences, assurances).
- [x] Bilan automatique (totaux, solde créditeur, résultat d'exploitation, trésorerie).
- [x] Multi-saisons : création, clôture/verrouillage, réouverture, report du reliquat.
- [x] Audit local (métier/sécurité), corbeille restaurable, historisation (version).
- [x] **Migration Excel** (feuille `Compte`) + jeu d'exemples réaliste 2025-2026.
- [x] Exports CSV (journal & bilan), sauvegarde JSON, PDF (impression).
- [x] PWA installable / hors ligne, FR, accessible (focus, aria, tactile ≥ 44px).
- [x] Backend Supabase : schéma, **RLS RBAC**, audit serveur, storage, triggers.

**V2 (roadmap)**

- [ ] Adaptateur de données Supabase (lecture/écriture temps réel, remplace `storage.ts`).
- [ ] Connexion + MFA in-app, gestion des membres et des rôles (UI admin).
- [ ] Upload des justificatifs vers le bucket privé + visionneuse.
- [ ] Rapprochement bancaire (import CSV de relevé, pointage).
- [ ] Détail des inscriptions par adhérent + tableau effectifs.
- [ ] Export Excel multi-feuilles (réplique du classeur d'origine) via SheetJS.
- [ ] Comparateur multi-saisons (graphes `Evolution`).
- [ ] Budget prévisionnel vs réalisé ; alertes « catégorie à compléter ».
- [ ] Tests e2e Playwright ; signatures/horodatage des clôtures.

---

## 9. Exemples d'API (mode Supabase)

L'API est l'API REST **PostgREST** auto-générée par Supabase, **arbitrée par RLS**
(une API GraphQL via `pg_graphql` est aussi disponible). Toutes les requêtes portent
le JWT de session ; les droits sont appliqués côté serveur.

```ts
// Authentification (+ MFA TOTP pour les rôles sensibles)
await supabase.auth.signInWithPassword({ email, password });
await supabase.auth.mfa.challengeAndVerify({ factorId, code });

// Lire le journal d'une saison (RLS : seuls les membres du club voient les lignes)
const { data } = await supabase
  .from('entries')
  .select('id,date,label,sens,amount,category_code,event_id')
  .eq('season_id', seasonId)
  .is('deleted_at', null)
  .order('date');

// Créer une écriture (RLS check : write accounting ; trigger : audit + verrou clôture)
await supabase.from('entries').insert({
  season_id: seasonId,
  category_code: 'R1',
  date: '2025-09-10',
  label: 'HelloAsso inscriptions',
  sens: 'credit',
  amount: 647,
  method: 'helloasso',
});

// Suppression LOGIQUE (jamais de DELETE physique → refusé par RLS)
await supabase
  .from('entries')
  .update({ deleted_at: new Date().toISOString() })
  .eq('id', id);

// Clôturer une saison (UPDATE status ; trigger journalise en audit_securite)
await supabase
  .from('seasons')
  .update({
    status: 'cloturee',
    closing_balance: 9390.46,
    locked_at: new Date().toISOString(),
  })
  .eq('id', seasonId);

// Justificatif → bucket privé
await supabase.storage
  .from('justificatifs')
  .upload(`${entryId}/${file.name}`, file);
```

Équivalent HTTP (PostgREST) :

```http
GET  /rest/v1/entries?season_id=eq.<id>&deleted_at=is.null&select=*
POST /rest/v1/entries           Authorization: Bearer <jwt>   {...}
PATCH /rest/v1/seasons?id=eq.<id>   { "status": "cloturee" }
```

---

## 10. Stratégie de migration depuis l'Excel

Mapping **pur et testé** : [`compteMapping.ts`](src/features/import/compteMapping.ts)
(+ [tests](src/features/import/compteMapping.test.ts)). Lecture du `.xlsx` via SheetJS
chargé **à la demande depuis le CDN** (pas embarqué dans le bundle).

1. On lit la feuille **`Compte`** (le journal) — colonnes `ORDRE · DATE · LIBELLE ·
CODE FACTURE · MODE RGLT · N° PIECE · DEBITS · CREDIT · SOLDE · OBS`.
2. La **catégorie** est déduite du **préfixe d'`ORDRE`** : `R8 Divers 3` → `R8`,
   `D10 Inscrip 2` → `D10`, `Formation 1` → `D11`, `Comm 2` → `D13` (les codes
   `D10`–`D13` sont testés avant `D1`–`D9`).
3. La ligne **`ANCIEN SOLDE`** fournit le **reliquat d'ouverture**.
4. `CREDIT > 0` → écriture **crédit** (recette) ; sinon **débit** (dépense). Le **mode
   de règlement** est normalisé (PRLV→prélèvement, VRT/VIR→virement, chèque, HelloAsso,
   Stripe, SumUp, Monetico/CB→carte…).
5. Les lignes non reconnues sont **signalées** (warnings) sans bloquer l'import.
6. Dans l'app : _Réglages → Importer un Excel_ → aperçu (n° écritures, reliquat,
   avertissements) → **ajout à la saison active**.

> Les sous-feuilles de catégories (composantes d'inscriptions, grilles d'assurances)
> et l'onglet `Evolution` sont modélisés et prêts ; leur import détaillé est prévu en V2.

---

## 11. Développement

```bash
# auth GitHub Packages (config partagée @mister-guiiug/dev-wpa-config)
export NODE_AUTH_TOKEN="$(gh auth token)"

npm install
npm run dev            # http://localhost:5196
npm test               # Vitest (moteur, validation, mapping)
npm run lint           # ESLint (flat config famille)
npm run format         # Prettier (CI exige --check)
npm run build          # tsc -b + vite build + PWA
npm run icons          # régénère les icônes PWA depuis public/icons/icon.svg
```

Backend optionnel : copier `.env.example` → `.env`, renseigner `VITE_BACKEND=supabase`

- URL/clé, puis `npm run supabase:push` (voir [`supabase/README.md`](supabase/README.md)).

Déploiement : push sur `main` → workflows famille `pwa-ci` + `pwa-deploy` → GitHub Pages
(`base = /miss-uwh/`, HashRouter).

---

## Liens

[Code source](https://github.com/mister-guiiug/miss-uwh) ·
[Soutenir (Buy Me a Coffee)](https://buymeacoffee.com/mister.guiiug) · Licence MIT.
