-- Regard financier — schéma Supabase
-- À exécuter dans le SQL Editor du projet, en une fois.
-- Deux tables : les réglages (un document par utilisateur) et les missions (une ligne chacune).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- réglages
-- Tout le socle, les niches, les modules, les extras et les prazos vivent ici
-- sous forme de document. C'est un objet qu'on lit et réécrit en entier,
-- pas quelque chose qu'on interroge ligne par ligne.
create table if not exists public.rf_config (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  data        jsonb       not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- missions
-- Les missions sont de vraies lignes : on les filtre, on les agrège par mois
-- et par niche, on les exporte. Elles méritent des colonnes.
create table if not exists public.rf_missions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  mission_date  date,
  client        text        not null default '',
  niche         text        not null default '',
  valor         numeric(12,2) not null default 0,
  horas         numeric(8,2)  not null default 0,
  status        text        not null default 'proposto',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint rf_missions_status_ck check (status in ('proposto','fechado','pago')),
  constraint rf_missions_valor_ck  check (valor >= 0),
  constraint rf_missions_horas_ck  check (horas >= 0)
);

create index if not exists rf_missions_user_date_idx
  on public.rf_missions (user_id, mission_date desc);
create index if not exists rf_missions_user_status_idx
  on public.rf_missions (user_id, status);

-- ------------------------------------------------------- updated_at auto
create or replace function public.rf_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists rf_config_touch on public.rf_config;
create trigger rf_config_touch before update on public.rf_config
  for each row execute function public.rf_touch();

drop trigger if exists rf_missions_touch on public.rf_missions;
create trigger rf_missions_touch before update on public.rf_missions
  for each row execute function public.rf_touch();

-- ----------------------------------------------------------- vue par mois
-- Ce que le tableau de bord affiche, calculé côté base plutôt que côté page.
create or replace view public.rf_mois
with (security_invoker = true) as
select
  user_id,
  to_char(date_trunc('month', mission_date), 'YYYY-MM')            as mois,
  count(*) filter (where status <> 'proposto')                     as n_missions,
  coalesce(sum(valor)  filter (where status <> 'proposto'), 0)     as facture,
  coalesce(sum(valor)  filter (where status = 'pago'), 0)          as encaisse,
  coalesce(sum(valor)  filter (where status = 'proposto'), 0)      as pipeline,
  coalesce(sum(horas)  filter (where status <> 'proposto'), 0)     as heures
from public.rf_missions
where mission_date is not null
group by user_id, date_trunc('month', mission_date);

-- ------------------------------------------------------------------- RLS
-- Chaque ligne appartient à un utilisateur. La clé anon publiée dans le code
-- ne donne accès à rien sans une session valide : c'est exactement ce pour
-- quoi elle est conçue.
alter table public.rf_config   enable row level security;
alter table public.rf_missions enable row level security;

drop policy if exists rf_config_owner on public.rf_config;
create policy rf_config_owner on public.rf_config
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists rf_missions_owner on public.rf_missions;
create policy rf_missions_owner on public.rf_missions
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
