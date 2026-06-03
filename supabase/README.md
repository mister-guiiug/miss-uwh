# Backend Supabase — Miss UWH

Le mode `supabase` transforme l'app local-first en application **multi‑utilisateurs
sécurisée** : authentification, **RBAC côté serveur (RLS)**, **MFA** pour les rôles
sensibles, **audit serveur** (logs métier/sécurité séparés), **stockage chiffré**
des justificatifs et **verrouillage de clôture**. Le frontend reste hébergé sur
GitHub Pages ; la clé `anon` publiée dans le bundle est inoffensive car **toute la
sécurité est appliquée ici**, jamais par le client.

## Mise en place

1. Créer un projet Supabase (région **eu-central-1 / Frankfurt** recommandée — RGPD).
2. Appliquer les migrations dans l'ordre :
   ```bash
   supabase link --project-ref <ref>
   supabase db push        # 0001_schema → 0002_rls → 0003_seed
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

## Étape suivante (adaptateur de données)

Les migrations ci‑dessus fournissent le **schéma et la sécurité**. Le branchement
complet lecture/écriture de l'app sur Supabase (remplacement de la couche
`storage.ts` locale par un repository Supabase) est la première tâche de la V2 —
le contrat `loadData/saveData/importEntries` a été conçu pour cela (cf. README
racine, backlog).
