-- ═══════════════════════════════════════════════════════════════════════════
--  Cursus — Amorçage : ministère, direction de Tipaza, INSFP de Bou Ismaïl
--
--  ⚠️  Ce fichier n'est PAS une migration. Les migrations ne créent jamais de
--      donnée (§1, §24). C'est un script d'exploitation, exécuté une fois :
--          npm run seed        (applique les migrations puis ce script)
--
--  ⚠️  REMPLACER LES TROIS MOTS DE PASSE ci-dessous avant exécution, puis les
--      changer à la première connexion.
--
--  Enchaînement :
--    1. le compte ministère est créé directement (create_account() exige un
--       appelant ministère : il faut bien amorcer quelque part) ;
--    2. on prend ensuite son identité (auth.uid()) pour créer la wilaya, sa
--       direction et l'établissement par les fonctions normales de la
--       plateforme — le chemin d'autorisation réel est donc respecté.
--
--  Le script est ré-exécutable : il ne recrée rien qui existe déjà.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  -- ── À PERSONNALISER ──────────────────────────────────────────────────────
  c_min_email   text := 'ministere@cursus.dz';
  c_min_pass    text := 'REMPLACER_MOT_DE_PASSE_MINISTERE';
  c_min_prenom  text := 'Administrateur';
  c_min_nom     text := 'Ministère';

  c_dir_email   text := 'direction.tipaza@cursus.dz';
  c_dir_pass    text := 'REMPLACER_MOT_DE_PASSE_DIRECTION';
  c_dir_prenom  text := 'Directeur';
  c_dir_nom     text := 'Tipaza';

  c_ins_email   text := 'insfp.bouismail@cursus.dz';
  c_ins_pass    text := 'REMPLACER_MOT_DE_PASSE_INSFP';
  c_ins_prenom  text := 'Directeur';
  c_ins_nom     text := 'Bou Ismaïl';
  -- ─────────────────────────────────────────────────────────────────────────

  v_min    uuid;
  v_wilaya uuid;
  v_estab  uuid;
  v_res    jsonb;
begin
  -- La politique de mot de passe s'applique aussi à l'amorçage.
  perform auth.check_password_policy(c_min_pass, c_min_email);
  if c_dir_email is not null then perform auth.check_password_policy(c_dir_pass, c_dir_email); end if;
  if c_ins_email is not null then perform auth.check_password_policy(c_ins_pass, c_ins_email); end if;

  -- ── 1. Compte ministère (amorçage direct) ────────────────────────────────
  select id into v_min from auth.users where lower(email) = lower(c_min_email);

  if v_min is null then
    v_min := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_min, 'authenticated', 'authenticated',
      lower(c_min_email),
      auth.hash_password(c_min_pass), now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('role', 'ministry', 'first_name', c_min_prenom,
                         'last_name', c_min_nom, 'preferred_language', 'fr'),
      now(), now(), '', '', '', ''
    );

    raise notice 'Compte ministère créé : %', c_min_email;
  else
    raise notice 'Compte ministère déjà présent : %', c_min_email;
  end if;

  -- Le trigger handle_new_user a créé le profil au statut « pending ».
  update public.profiles
     set role = 'ministry', status = 'active',
         first_name = coalesce(nullif(first_name, ''), c_min_prenom),
         last_name  = coalesce(nullif(last_name,  ''), c_min_nom)
   where id = v_min;

  -- ── 2. On agit désormais AU NOM du ministère ─────────────────────────────
  --     auth.uid() lira cet identifiant : les fonctions de la plateforme
  --     appliquent donc leurs contrôles d'autorisation habituels.
  perform set_config('request.jwt.claim.sub', v_min::text, true);

  -- ── 3. Wilaya de Tipaza + compte de direction ────────────────────────────
  select id into v_wilaya from public.wilayas where code = '42';

  if v_wilaya is null then
    v_res := public.create_wilaya_with_admin(
      p_code             => '42',
      p_name             => 'Tipaza',
      p_directorate_name => 'Direction de la Formation et de l''Enseignement Professionnels de Tipaza',
      p_address          => 'Tipaza',
      p_contact_email    => 'dfep42@formation.dz',
      p_contact_phone    => null,
      p_admin_email      => c_dir_email,
      p_admin_password   => c_dir_pass,
      p_admin_first_name => c_dir_prenom,
      p_admin_last_name  => c_dir_nom
    );
    v_wilaya := (v_res->>'wilaya_id')::uuid;
    raise notice 'Wilaya 42 — Tipaza créée, direction : %', c_dir_email;
  else
    raise notice 'Wilaya 42 — Tipaza déjà présente';
  end if;

  update public.wilayas set name_ar = 'تيبازة' where id = v_wilaya and name_ar is null;

  -- ── 4. INSFP de Bou Ismaïl + compte administrateur ───────────────────────
  select id into v_estab from public.establishments where code = 'INSFP-42-01';

  if v_estab is null then
    insert into public.establishments (
      name, code, type, wilaya_id, address, contact_email, status, created_by
    ) values (
      'INSFP de Bou Ismaïl', 'INSFP-42-01', 'insfp', v_wilaya,
      'Bou Ismaïl, wilaya de Tipaza', 'insfp.bouismail@formation.dz', 'active', v_min
    )
    returning id into v_estab;
    raise notice 'Établissement créé : INSFP de Bou Ismaïl';
  else
    raise notice 'Établissement déjà présent : INSFP de Bou Ismaïl';
  end if;

  if not exists (select 1 from auth.users where lower(email) = lower(c_ins_email)) then
    perform public.create_account(
      p_email            => c_ins_email,
      p_password         => c_ins_pass,
      p_role             => 'admin',
      p_first_name       => c_ins_prenom,
      p_last_name        => c_ins_nom,
      p_establishment_id => v_estab,
      p_wilaya_id        => v_wilaya
    );
    raise notice 'Compte établissement créé : %', c_ins_email;
  else
    raise notice 'Compte établissement déjà présent : %', c_ins_email;
  end if;
end $$;

-- ── Vérification ───────────────────────────────────────────────────────────
select p.email, p.role, p.status,
       w.code || ' — ' || w.name as wilaya,
       e.name                    as etablissement
from public.profiles p
left join public.wilayas w        on w.id = p.wilaya_id
left join public.establishments e on e.id = p.establishment_id
where p.role in ('ministry', 'direction', 'admin')
order by case p.role when 'ministry' then 1 when 'direction' then 2 else 3 end;
