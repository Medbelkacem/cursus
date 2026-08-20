-- ═══════════════════════════════════════════════════════════════════════════
--  Cursus — extension de l'énumération des types d'établissement
--
--  Aligne `public.establishment_type` sur la nomenclature officielle de la
--  formation professionnelle (10 types).  Les valeurs historiques sont
--  conservées pour ne casser aucune ligne existante ; l'interface ne propose
--  que les 10 types officiels (voir src/lib/nomenclature.js).
--
--  NOTE PostgreSQL : `alter type … add value` est autorisé dans une
--  transaction depuis PG 12, à condition de ne PAS utiliser la nouvelle
--  valeur dans la même transaction.  C'est pourquoi ce fichier est isolé.
-- ═══════════════════════════════════════════════════════════════════════════

alter type public.establishment_type add value if not exists 'iep';      -- Institut d'Enseignement Professionnel
alter type public.establishment_type add value if not exists 'cfphp';    -- CFPA pour Personnes Handicapées Physiques
alter type public.establishment_type add value if not exists 'infep';    -- Institut National de la Formation et de l'Enseignement Professionnels
alter type public.establishment_type add value if not exists 'ifep';     -- Institut de Formation et d'Enseignement Professionnel
alter type public.establishment_type add value if not exists 'cnepd';    -- Centre National d'Enseignement Professionnel à Distance
alter type public.establishment_type add value if not exists 'indefoc';  -- Institut National de Développement et de Promotion de la Formation Continue
alter type public.establishment_type add value if not exists 'epfp';     -- Établissement Privé de Formation Professionnelle
