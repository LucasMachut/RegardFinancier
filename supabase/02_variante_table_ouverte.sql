-- VARIANTE : accès sans connexion.
--
-- N'exécute ce fichier que si tu acceptes que tes réglages, tes clients et tes
-- montants soient lisibles ET modifiables par toute personne qui trouve l'URL
-- du dépôt. Le dépôt doit être public pour GitHub Pages gratuit, donc la clé
-- anon et l'URL du projet y sont visibles. Des robots scannent en continu les
-- dépôts publics à la recherche de clés Supabase et testent les tables ouvertes.
--
-- Ce fichier n'est PAS appliqué par défaut. 01_schema.sql l'est.
-- Pour revenir en arrière ensuite : réexécute 01_schema.sql.

alter table public.rf_config   drop constraint if exists rf_config_user_id_fkey;
alter table public.rf_missions drop constraint if exists rf_missions_user_id_fkey;
alter table public.rf_config   alter column user_id set default '00000000-0000-0000-0000-000000000000'::uuid;
alter table public.rf_missions alter column user_id set default '00000000-0000-0000-0000-000000000000'::uuid;

drop policy if exists rf_config_owner   on public.rf_config;
drop policy if exists rf_missions_owner on public.rf_missions;

create policy rf_config_ouvert on public.rf_config
  for all to anon, authenticated using (true) with check (true);
create policy rf_missions_ouvert on public.rf_missions
  for all to anon, authenticated using (true) with check (true);
