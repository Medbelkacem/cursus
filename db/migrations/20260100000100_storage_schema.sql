-- ═══════════════════════════════════════════════════════════════════════════
--  Cursus — Schéma de stockage de fichiers
--
--  Remplace Supabase Storage. Les colonnes reprennent exactement celles
--  attendues par les politiques déjà écrites (`bucket_id`, `name`, `owner`) :
--  les deux migrations de policies de stockage s'appliquent sans modification.
--
--  Les fichiers sont conservés dans PostgreSQL (`bytea`). C'est simple,
--  transactionnel et cohérent avec les sauvegardes de la base. Pour des
--  volumes importants, remplacer `data` par une clé d'objet externe (Vercel
--  Blob, S3) sans toucher aux politiques.
-- ═══════════════════════════════════════════════════════════════════════════

create schema if not exists storage;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz not null default now()
);

create table if not exists storage.objects (
  id           uuid primary key default gen_random_uuid(),
  bucket_id    text not null references storage.buckets(id) on delete cascade,
  name         text not null,               -- chemin complet dans le bucket
  owner        uuid,
  mime_type    text,
  size         bigint not null default 0,
  data         bytea,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (bucket_id, name)
);

create index if not exists objects_bucket_idx on storage.objects(bucket_id);
create index if not exists objects_owner_idx  on storage.objects(owner);
-- Recherche par préfixe de dossier
create index if not exists objects_name_idx   on storage.objects(bucket_id, name text_pattern_ops);

alter table storage.objects enable row level security;

-- Défini ici car cette migration précède le schéma principal ; la migration
-- suivante le recrée à l'identique (create or replace).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists objects_updated on storage.objects;
create trigger objects_updated
  before update on storage.objects
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Helpers de chemin (équivalents à ceux de Supabase Storage)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function storage.foldername(p_name text)
returns text[]
language sql
immutable
as $$
  select case
    when position('/' in p_name) = 0 then '{}'::text[]
    else string_to_array(left(p_name, length(p_name) - position('/' in reverse(p_name))), '/')
  end
$$;

create or replace function storage.filename(p_name text)
returns text
language sql
immutable
as $$
  select right(p_name, position('/' in reverse(p_name)) - 1)
$$;

grant usage on schema storage to authenticated, anon, app_authenticated;
