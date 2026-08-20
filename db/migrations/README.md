# Migrations Supabase — Cursus

Ces migrations construisent la base de données complète. **Aucune donnée fictive** :
seul le schéma, les contraintes, les fonctions et les politiques RLS sont créés.

## Ordre d'exécution

| Fichier | Rôle |
| --- | --- |
| `20260101000000_schema.sql`    | Tables, types énumérés, index, triggers `updated_at` |
| `20260101000100_functions.sql` | Helpers (current_role, has_role…), trigger d'inscription, vue moyennes |
| `20260101000200_rls.sql`       | Row Level Security sur toutes les tables |
| `20260101000300_storage.sql`   | Buckets + policies Storage |

## Exécution

```bash
# 1. Lier le projet local au projet Supabase distant
npx supabase link --project-ref <YOUR-PROJECT-REF>

# 2. Pousser toutes les migrations
npx supabase db push
```

Ou en local (Supabase CLI + Docker) :

```bash
npx supabase start
npx supabase db reset   # rejoue toutes les migrations
```

## Amorçage : créer le premier compte ministère

Aucune donnée fictive n'est insérée. Le tout premier compte (rôle `ministry`)
doit être créé manuellement via le Studio Supabase :

1. Studio → **Authentication → Users → Add user → Create new user**
   - email : `ministry@cursus.dz`
   - mot de passe : à choisir
2. Studio → **Table Editor → public.profiles → Insert row**
   - `id`     : copier l'UUID de l'utilisateur créé
   - `role`   : `ministry`
   - `status` : `active`
   - le reste : à remplir

À partir de ce compte, le ministère peut créer les directions et les
établissements. Chaque admin d'établissement peut ensuite valider les
inscriptions de ses professeurs et étudiants.

## Vérification

Une fois les migrations passées :

```sql
-- Toutes les tables doivent avoir RLS = on
select tablename, rowsecurity
  from pg_tables
 where schemaname = 'public'
 order by tablename;

-- Les buckets doivent exister
select id, public from storage.buckets;
```
