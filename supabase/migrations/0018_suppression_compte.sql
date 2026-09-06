-- Miss UWH — 0018 — supprimer son compte, soi-même (RGPD art. 17).
--
-- CE QUI EXISTAIT. `wipeLocal` (src/store/slices/systemSlice.ts) vide le
-- MIROIR du navigateur : la file de synchro et les données locales. Le compte
-- Supabase, sa ligne dans `members` et son adresse dans l'audit restaient sur
-- le serveur. Un membre qui quitte le club n'avait donc, pour être effacé,
-- qu'un message à écrire au mainteneur.
--
-- CE QUI EST PERSONNEL ICI, ET CE QUI NE L'EST PAS. Miss UWH tient la
-- comptabilité d'une association : les écritures, les saisons et les pièces
-- sont les livres du CLUB, que celui-ci doit conserver, et non les données du
-- membre qui les a saisies. Ce qui appartient à la personne, c'est son compte
-- d'authentification, sa ligne `members` (adresse, nom affiché, rôles) et son
-- adresse dénormalisée dans les deux journaux d'audit. C'est cela — et cela
-- seul — que cette fonction efface.
--
-- D'OÙ DEUX ISSUES, ET UNE VALEUR DE RETOUR QUI LES DISTINGUE :
--
--   'supprime'  — la ligne `members` n'est référencée nulle part (un membre
--                 en lecture seule, un contrôleur qui n'a rien signé) : elle
--                 part entièrement. Plus une ligne.
--   'anonymise' — elle est référencée par une écriture, une pièce, une
--                 clôture de saison ou une ligne d'audit. La supprimer
--                 lèverait une violation de clé étrangère (`entries.
--                 created_by` et ses voisines sont en NO ACTION), et surtout
--                 emporterait la signature comptable du club. La ligne reste,
--                 vidée de toute donnée personnelle.
--
-- L'application dit laquelle des deux a eu lieu : promettre « plus rien de
-- vous » quand une signature anonyme subsiste serait un mensonge de plus,
-- pas un service.
--
-- POURQUOI ON NE TOUCHE PAS AUX ÉCRITURES. Mettre `entries.created_by` à NULL
-- serait la solution évidente — et elle échouerait. `entries_lock_guard`
-- (0001) lève sur TOUT UPDATE d'une écriture rattachée à une saison clôturée :
-- le trésorier qui a tenu la saison passée, c'est-à-dire précisément celui qui
-- a le plus de raisons de partir, ne pourrait jamais supprimer son compte.
-- Un `on delete set null` sur la clé étrangère ne changerait rien : l'action
-- référentielle est un UPDATE, et déclenche le même trigger.
--
-- POURQUOI `SECURITY DEFINER`. La RLS de 0002 n'ouvre l'écriture sur `members`
-- qu'à `app_is_admin()` : un membre ordinaire ne peut pas modifier sa propre
-- ligne, et personne n'a de politique d'UPDATE sur `audit_metier` ni
-- `audit_securite` (append-only). Quant à `auth.users`, elle est hors de
-- portée du rôle `authenticated`. La fonction s'exécute donc sous son
-- propriétaire, `postgres`.
--
-- ATTENTION — c'est l'attribut BYPASSRLS de `postgres`, et non le
-- `security definer` en lui-même, qui franchit la RLS. 0002 pose
-- `force row level security` sur `members` : sans BYPASSRLS, ce `force`
-- s'appliquerait au propriétaire lui-même et l'anonymisation serait filtrée
-- en silence — zéro ligne modifiée, aucune erreur. L'assertion pgTAP compte
-- donc les lignes, elle ne se contente pas d'un appel qui n'a pas levé.
--
-- L'HYPOTHÈSE QUI RESTAIT À PROUVER SUR CE PARC : qu'une fonction
-- `security definer` appartenant à `postgres` puisse supprimer une ligne
-- d'`auth.users` sur un projet hébergé. Sur Supabase, `postgres` n'est PAS
-- superutilisateur et `auth.users` appartient à `supabase_auth_admin` : le
-- droit de DELETE doit lui avoir été accordé. `supabase/tests/
-- suppression-compte.test.sql` l'imprime et l'éprouve, en CI, sur une pile
-- montée depuis les mêmes migrations. Si ce droit venait à manquer, le repli
-- est l'anonymisation seule (le modèle `anonymize_doctor` de mister-doc) —
-- mais elle laisse un compte derrière elle, donc une adresse connue du
-- service.
--
-- Idempotent : rejouable sans effet de bord.

create or replace function public.delete_my_account()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_member       members;
  v_other_admins int;
  v_other_actifs int;
  v_referenced   boolean := false;
  v_outcome      text := 'supprime';
