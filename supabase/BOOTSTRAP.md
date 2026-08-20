# Premier démarrage — créer le compte ministère

La plateforme démarre entièrement vide (§1, §24) : aucun compte n'existe, pas même
celui du ministère. Il y a donc un amorçage manuel, une seule fois.

`create_account()` refuse de créer un compte si l'appelant n'est pas déjà ministère —
c'est volontaire (§23). Le tout premier compte se crée donc directement en base.

---

## 1. Appliquer les migrations

```bash
npm run supabase:link      # demande la référence du projet
npm run supabase:push      # applique les 13 migrations
```

## 2. Créer le compte ministère

### Méthode A — Studio Supabase (recommandée)

1. **Authentication → Users → Add user**
   - Email + mot de passe, cocher **Auto Confirm User**.
2. **SQL Editor**, une seule requête :

```sql
update public.profiles
   set role       = 'ministry',
       status     = 'active',
       first_name = 'Prénom',
       last_name  = 'Nom'
 where email = 'ministere@exemple.dz';
```

Le trigger `handle_new_user` a déjà créé la ligne `profiles` au statut `pending` ;
cette requête lui donne le rôle et l'active.

### Méthode B — SQL uniquement

À exécuter dans le SQL Editor. Remplacer l'email et le mot de passe.

```sql
do $$
declare
  v_id    uuid := gen_random_uuid();
  v_email text := 'ministere@exemple.dz';
  v_pass  text := 'ChangezCeMotDePasse';
begin
  if exists (select 1 from auth.users where lower(email) = lower(v_email)) then
    raise notice 'compte déjà existant : %', v_email;
    return;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    lower(v_email), extensions.crypt(v_pass, extensions.gen_salt('bf', 10)), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('role', 'ministry', 'first_name', 'Prénom', 'last_name', 'Nom'),
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    id, provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_id::text, v_id,
    jsonb_build_object('sub', v_id::text, 'email', lower(v_email),
                       'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now()
  );

  update public.profiles set role = 'ministry', status = 'active' where id = v_id;
  raise notice 'compte ministère créé : %', v_email;
end $$;
```

Changer le mot de passe dès la première connexion.

---

## 3. Tous les autres comptes se créent depuis l'interface

Une fois connecté en ministère, plus aucune intervention en base n'est nécessaire :

| Créé par | Peut créer | Où |
| --- | --- | --- |
| Ministère | direction de wilaya, établissement, professeur, étudiant, ministère | `/ministere/comptes` — ou directement avec la wilaya (`/ministere/wilayas`) et avec l'établissement (`/ministere/etablissements`) |
| Direction de wilaya | établissement, professeur, étudiant — **dans sa wilaya uniquement** | `/direction/comptes` |
| Établissement | professeur, étudiant, administrateur — **dans son établissement uniquement** | `/administration/comptes` |

Ces limites sont vérifiées par `create_account()` côté PostgreSQL : les contourner
depuis l'interface ou l'API est sans effet.

Les comptes créés ainsi sont **actifs immédiatement**. Les personnes qui s'inscrivent
elles-mêmes via `/signup` arrivent au statut `pending` et doivent être activées depuis
la page Comptes.

---

## 4. Ordre de mise en route conseillé

1. Wilayas (+ compte de direction)
2. Modes de formation (import des 5 modes officiels)
3. Filières, puis programmes → structure S1→S5, modules, documents, publication
4. Établissements (+ compte administrateur)
5. Règlement pédagogique

L'établissement enchaîne : spécialités → classes → sections → matières → comptes.
