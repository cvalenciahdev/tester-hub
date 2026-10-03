-- =========================================================
-- 001_core_schema.sql
-- Plataforma colaborativa de testers
--
-- Incluye:
--   - Enums
--   - Tablas core
--   - Constraints
--   - Índices
--   - updated_at
--   - Creación automática de profile
--   - RLS inicial
--
-- NO incluye todavía:
--   - RPCs / operaciones de negocio
--   - Discovery de campañas
--   - Máquina de estados transaccional
--   - Checkpoints
--   - Notificaciones
--   - Evidencias
--   - Donaciones
-- =========================================================


-- =========================================================
-- 1. ENUMS
-- =========================================================

create type public.platform_type as enum (
  'android',
  'ios'
);

create type public.initial_intent_type as enum (
  'tester',
  'developer',
  'both'
);

create type public.campaign_status as enum (
  'draft',
  'recruiting',
  'testing',
  'completed',
  'cancelled'
);

create type public.participation_status as enum (
  'waiting_access',
  'access_enabled',
  'active',
  'completed',
  'incompatible',
  'abandoned',
  'cancelled'
);


-- =========================================================
-- 2. PROFILES
-- =========================================================

create table public.profiles (
  id uuid primary key
    references auth.users(id)
    on delete cascade,

  display_name text,

  country_code varchar(2),

  testing_email text,

  initial_intent public.initial_intent_type,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_country_code_format
    check (
      country_code is null
      or country_code ~ '^[A-Z]{2}$'
    )
);


-- =========================================================
-- 3. USER DEVICES
-- =========================================================

create table public.user_devices (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  platform public.platform_type not null,

  os_major smallint not null,
  os_minor smallint,

  model text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_devices_os_major_non_negative
    check (os_major >= 0),

  constraint user_devices_os_minor_non_negative
    check (
      os_minor is null
      or os_minor >= 0
    )
);


-- =========================================================
-- 4. APPS
-- =========================================================

create table public.apps (
  id uuid primary key default gen_random_uuid(),

  owner_id uuid not null
    references public.profiles(id)
    on delete restrict,

  name text not null,

  description text,

  archived_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint apps_name_not_blank
    check (
      length(trim(name)) > 0
    )
);


-- =========================================================
-- 5. TEST CAMPAIGNS
-- =========================================================

create table public.test_campaigns (
  id uuid primary key default gen_random_uuid(),

  app_id uuid not null
    references public.apps(id)
    on delete restrict,

  platform public.platform_type not null,

  min_os_major smallint,
  min_os_minor smallint,

  target_testers integer not null,

  duration_days integer not null,

  all_countries boolean not null default false,

  opt_in_url text,
  store_url text,
  instructions text,

  status public.campaign_status
    not null
    default 'draft',

  published_at timestamptz,
  testing_started_at timestamptz,
  completed_at timestamptz,

  cancelled_at timestamptz,
  cancel_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint test_campaigns_target_positive
    check (
      target_testers > 0
    ),

  constraint test_campaigns_duration_positive
    check (
      duration_days > 0
    ),

  constraint test_campaigns_min_os_major_non_negative
    check (
      min_os_major is null
      or min_os_major >= 0
    ),

  constraint test_campaigns_min_os_minor_non_negative
    check (
      min_os_minor is null
      or min_os_minor >= 0
    ),

  constraint test_campaigns_min_os_version_consistent
    check (
      min_os_minor is null
      or min_os_major is not null
    )
);


-- =========================================================
-- 6. CAMPAIGN COUNTRIES
-- =========================================================

create table public.campaign_countries (
  campaign_id uuid not null
    references public.test_campaigns(id)
    on delete cascade,

  country_code varchar(2) not null,

  primary key (
    campaign_id,
    country_code
  ),

  constraint campaign_countries_code_format
    check (
      country_code ~ '^[A-Z]{2}$'
    )
);


-- =========================================================
-- 7. TEST PARTICIPATIONS
-- =========================================================

create table public.test_participations (
  id uuid primary key default gen_random_uuid(),

  campaign_id uuid not null
    references public.test_campaigns(id)
    on delete restrict,

  tester_id uuid not null
    references public.profiles(id)
    on delete restrict,

  testing_email_snapshot text not null,

  status public.participation_status
    not null
    default 'waiting_access',

  joined_at timestamptz not null default now(),

  access_enabled_at timestamptz,
  installed_at timestamptz,
  expected_end_at timestamptz,

  closed_at timestamptz,
  close_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint test_participations_unique_tester_campaign
    unique (
      campaign_id,
      tester_id
    ),

  constraint test_participations_testing_email_not_blank
    check (
      length(trim(testing_email_snapshot)) > 0
    )
);


-- =========================================================
-- 8. PARTICIPATION EVENTS
-- =========================================================

create table public.participation_events (
  id uuid primary key default gen_random_uuid(),

  participation_id uuid not null
    references public.test_participations(id)
    on delete cascade,

  event_type text not null,

  actor_user_id uuid
    references public.profiles(id)
    on delete set null,

  metadata jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null default now(),

  constraint participation_events_event_type_not_blank
    check (
      length(trim(event_type)) > 0
    ),

  constraint participation_events_metadata_object
    check (
      jsonb_typeof(metadata) = 'object'
    )
);


-- =========================================================
-- 9. ÍNDICES
-- =========================================================