begin
  -- AUCUNE SESSION : on lève. Filtrer sur un `auth.uid()` nul ne supprimerait
  -- rien ET ne dirait rien — la fonction rendrait « fait » sans avoir rien
  -- fait, ce qui est la pire réponse possible à cette demande-là. 42501 est
  -- le code que la RLS rend ailleurs pour un refus de droit.
  if v_uid is null then
    raise exception 'suppression de compte sans session'
      using errcode = '42501';
  end if;

  select * into v_member from members where auth_id = v_uid;

  if found then
    -- NE PAS ENFERMER LE CLUB DEHORS. Seul `admin_technique` peut activer un
    -- compte et attribuer un rôle (politique `members_admin`, 0002) : si le
    -- dernier administrateur part alors que d'autres membres restent, plus
    -- personne ne peut administrer, jamais.
    --
    -- La garde ne vaut QUE s'il reste quelqu'un à enfermer. Un trésorier seul
    -- de son club — le cas le plus fréquent dans une petite association —
    -- doit pouvoir partir : conditionner le droit à l'effacement à la
    -- désignation d'un successeur serait le refuser.
    if 'admin_technique' = any (v_member.roles) then
      select count(*) into v_other_admins
        from members m
       where m.club_id = v_member.club_id
         and m.id <> v_member.id
         and m.active
         and 'admin_technique' = any (m.roles);

      select count(*) into v_other_actifs
        from members m
       where m.club_id = v_member.club_id
         and m.id <> v_member.id
         and m.active;

      if v_other_admins = 0 and v_other_actifs > 0 then
        raise exception
          'dernier administrateur du club : transmettez le rôle avant de supprimer votre compte'
          using errcode = '42501';
      end if;
    end if;

    -- L'ADRESSE DÉNORMALISÉE DANS L'AUDIT est une donnée personnelle, et elle
    -- survit à la ligne `members` par construction (c'est tout l'intérêt d'une
    -- copie). Le chaînage par hash d'`audit_securite` (0005) ne couvre que
    -- `ts`, `action`, `target_id` et `summary` : effacer `actor_email` ne
    -- rompt donc AUCUNE preuve d'inviolabilité — le journal du club reste
    -- vérifiable, il ne nomme simplement plus personne.
    update audit_metier   set actor_email = null where actor = v_member.id;
    update audit_securite set actor_email = null where actor = v_member.id;

    -- LA LIGNE `members` EST-ELLE UNE SIGNATURE ? Les six colonnes qui la
    -- désignent, nommées une par une plutôt que découvertes par le catalogue :
    -- une clé étrangère ajoutée demain doit être ajoutée ICI, à la lecture, et
    -- non traitée en silence par un balayage qui donnerait la même réponse
    -- sans qu'on sache laquelle.
    v_referenced :=
         exists (select 1 from entries
                  where created_by = v_member.id
                     or updated_by = v_member.id
                     or deleted_by = v_member.id)
      or exists (select 1 from attachments    where uploaded_by = v_member.id)
      or exists (select 1 from seasons        where locked_by   = v_member.id)
      or exists (select 1 from audit_metier   where actor       = v_member.id)
      or exists (select 1 from audit_securite where actor       = v_member.id);

    if v_referenced then
      v_outcome := 'anonymise';
      -- `email` est NOT NULL et le domaine `.invalid` est réservé par la
      -- RFC 2606 : rien ne partira jamais vers cette adresse. Le fragment
      -- d'identifiant qu'elle porte est déjà visible dans `entries.created_by`
      -- — il ne rajoute aucune information sur la personne.
      update members set
        email        = 'supprime+' || substr(v_member.id::text, 1, 8) || '@invalid',
        display_name = null,
        roles        = array['membre']::app_role[],
        mfa_required = false,
        active       = false,
        auth_id      = null
      where id = v_member.id;
    else
      delete from members where id = v_member.id;
    end if;
  end if;

  -- ET LE COMPTE LUI-MÊME. C'est la ligne qui distingue « vos données sont
  -- vidées » de « votre compte n'existe plus » : sans elle, l'adresse reste
  -- connue du service, un lien de connexion continue de fonctionner, et le
  -- droit à l'effacement n'est pas satisfait. La cascade GoTrue emporte
  -- identités, sessions, jetons de rafraîchissement et facteurs MFA.
  delete from auth.users where id = v_uid;

  return v_outcome;
end
$$;

-- Propriétaire EXPLICITE : c'est de lui que la fonction emprunte BYPASSRLS et
-- le droit d'écrire dans `auth.users`. Le laisser implicite ferait dépendre le
-- comportement du rôle qui a appliqué la migration.
alter function public.delete_my_account() owner to postgres;

-- PostgreSQL accorde EXECUTE à PUBLIC sur toute fonction nouvelle, et Supabase
-- pose en plus des droits par défaut nommant `anon`. Révoquer PUBLIC ne suffit
-- donc pas. L'appel par `anon` lèverait de toute façon (`auth.uid()` est nul),
-- mais une fonction qui efface des comptes n'a pas à être atteignable par la
-- clé publique du bundle.
revoke all on function public.delete_my_account() from public;
revoke all on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;

comment on function public.delete_my_account() is
  'RGPD art. 17 — efface le compte de l''appelant : sa ligne auth.users, son '
  'adresse dans les journaux d''audit, et sa ligne members (supprimée si rien '
  'ne la référence, anonymisée sinon — les écritures du club sont conservées). '
  'Rend ''supprime'' ou ''anonymise''. SECURITY DEFINER, propriétaire postgres : '
  'c''est son BYPASSRLS qui franchit le « force row level security » de 0002 et '
  'son GRANT qui ouvre auth.users. Réservée à authenticated ; sans session, '
  'lève 42501. Preuve : supabase/tests/suppression-compte.test.sql.';
