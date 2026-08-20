-- ═══════════════════════════════════════════════════════════════════════════
--  Cursus — Privilèges du rôle applicatif
--
--  Supabase accordait implicitement les droits de table aux rôles `anon` et
--  `authenticated`. Sur un PostgreSQL standard, il faut les accorder
--  explicitement — c'est aussi l'occasion de les restreindre.
--
--  Modèle :
--    • `app_authenticated` (rôle des requêtes utilisateur) reçoit SELECT,
--      INSERT, UPDATE, DELETE sur les tables métier. RLS décide ensuite,
--      ligne par ligne, ce qui est réellement visible ou modifiable.
--    • Il ne possède AUCUNE table : RLS ne peut donc pas être contournée
--      (le propriétaire d'une table échappe à ses propres politiques).
--    • Le schéma `auth` et la table des migrations lui restent fermés.
-- ═══════════════════════════════════════════════════════════════════════════

-- L'utilisateur de connexion doit pouvoir endosser le rôle applicatif.
do $$
begin
  execute format('grant app_authenticated to %I', current_user);
exception when others then
  raise notice 'app_authenticated déjà accordé à %', current_user;
end $$;

grant usage on schema public  to authenticated, anon, app_authenticated;
grant usage on schema storage to authenticated, app_authenticated;

-- Tables métier : les quatre opérations, filtrées par RLS.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.buckets to authenticated;

-- Les objets créés plus tard héritent des mêmes droits.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
alter default privileges in schema public
  grant execute on functions to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Restrictions
-- ─────────────────────────────────────────────────────────────────────────────

-- Le journal des migrations n'a rien à faire côté application.
revoke all on public.schema_migrations from authenticated, anon, app_authenticated;

-- Le journal d'audit est en lecture seule : il retrace des actions, il ne se
-- réécrit pas. Les insertions passent par des fonctions SECURITY DEFINER.
revoke insert, update, delete on public.audit_log from authenticated;

-- L'historique de validation des contrats est écrit par déclencheur, jamais
-- directement : un utilisateur ne doit pas pouvoir fabriquer un historique.
revoke insert, update, delete on public.contract_reviews from authenticated;

-- Le rôle anonyme ne lit que ce qui est explicitement public (RPC dédiées).
revoke all on all tables in schema public from anon;
grant execute on function public.public_establishments() to anon;
grant execute on function public.public_wilayas() to anon;

-- Aucune fonction interne d'authentification n'est appelable côté application.
revoke all on all functions in schema auth from authenticated, anon, app_authenticated;
grant execute on function auth.uid()   to authenticated, anon, app_authenticated;
grant execute on function auth.role()  to authenticated, anon, app_authenticated;
grant execute on function auth.email() to authenticated, app_authenticated;

-- Vérification : le rôle applicatif ne possède aucune table du schéma public.
do $$
declare n integer;
begin
  select count(*) into n
    from pg_tables
   where schemaname = 'public' and tableowner = 'app_authenticated';
  if n > 0 then
    raise exception 'app_authenticated possède % table(s) : RLS serait contournée.', n;
  end if;
end $$;
