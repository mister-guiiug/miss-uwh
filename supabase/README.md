# Backend Supabase — Miss UWH

Le mode `supabase` transforme l'app local-first en application **multi‑utilisateurs
sécurisée** : authentification, **RBAC côté serveur (RLS)**, **MFA** pour les rôles
sensibles, **audit serveur** (logs métier/sécurité séparés), **stockage chiffré**
des justificatifs et **verrouillage de clôture**. Le frontend reste hébergé sur
GitHub Pages ; la clé `anon` publiée dans le bundle est inoffensive car **toute la
sécurité est appliquée ici**, jamais par le client.

## Mise en place

1. Créer un projet Supabase (région **eu-central-1 / Frankfurt** recommandée — RGPD).
2. Appliquer les migrations dans l'ordre (`0001_schema → 0002_rls → 0003_seed → …`) :
   - **Automatique (recommandé)** — le workflow `.github/workflows/supabase-migrations.yml`
     exécute `supabase db push` à chaque fusion sur `main` qui touche
     `supabase/migrations/**` (et au déclenchement manuel). `db push` est
     _forward-only_ : seules les migrations non encore appliquées sont jouées.
     Définir au préalable trois secrets GitHub (Settings → Secrets and variables →
     Actions) : `SUPABASE_ACCESS_TOKEN` (Account → Access Tokens),
     `SUPABASE_PROJECT_ID` (Project Settings → General → Reference ID) et
     `SUPABASE_DB_PASSWORD` (Project Settings → Database).
   - **Manuel** (premier amorçage ou hors CI) :
     ```bash
     supabase link --project-ref <ref>
     supabase db push
     ```
3. **Storage** : créer un bucket **privé** nommé `justificatifs`, puis ré‑exécuter le
   bloc de politiques storage de `0002_rls.sql` (il ne s'active que si le bucket
   existe).
4. **Auth** : activer Email + mot de passe ; activer le **MFA TOTP** (Project →
   Authentication → MFA). Imposer l'AAL2 pour les rôles sensibles via le hook
   d'accès ou en exigeant `mfa_required` côté app.
5. Créer le premier utilisateur (Auth), puis l'enregistrer dans `members` avec le
   rôle `admin_technique` (cf. fin de `0003_seed.sql`).
6. Côté frontend, définir les variables d'environnement :
   ```
   VITE_BACKEND=supabase
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<clé anon>
   ```

## Modèle de rôles (RBAC)

| Rôle                | Lecture |        Écriture compta         | Clôture/validation | Audit sécurité |
| ------------------- | :-----: | :----------------------------: | :----------------: | :------------: |
| `admin_technique`   |    ✔    |               ✔                |         ✔          |       ✔        |
| `tresorier`         |    ✔    |               ✔                |         ✔          |       —        |
| `tresorier_adjoint` |    ✔    |               ✔                |         —          |       —        |
| `president`         |    ✔    |               —                |         ✔          |       —        |
| `resp_evenement`    |    ✔    | écritures liées à un événement |         —          |       —        |
| `resp_materiel`     |    ✔    |       catégories D4 / R7       |         —          |       —        |
| `controleur`        |    ✔    |               —                |         —          |       ✔        |
| `membre`            |    ✔    |               —                |         —          |       —        |

La RLS est **deny‑by‑default** : aucune ligne n'est accessible sans politique
explicite (`force row level security` sur chaque table). Les suppressions sont
**logiques** (aucune politique `DELETE` n'est accordée). La clôture verrouille les
écritures via le trigger `enforce_season_lock`, en plus des politiques.

## Audit

Deux tables append‑only, alimentées par des triggers `SECURITY DEFINER` :
`audit_metier` (création/modification d'écritures, report de reliquat…) et
`audit_securite` (connexions, suppressions, clôtures/réouvertures, exports). Seuls
`admin_technique` et `controleur` lisent `audit_securite`.

## Synchronisation (offline-first)

L'app est **branchée** sur Supabase en mode `supabase`, selon un modèle
offline-first :

- **Pull** à la connexion : `src/backend/sync.ts` `pullAll()` lit clubs / seasons /
  events / entries / audit (arbitrés par RLS) et **hydrate** le store local. Le
  serveur fait foi.
- **Push** des mutations : chaque commit local émet une intention sur `syncBus`
  (`src/backend/syncBus.ts`) ; `sync.ts` la pousse vers Supabase **en série** via
  `supabaseRepository.ts` (upsert idempotent — les ids sont des **UUID** générés
  côté client, donc `on conflict (id)` fait insert OU update). Les triggers
  serveur gèrent version, audit et verrou de clôture.
- **Écritures du journal : concurrence optimiste.** Une création reste un
  upsert. Toute **modification** d'une écriture existante — édition, pointage,
  suppression logique, restauration — part en diff vers la RPC
  `update_entry_checked` (0020, 0021), avec la version que l'appareil a vue.
  La fonction est `security invoker` : son `update` subit la RLS d'`entries`.
  Version périmée → `40001`, hors droits → `42501` ; sinon elle rend la
  nouvelle version, qui devient la version locale. Hors ligne, plusieurs
  modifications de la même écriture fusionnent en un seul envoi.
- **Refus** : un conflit ou un refus de droits n'est jamais rejoué tel quel. Il
  rejoint les opérations refusées (Réglages → État de la base de données), avec
  sa raison et deux gestes : **Garder la version du serveur** (on relit
  l'écriture) ou **Réappliquer ma modification** (on relit la version du
  serveur, on y repose les seuls champs modifiés, puis la RPC repart avec
  elle).
- **Statut** : un bandeau (`SupabaseSync.tsx`) signale « synchronisation… » /
  erreur (avec bouton _Réessayer_). Hors ligne, l'app reste utilisable sur le
  cache local ; pour les entités autres que les écritures, la dernière écriture
  l'emporte.

> ⚠️ Ce chemin est **correct par construction** (mappers purs testés, types
> alignés sur le schéma) mais **n'a pas encore été éprouvé contre un projet
> Supabase réel**. À valider : RLS (un `membre` ne peut pas écrire, un
> `controleur` est en lecture seule, une saison clôturée est verrouillée côté
> serveur), et les interactions avec les triggers `version`/audit.
>
> **Implémenté depuis** : file d'attente hors ligne persistante (`syncQueue.ts`),
> MFA TOTP in-app, admin membres/rôles, et **upload des justificatifs** (bucket
> privé `justificatifs` + table `attachments`, consultation par URL signée — cf.
> `src/backend/attachments.ts`).
>
> **Limite restante** : seules les écritures du journal sont protégées par leur
> version. Saisons, adhérents, récurrences et autres registres restent en
> dernier-écrivain-gagne (upsert UUID).
>
> **Tests pgTAP** (`supabase/tests/`, joués en CI sur une pile jetable par
> `.github/workflows/supabase-tests.yml`) : `occ-droits.test.sql` (0020 — la
> RPC sous la RLS), `occ-champs.test.sql` (0021 — les champs couverts) et
> `suppression-compte.test.sql` (0018).

### Activer le mode Supabase au build (déploiement GitHub Pages)

Vite lit les variables **au build**. Pour un site Pages en mode Supabase :
copier `.env.production.example` → `.env.production` et y mettre
`VITE_BACKEND=supabase` + l'URL + la clé anon (publiques). Sans ces variables, le
site déployé reste en mode `local` (défaut). En local de dev, utiliser un `.env`.