create index idx_apps_owner_id
  on public.apps(owner_id);

create index idx_test_campaigns_app_id
  on public.test_campaigns(app_id);

create index idx_test_campaigns_status_platform
  on public.test_campaigns(
    status,
    platform
  );

create index idx_campaign_countries_country_campaign
  on public.campaign_countries(
    country_code,
    campaign_id
  );

create index idx_test_participations_campaign_status
  on public.test_participations(
    campaign_id,
    status
  );

create index idx_test_participations_tester_status
  on public.test_participations(
    tester_id,
    status
  );

create index idx_participation_events_participation_created
  on public.participation_events(
    participation_id,
    created_at
  );


-- =========================================================
-- 10. UPDATED_AT
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


create trigger trg_profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger trg_user_devices_set_updated_at
before update on public.user_devices
for each row
execute function public.set_updated_at();

create trigger trg_apps_set_updated_at
before update on public.apps
for each row
execute function public.set_updated_at();

create trigger trg_test_campaigns_set_updated_at
before update on public.test_campaigns
for each row
execute function public.set_updated_at();

create trigger trg_test_participations_set_updated_at
before update on public.test_participations
for each row
execute function public.set_updated_at();


-- =========================================================
-- 11. CREACIÓN AUTOMÁTICA DEL PROFILE
-- =========================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

  insert into public.profiles (
    id,
    display_name
  )
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    )
  );

  return new;

end;
$$;


create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();


-- =========================================================
-- 12. HABILITAR RLS
-- =========================================================

alter table public.profiles
enable row level security;

alter table public.user_devices
enable row level security;

alter table public.apps
enable row level security;

alter table public.test_campaigns
enable row level security;

alter table public.campaign_countries
enable row level security;

alter table public.test_participations
enable row level security;

alter table public.participation_events
enable row level security;


-- =========================================================
-- 13. RLS: PROFILES
-- =========================================================

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
);


create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (
  id = auth.uid()
)
with check (
  id = auth.uid()
);


-- =========================================================
-- 14. RLS: USER DEVICES
-- =========================================================

create policy "user_devices_select_own"
on public.user_devices
for select
to authenticated
using (
  user_id = auth.uid()
);


create policy "user_devices_insert_own"
on public.user_devices
for insert
to authenticated
with check (
  user_id = auth.uid()
);


create policy "user_devices_update_own"
on public.user_devices
for update
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);


create policy "user_devices_delete_own"
on public.user_devices
for delete
to authenticated
using (
  user_id = auth.uid()
);


-- =========================================================
-- 15. RLS: APPS
-- =========================================================

create policy "apps_select_own"
on public.apps
for select
to authenticated
using (
  owner_id = auth.uid()
);


create policy "apps_insert_own"
on public.apps
for insert
to authenticated
with check (
  owner_id = auth.uid()
);


create policy "apps_update_own"
on public.apps
for update
to authenticated
using (
  owner_id = auth.uid()
)
with check (
  owner_id = auth.uid()
);


-- Sin DELETE.
-- archived_at representa archivado lógico.


-- =========================================================
-- 16. RLS: TEST CAMPAIGNS
-- =========================================================

create policy "test_campaigns_select_own"
on public.test_campaigns
for select
to authenticated
using (
  exists (
    select 1
    from public.apps a
    where a.id = test_campaigns.app_id
      and a.owner_id = auth.uid()
  )
);


-- Sin INSERT / UPDATE / DELETE directo.
-- Se manejará mediante operaciones controladas.


-- =========================================================
-- 17. RLS: CAMPAIGN COUNTRIES
-- =========================================================

create policy "campaign_countries_select_owner"
on public.campaign_countries
for select
to authenticated
using (
  exists (
    select 1
    from public.test_campaigns tc
    join public.apps a
      on a.id = tc.app_id
    where tc.id = campaign_countries.campaign_id
      and a.owner_id = auth.uid()
  )
);


-- Sin INSERT / UPDATE / DELETE directo.


-- =========================================================
-- 18. RLS: TEST PARTICIPATIONS
-- =========================================================

create policy "test_participations_select_tester"
on public.test_participations
for select
to authenticated
using (
  tester_id = auth.uid()
);


create policy "test_participations_select_campaign_owner"
on public.test_participations
for select
to authenticated
using (
  exists (
    select 1
    from public.test_campaigns tc
    join public.apps a
      on a.id = tc.app_id
    where tc.id = test_participations.campaign_id
      and a.owner_id = auth.uid()
  )
);


-- Sin INSERT / UPDATE / DELETE directo.


-- =========================================================
-- 19. RLS: PARTICIPATION EVENTS
-- =========================================================

create policy "participation_events_select_tester"
on public.participation_events
for select
to authenticated
using (
  exists (
    select 1
    from public.test_participations tp
    where tp.id = participation_events.participation_id
      and tp.tester_id = auth.uid()
  )
);


create policy "participation_events_select_campaign_owner"
on public.participation_events
for select
to authenticated
using (
  exists (
    select 1
    from public.test_participations tp
    join public.test_campaigns tc
      on tc.id = tp.campaign_id
    join public.apps a
      on a.id = tc.app_id
    where tp.id = participation_events.participation_id
      and a.owner_id = auth.uid()
  )
);


-- Sin INSERT / UPDATE / DELETE directo.


-- =========================================================
-- FIN 001_core_schema.sql
-- =========================================================