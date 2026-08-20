-- ═══════════════════════════════════════════════════════════════════════════
--  Cursus — Schéma d'authentification
--
--  Remplace ce que Supabase (GoTrue) fournissait auparavant. Tout le reste du
--  schéma, les politiques RLS et le moteur académique restent inchangés : ils
--  ne dépendaient que de trois choses côté Supabase —
--    • la table  auth.users
--    • la fonction auth.uid()
--    • l'extension pgcrypto (schéma « extensions »)
--  qui sont recréées ici à l'identique sur un PostgreSQL standard.
--
--  Ce fichier doit s'exécuter EN PREMIER (son horodatage le garantit).
-- ═══════════════════════════════════════════════════════════════════════════

create schema if not exists auth;
create schema if not exists extensions;

-- pgcrypto est utilisé pour crypt()/gen_salt() (hachage bcrypt) et
-- gen_random_uuid(). On l'expose dans les deux schémas attendus par le code.
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- Comptes d'authentification
--   Volontairement proche du modèle GoTrue : les migrations et fonctions
--   existantes (create_account, handle_new_user…) continuent de fonctionner
--   sans réécriture.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  instance_id        uuid,
  aud                varchar(255) default 'authenticated',
  role               varchar(255) default 'authenticated',
  email              varchar(255) not null,
  encrypted_password varchar(255),
  email_confirmed_at timestamptz,
  last_sign_in_at    timestamptz,
  raw_app_meta_data  jsonb  not null default '{}'::jsonb,
  raw_user_meta_data jsonb  not null default '{}'::jsonb,
  is_active          boolean not null default true,
  failed_attempts    smallint not null default 0,
  locked_until       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- Colonnes conservées pour compatibilité avec le code d'origine
  confirmation_token     varchar(255) default '',
  email_change           varchar(255) default '',
  email_change_token_new varchar(255) default '',
  recovery_token         varchar(255) default ''
);

create unique index if not exists users_email_key on auth.users (lower(email));

-- Conservée pour que les scripts existants s'exécutent sans modification ;
-- elle n'est plus utilisée par l'authentification.
create table if not exists auth.identities (
  id              uuid primary key default gen_random_uuid(),
  provider_id     text,
  user_id         uuid references auth.users(id) on delete cascade,
  identity_data   jsonb,
  provider        text,
  last_sign_in_at timestamptz,
  created_at      timestamptz,
  updated_at      timestamptz
);

-- Sessions : un jeton de rafraîchissement par connexion, révocable.
create table if not exists auth.sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  refresh_token text not null unique,
  user_agent    text,
  ip            text,
  expires_at    timestamptz not null,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

create index if not exists sessions_user_idx  on auth.sessions(user_id);
create index if not exists sessions_token_idx on auth.sessions(refresh_token);

-- ─────────────────────────────────────────────────────────────────────────────
-- auth.uid() — identité de l'appelant
--
--   L'API pose `request.jwt.claim.sub` au début de chaque transaction, à
--   partir d'un jeton VÉRIFIÉ côté serveur. Le client ne peut donc pas
--   choisir son identité : c'est plus strict que le modèle précédent, où la
--   clé anonyme circulait dans le navigateur.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    ), ''
  )::uuid
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(current_setting('request.jwt.claim.role', true), 'anon')
$$;

create or replace function auth.email()
returns text
language sql
stable
as $$
  select email from auth.users where id = auth.uid()
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Mots de passe — hachage bcrypt, vérification à temps constant côté pgcrypto
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function auth.hash_password(p_password text)
returns text
language sql
volatile
as $$
  select extensions.crypt(p_password, extensions.gen_salt('bf', 10))
$$;

-- Renvoie l'utilisateur si les identifiants sont valides, sinon rien.
-- Gère le verrouillage temporaire après échecs répétés.
create or replace function auth.authenticate(
  p_email    text,
  p_password text
)
returns table (id uuid, email text, locked boolean)
language plpgsql
security definer
set search_path = auth, public, extensions
as $$
declare
  u auth.users;
begin
  select * into u from auth.users where lower(auth.users.email) = lower(trim(p_email));

  if not found then
    -- Coût comparable à une vérification réelle : évite de distinguer
    -- « compte inconnu » de « mot de passe faux » par le temps de réponse.
    perform extensions.crypt(p_password, extensions.gen_salt('bf', 10));
    return;
  end if;

  if u.locked_until is not null and u.locked_until > now() then
    return query select u.id, u.email::text, true;
    return;
  end if;

  if u.encrypted_password is null
     or extensions.crypt(p_password, u.encrypted_password) <> u.encrypted_password then
    update auth.users
       set failed_attempts = failed_attempts + 1,
           locked_until = case when failed_attempts + 1 >= 8
                               then now() + interval '15 minutes' else null end
     where auth.users.id = u.id;
    return;
  end if;

  if not u.is_active then
    return;
  end if;

  update auth.users
     set failed_attempts = 0, locked_until = null, last_sign_in_at = now()
   where auth.users.id = u.id;

  return query select u.id, u.email::text, false;
end;
$$;

create or replace function auth.set_password(p_user uuid, p_password text)
returns void
language sql
security definer
set search_path = auth, extensions
as $$
  update auth.users
     set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
         failed_attempts = 0, locked_until = null, updated_at = now()
   where id = p_user
$$;

-- Purge des sessions expirées (à appeler périodiquement).
create or replace function auth.prune_sessions()
returns integer
language sql
security definer
set search_path = auth
as $$
  with d as (
    delete from auth.sessions
     where expires_at < now() or (revoked_at is not null and revoked_at < now() - interval '7 days')
    returning 1
  )
  select count(*)::integer from d
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Rôles de base de données
--   `app_authenticated` est le rôle sous lequel l'API exécute les requêtes des
--   utilisateurs : RLS s'applique. `app_admin` (propriétaire) contourne RLS et
--   n'est utilisé que par les migrations et l'amorçage.
-- ─────────────────────────────────────────────────────────────────────────────

do $$ begin
  create role app_authenticated nologin;
exception when duplicate_object then null; end $$;

-- Les anciens noms Supabase restent définis : les GRANT des migrations
-- existantes s'appliquent sans modification.
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon          nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role  nologin; exception when duplicate_object then null; end $$;

grant authenticated to app_authenticated;
grant usage on schema public, auth, extensions to authenticated, anon, app_authenticated;
