-- Country membership and direct-RPC eligibility. Existing migration files are unchanged.
-- Snapshot of src/lib/countries.json; keep in sync via tests/countries.test.cjs.
create or replace function public.is_valid_country_code(p_code text)
returns boolean
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select p_code = any(array['AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ', 'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS', 'BT', 'BV', 'BW', 'BY', 'BZ', 'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN', 'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE', 'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR', 'GA', 'GB', 'GD', 'GE', 'GF', 'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HM', 'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM', 'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC', 'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK', 'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA', 'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG', 'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW', 'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS', 'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO', 'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'UM', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI', 'VN', 'VU', 'WF', 'WS', 'YE', 'YT', 'ZA', 'ZM', 'ZW']::text[]);
$$;
revoke all on function public.is_valid_country_code(text) from public, anon;
grant execute on function public.is_valid_country_code(text) to authenticated, service_role;

-- NOT VALID preserves legacy rows without mapping/deleting them. New writes are checked.
-- Validate separately once existing non-ISO values have been reviewed in a local database.
alter table public.profiles add constraint profiles_country_code_iso
  check (country_code is null or public.is_valid_country_code(country_code)) not valid;
alter table public.campaign_countries add constraint campaign_countries_code_iso
  check (public.is_valid_country_code(country_code)) not valid;

-- =========================================================
-- 002_join_campaign.sql
--
-- Operación:
--   join_campaign(campaign_id)
--
-- Responsabilidad:
--   Permitir que el usuario autenticado ocupe una plaza
--   válida en una ronda de prueba.
--
-- No implementa todavía:
--   - matching por versión de SO
--   - matching por dispositivo
--   - filtros avanzados
-- =========================================================


create or replace function public.join_campaign(
  p_campaign_id uuid
)
returns public.test_participations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_campaign public.test_campaigns%rowtype;
  v_app public.apps%rowtype;
  v_profile public.profiles%rowtype;
  v_covered_testers integer;
  v_participation public.test_participations%rowtype;
begin

  -- -------------------------------------------------------
  -- 1. Usuario autenticado
  -- -------------------------------------------------------

  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;


  -- -------------------------------------------------------
  -- 2. Cargar y bloquear campaña
  --
  -- FOR UPDATE evita que dos join_campaign concurrentes
  -- consuman simultáneamente la última plaza.
  -- -------------------------------------------------------

  select *
  into v_campaign
  from public.test_campaigns
  where id = p_campaign_id
  for update;

  if not found then
    raise exception 'CAMPAIGN_NOT_FOUND';
  end if;


  -- -------------------------------------------------------
  -- 3. Estado válido
  -- -------------------------------------------------------

  if v_campaign.status not in ('recruiting', 'testing') then
    raise exception 'CAMPAIGN_NOT_OPEN';
  end if;


  -- -------------------------------------------------------
  -- 4. App asociada
  -- -------------------------------------------------------

  select *
  into v_app
  from public.apps
  where id = v_campaign.app_id;

  if not found then
    raise exception 'APP_NOT_FOUND';
  end if;

  if v_app.archived_at is not null then
    raise exception 'APP_ARCHIVED';
  end if;


  -- -------------------------------------------------------
  -- 5. Owner no puede participar
  -- -------------------------------------------------------

  if v_app.owner_id = v_user_id then
    raise exception 'OWNER_CANNOT_JOIN';
  end if;


  -- -------------------------------------------------------
  -- 6. Perfil y correo de testing
  -- -------------------------------------------------------

  select *
  into v_profile
  from public.profiles
  where id = v_user_id;

  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  if v_profile.testing_email is null
     or length(trim(v_profile.testing_email)) = 0 then
    raise exception 'TESTING_EMAIL_REQUIRED';
  end if;


  -- Country is required even for all_countries; unknown values never grant access.
  if v_profile.country_code is null
     or not public.is_valid_country_code(v_profile.country_code) then
    raise exception 'COUNTRY_NOT_ELIGIBLE';
  end if;

  if not v_campaign.all_countries and not exists (
    select 1 from public.campaign_countries cc
    where cc.campaign_id = p_campaign_id
      and cc.country_code = v_profile.country_code
  ) then
    raise exception 'COUNTRY_NOT_ELIGIBLE';
  end if;

  -- -------------------------------------------------------
  -- 7. Participación duplicada
  -- -------------------------------------------------------

  if exists (
    select 1
    from public.test_participations tp
    where tp.campaign_id = p_campaign_id
      and tp.tester_id = v_user_id
  ) then
    raise exception 'ALREADY_JOINED';
  end if;


  -- -------------------------------------------------------
  -- 8. Contar plazas cubiertas
  -- -------------------------------------------------------

  select count(*)
  into v_covered_testers
  from public.test_participations tp
  where tp.campaign_id = p_campaign_id
    and tp.status in (
      'waiting_access',
      'access_enabled',
      'active',
      'completed'
    );


  -- -------------------------------------------------------
  -- 9. Verificar disponibilidad
  -- -------------------------------------------------------

  if v_covered_testers >= v_campaign.target_testers then
    raise exception 'NO_AVAILABLE_SLOTS';
  end if;


  -- -------------------------------------------------------
  -- 10. Crear participación
  -- -------------------------------------------------------

  insert into public.test_participations (
    campaign_id,
    tester_id,
    testing_email_snapshot,
    status,
    joined_at
  )
  values (
    p_campaign_id,
    v_user_id,
    v_profile.testing_email,
    'waiting_access',
    now()
  )
  returning *
  into v_participation;


  -- -------------------------------------------------------
  -- 11. Registrar evento
  -- -------------------------------------------------------

  insert into public.participation_events (
    participation_id,
    event_type,
    actor_user_id,
    metadata
  )
  values (
    v_participation.id,
    'joined',
    v_user_id,
    '{}'::jsonb
  );


  -- -------------------------------------------------------
  -- 12. Resultado
  -- -------------------------------------------------------

  return v_participation;

end;
$$;


-- =========================================================
-- Permisos
-- =========================================================

revoke all
on function public.join_campaign(uuid)
from public;

revoke execute
on function public.join_campaign(uuid)
from anon;

revoke execute
on function public.join_campaign(uuid)
from service_role;

grant execute
on function public.join_campaign(uuid)
to authenticated;
-- =========================================================
-- campaign_discovery.sql
--
-- Operaciones:
--   list_available_campaigns(...)
--   get_campaign_detail(...)
-- =========================================================


-- =========================================================
-- 1. LIST AVAILABLE CAMPAIGNS
-- =========================================================

create or replace function public.list_available_campaigns(
  p_platform public.platform_type default null,
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (
  campaign_id uuid,
  app_id uuid,
  app_name text,
  app_description text,
  platform public.platform_type,
  status public.campaign_status,
  min_os_major smallint,
  min_os_minor smallint,
  target_testers integer,
  duration_days integer,
  all_countries boolean,
  country_codes text[],
  covered_testers integer,
  available_slots integer,
  published_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_country_code text;
begin

  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select p.country_code
  into v_country_code
  from public.profiles p
  where p.id = v_user_id;

  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  if v_country_code is null
     or not public.is_valid_country_code(v_country_code) then
    raise exception 'PROFILE_COUNTRY_REQUIRED';
  end if;

  if p_limit is null
     or p_limit < 1
     or p_limit > 48
     or p_offset is null
     or p_offset < 0 then
    raise exception 'INVALID_PAGINATION';
  end if;

  return query
  with discovery as (
    select
      c.id as campaign_id,
      a.id as app_id,
      a.name as app_name,
      a.description as app_description,
      c.platform,
      c.status,
      c.min_os_major,
      c.min_os_minor,
      c.target_testers,
      c.duration_days,
      c.all_countries,

      coalesce(
        (
          select array_agg(cc.country_code::text order by cc.country_code)
          from public.campaign_countries cc
          where cc.campaign_id = c.id
        ),
        array[]::text[]
      ) as country_codes,

      (
        select count(*)::integer
        from public.test_participations tp
        where tp.campaign_id = c.id
          and tp.status in (
            'waiting_access',
            'access_enabled',
            'active',
            'completed'
          )
      ) as covered_testers,

      c.published_at

    from public.test_campaigns c

    join public.apps a
      on a.id = c.app_id

    where c.status in (
      'recruiting',
      'testing'
    )

      and a.archived_at is null

      -- Las rondas propias se administran desde My Apps,
      -- no desde Explore.
      and a.owner_id <> v_user_id

      and (
        p_platform is null
        or c.platform = p_platform
      )

      and (
        c.all_countries = true

        or exists (
          select 1
          from public.campaign_countries cc
          where cc.campaign_id = c.id
            and cc.country_code = upper(v_country_code)
        )
      )
  )

  select
    d.campaign_id,
    d.app_id,
    d.app_name,
    d.app_description,
    d.platform,
    d.status,
    d.min_os_major,
    d.min_os_minor,
    d.target_testers,
    d.duration_days,
    d.all_countries,
    d.country_codes,
    d.covered_testers,

    greatest(
      d.target_testers - d.covered_testers,
      0
    )::integer as available_slots,

    d.published_at,

    count(*) over() as total_count

  from discovery d

  order by
    d.published_at desc nulls last,
    d.campaign_id

  limit p_limit
  offset p_offset;

end;
$$;


-- =========================================================
-- 2. GET CAMPAIGN DETAIL
-- =========================================================

create or replace function public.get_campaign_detail(
  p_campaign_id uuid
)
returns table (
  campaign_id uuid,
  app_id uuid,
  app_name text,
  app_description text,
  platform public.platform_type,
  status public.campaign_status,
  min_os_major smallint,
  min_os_minor smallint,
  target_testers integer,
  duration_days integer,
  all_countries boolean,
  country_codes text[],
  instructions text,
  covered_testers integer,
  available_slots integer,
  published_at timestamptz,

  own_participation_id uuid,
  own_participation_status public.participation_status,
  own_joined_at timestamptz,
  own_expected_end_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_country_code text;
begin

  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select p.country_code
  into v_country_code
  from public.profiles p
  where p.id = v_user_id;

  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  if v_country_code is null
     or not public.is_valid_country_code(v_country_code) then
    raise exception 'PROFILE_COUNTRY_REQUIRED';
  end if;

  return query
  with detail as (
    select
      c.id as campaign_id,
      a.id as app_id,
      a.name as app_name,
      a.description as app_description,
      c.platform,
      c.status,
      c.min_os_major,
      c.min_os_minor,
      c.target_testers,
      c.duration_days,
      c.all_countries,

      coalesce(
        (
          select array_agg(cc.country_code::text order by cc.country_code)
          from public.campaign_countries cc
          where cc.campaign_id = c.id
        ),
        array[]::text[]
      ) as country_codes,

      c.instructions,

      (
        select count(*)::integer
        from public.test_participations tp
        where tp.campaign_id = c.id
          and tp.status in (
            'waiting_access',
            'access_enabled',
            'active',
            'completed'
          )
      ) as covered_testers,

      c.published_at

    from public.test_campaigns c

    join public.apps a
      on a.id = c.app_id

    where c.id = p_campaign_id

      and c.status in (
        'recruiting',
        'testing'
      )

      and a.archived_at is null

      -- Las rondas propias pertenecen al flujo My Apps.
      and a.owner_id <> v_user_id

      and (
        c.all_countries = true

        or exists (
          select 1
          from public.campaign_countries cc
          where cc.campaign_id = c.id
            and cc.country_code = upper(v_country_code)
        )
      )
  )

  select
    d.campaign_id,
    d.app_id,
    d.app_name,
    d.app_description,
    d.platform,
    d.status,
    d.min_os_major,
    d.min_os_minor,
    d.target_testers,
    d.duration_days,
    d.all_countries,
    d.country_codes,
    d.instructions,
    d.covered_testers,

    greatest(
      d.target_testers - d.covered_testers,
      0
    )::integer as available_slots,

    d.published_at,

    tp.id as own_participation_id,
    tp.status as own_participation_status,
    tp.joined_at as own_joined_at,
    tp.expected_end_at as own_expected_end_at

  from detail d

  left join public.test_participations tp
    on tp.campaign_id = d.campaign_id
   and tp.tester_id = v_user_id;

  if not found then
    raise exception 'CAMPAIGN_NOT_AVAILABLE';
  end if;

end;
$$;


-- =========================================================
-- 3. PERMISSIONS
-- =========================================================

revoke all
on function public.list_available_campaigns(
  public.platform_type,
  integer,
  integer
)
from public;

revoke execute
on function public.list_available_campaigns(
  public.platform_type,
  integer,
  integer
)
from anon;

revoke execute
on function public.list_available_campaigns(
  public.platform_type,
  integer,
  integer
)
from service_role;

grant execute
on function public.list_available_campaigns(
  public.platform_type,
  integer,
  integer
)
to authenticated;


revoke all
on function public.get_campaign_detail(uuid)
from public;

revoke execute
on function public.get_campaign_detail(uuid)
from anon;

revoke execute
on function public.get_campaign_detail(uuid)
from service_role;

grant execute
on function public.get_campaign_detail(uuid)
to authenticated;
create or replace function public.get_dashboard_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_country_code text;
  v_result jsonb;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select p.country_code
  into v_country_code
  from public.profiles p
  where p.id = v_user_id;

  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  if v_country_code is null
     or not public.is_valid_country_code(v_country_code) then
    raise exception 'PROFILE_COUNTRY_REQUIRED';
  end if;

  select jsonb_build_object(
    'initial_intent', (
      select p.initial_intent
      from public.profiles p
      where p.id = v_user_id
    ),
    'metrics', jsonb_build_object(
      'tester_active_tests', (select count(*)::integer from public.test_participations tp where tp.tester_id = v_user_id and tp.status in ('access_enabled', 'active')),
      'waiting_for_access', (select count(*)::integer from public.test_participations tp where tp.tester_id = v_user_id and tp.status = 'waiting_access'),
      'feedback_pending', (select count(*)::integer from public.test_participations tp where tp.tester_id = v_user_id and tp.status = 'active' and not exists (select 1 from public.test_participation_feedback f where f.participation_id = tp.id and f.feedback_text ~ '[^[:space:]]')),
      'ready_to_complete', (select count(*)::integer from public.test_participations tp where tp.tester_id = v_user_id and tp.status = 'active' and tp.expected_end_at is not null and now() >= tp.expected_end_at and exists (select 1 from public.test_participation_feedback f where f.participation_id = tp.id and f.feedback_text ~ '[^[:space:]]')),
      'active_campaigns', (select count(*)::integer from public.test_campaigns c join public.apps a on a.id = c.app_id where a.owner_id = v_user_id and c.status in ('recruiting', 'testing')),
      'owner_waiting_access', (select count(*)::integer from public.test_participations tp join public.test_campaigns c on c.id = tp.campaign_id join public.apps a on a.id = c.app_id where a.owner_id = v_user_id and tp.status = 'waiting_access'),
      'owner_testers_in_progress', (select count(*)::integer from public.test_participations tp join public.test_campaigns c on c.id = tp.campaign_id join public.apps a on a.id = c.app_id where a.owner_id = v_user_id and tp.status in ('access_enabled', 'active')),
      'completed_campaigns', (select count(*)::integer from public.test_campaigns c join public.apps a on a.id = c.app_id where a.owner_id = v_user_id and c.status = 'completed')
    ),
    'tests', coalesce((
      select jsonb_agg(to_jsonb(test_row))
      from (
        select
          tp.id as participation_id,
          tp.campaign_id,
          c.app_id,
          a.name as app_name,
          tp.status,
          tp.installed_at,
          tp.expected_end_at,
          c.duration_days,
          case
            when tp.installed_at is not null
              and tp.expected_end_at is not null
              and tp.expected_end_at > tp.installed_at
            then least(
              100,
              greatest(
                0,
                floor(
                  extract(epoch from (least(now(), tp.expected_end_at) - tp.installed_at))
                  * 100
                  / extract(epoch from (tp.expected_end_at - tp.installed_at))
                )::integer
              )
            )
            else null
          end as progress_percent
        from public.test_participations tp
        join public.test_campaigns c on c.id = tp.campaign_id
        join public.apps a on a.id = c.app_id
        where tp.tester_id = v_user_id
          and tp.status in ('waiting_access', 'access_enabled', 'active')
        order by tp.joined_at desc, tp.id
        limit 3
      ) as test_row
    ), '[]'::jsonb),
    'recent_activity', jsonb_build_object(
      'tester', coalesce((
        select jsonb_agg(to_jsonb(activity_row)) from (
          select pe.event_type, pe.created_at, c.id as campaign_id, a.name as app_name
          from public.participation_events pe
          join public.test_participations tp on tp.id = pe.participation_id
          join public.test_campaigns c on c.id = tp.campaign_id
          join public.apps a on a.id = c.app_id
          where tp.tester_id = v_user_id
          order by pe.created_at desc, pe.id desc limit 3
        ) activity_row
      ), '[]'::jsonb),
      'developer', coalesce((
        select jsonb_agg(to_jsonb(activity_row)) from (
          select pe.event_type, pe.created_at, c.id as campaign_id, a.name as app_name
          from public.participation_events pe
          join public.test_participations tp on tp.id = pe.participation_id
          join public.test_campaigns c on c.id = tp.campaign_id
          join public.apps a on a.id = c.app_id
          where a.owner_id = v_user_id
          order by pe.created_at desc, pe.id desc limit 3
        ) activity_row
      ), '[]'::jsonb)
    ),
    'campaigns_for_you', coalesce((
      select jsonb_agg(to_jsonb(campaign_row))
      from (
        select
          c.id as campaign_id,
          c.app_id,
          a.name as app_name,
          a.description as app_description,
          c.platform,
          c.status,
          c.duration_days,
          c.target_testers,
          c.all_countries,
          coalesce(
            (
              select array_agg(cc.country_code::text order by cc.country_code)
              from public.campaign_countries cc
              where cc.campaign_id = c.id
            ),
            array[]::text[]
          ) as country_codes,
          coverage.covered_testers,
          greatest(c.target_testers - coverage.covered_testers, 0) as available_slots
        from public.test_campaigns c
        join public.apps a on a.id = c.app_id
        cross join lateral (
          select count(*)::integer as covered_testers
          from public.test_participations tp
          where tp.campaign_id = c.id
            and tp.status in ('waiting_access', 'access_enabled', 'active', 'completed')
        ) as coverage
        where c.status in ('recruiting', 'testing')
          and a.archived_at is null
          and a.owner_id <> v_user_id
          and (
            c.all_countries
            or exists (
              select 1
              from public.campaign_countries cc
              where cc.campaign_id = c.id
                and cc.country_code = upper(v_country_code)
            )
          )
        order by c.published_at desc nulls last, c.id
        limit 3
      ) as campaign_row
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_dashboard_data() from public;
revoke all on function public.get_dashboard_data() from anon;
revoke all on function public.get_dashboard_data() from service_role;
grant execute on function public.get_dashboard_data() to authenticated;


-- Enforce nonempty specific-country availability for direct campaign RPC calls.
-- =========================================================
-- campaign_create_and_update.sql
--
-- Operaciones:
--   create_campaign(...)
--   update_campaign(...)
-- =========================================================


-- =========================================================
-- 1. CREATE CAMPAIGN
-- =========================================================

create or replace function public.create_campaign(
  p_app_id uuid,
  p_platform public.platform_type,
  p_target_testers integer,
  p_duration_days integer,
  p_all_countries boolean default false,
  p_min_os_major smallint default null,
  p_min_os_minor smallint default null,
  p_opt_in_url text default null,
  p_store_url text default null,
  p_instructions text default null,
  p_country_codes text[] default null
)
returns public.test_campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_app public.apps%rowtype;
  v_campaign public.test_campaigns%rowtype;
  v_country text;
begin

  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select *
  into v_app
  from public.apps
  where id = p_app_id
  for update;

  if not found then
    raise exception 'APP_NOT_FOUND';
  end if;

  if v_app.owner_id <> v_user_id then
    raise exception 'NOT_APP_OWNER';
  end if;

  if v_app.archived_at is not null then
    raise exception 'APP_ARCHIVED';
  end if;

  if p_target_testers is null or p_target_testers < 1 then
    raise exception 'INVALID_TARGET_TESTERS';
  end if;

  if p_duration_days is null or p_duration_days < 1 then
    raise exception 'INVALID_DURATION_DAYS';
  end if;

  if p_min_os_minor is not null and p_min_os_major is null then
    raise exception 'INVALID_OS_VERSION';
  end if;

  if p_min_os_major is not null and p_min_os_major < 0 then
    raise exception 'INVALID_OS_VERSION';
  end if;

  if p_min_os_minor is not null and p_min_os_minor < 0 then
    raise exception 'INVALID_OS_VERSION';
  end if;

  -- Specific availability requires at least one selected country, including draft creation.
  if not coalesce(p_all_countries, false)
     and coalesce(cardinality(p_country_codes), 0) = 0 then
    raise exception 'CAMPAIGN_COUNTRIES_REQUIRED';
  end if;

  insert into public.test_campaigns (
    app_id,
    platform,
    min_os_major,
    min_os_minor,
    target_testers,
    duration_days,
    all_countries,
    opt_in_url,
    store_url,
    instructions,
    status
  )
  values (
    p_app_id,
    p_platform,
    p_min_os_major,
    p_min_os_minor,
    p_target_testers,
    p_duration_days,
    coalesce(p_all_countries, false),
    nullif(trim(p_opt_in_url), ''),
    nullif(trim(p_store_url), ''),
    nullif(trim(p_instructions), ''),
    'draft'
  )
  returning *
  into v_campaign;

  if coalesce(p_all_countries, false) = false
     and p_country_codes is not null then

    foreach v_country in array p_country_codes loop

      v_country := upper(trim(v_country));

      if v_country is null or length(v_country) <> 2 then
        raise exception 'INVALID_COUNTRY_CODE';
      end if;

      insert into public.campaign_countries (
        campaign_id,
        country_code
      )
      values (
        v_campaign.id,
        v_country
      )
      on conflict do nothing;

    end loop;

  end if;

  return v_campaign;

end;
$$;


-- =========================================================
-- 2. UPDATE CAMPAIGN
-- =========================================================

create or replace function public.update_campaign(
  p_campaign_id uuid,
  p_platform public.platform_type default null,
  p_target_testers integer default null,
  p_duration_days integer default null,
  p_all_countries boolean default null,
  p_min_os_major smallint default null,
  p_min_os_minor smallint default null,
  p_opt_in_url text default null,
  p_store_url text default null,
  p_instructions text default null,
  p_country_codes text[] default null,
  p_min_os_major_set boolean default false,
  p_min_os_minor_set boolean default false
)
returns public.test_campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_campaign public.test_campaigns%rowtype;
  v_app public.apps%rowtype;
  v_has_participations boolean;
  v_covered_testers integer;
  v_country text;
  v_min_os_major smallint;
  v_min_os_minor smallint;
begin

  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select *
  into v_campaign
  from public.test_campaigns
  where id = p_campaign_id
  for update;

  if not found then
    raise exception 'CAMPAIGN_NOT_FOUND';
  end if;

  select *
  into v_app
  from public.apps
  where id = v_campaign.app_id;

  if not found then
    raise exception 'APP_NOT_FOUND';
  end if;

  if v_app.owner_id <> v_user_id then
    raise exception 'NOT_CAMPAIGN_OWNER';
  end if;

  if v_app.archived_at is not null then
    raise exception 'APP_ARCHIVED';
  end if;

  if v_campaign.status in ('completed', 'cancelled') then
    raise exception 'INVALID_CAMPAIGN_STATE';
  end if;

  select exists (
    select 1
    from public.test_participations
    where campaign_id = p_campaign_id
  )
  into v_has_participations;

  select count(*)
  into v_covered_testers
  from public.test_participations
  where campaign_id = p_campaign_id
    and status in (
      'waiting_access',
      'access_enabled',
      'active',
      'completed'
    );

  v_min_os_major := case
    when p_min_os_major_set then p_min_os_major
    else v_campaign.min_os_major
  end;

  v_min_os_minor := case
    when p_min_os_minor_set then p_min_os_minor
    else v_campaign.min_os_minor
  end;

  if p_target_testers is not null then
    if p_target_testers < 1 then
      raise exception 'INVALID_TARGET_TESTERS';
    end if;

    if p_target_testers < v_covered_testers then
      raise exception 'TARGET_BELOW_COVERED_TESTERS';
    end if;
  end if;

  if p_duration_days is not null and p_duration_days < 1 then
    raise exception 'INVALID_DURATION_DAYS';
  end if;

  if (v_min_os_minor is not null and v_min_os_major is null)
     or (v_min_os_major is not null and v_min_os_major < 0)
     or (v_min_os_minor is not null and v_min_os_minor < 0) then
    raise exception 'INVALID_OS_VERSION';
  end if;

  -- Después de la primera participación,
  -- los términos estructurales quedan congelados.
  if v_has_participations then

    if p_platform is not null
       and p_platform <> v_campaign.platform then
      raise exception 'STRUCTURAL_FIELDS_LOCKED';
    end if;

    if p_duration_days is not null
       and p_duration_days <> v_campaign.duration_days then
      raise exception 'STRUCTURAL_FIELDS_LOCKED';
    end if;

    if p_all_countries is not null
       and p_all_countries <> v_campaign.all_countries then
      raise exception 'STRUCTURAL_FIELDS_LOCKED';
    end if;

    if p_min_os_major_set
       and v_min_os_major is distinct from v_campaign.min_os_major then
      raise exception 'STRUCTURAL_FIELDS_LOCKED';
    end if;

    if p_min_os_minor_set
       and v_min_os_minor is distinct from v_campaign.min_os_minor then
      raise exception 'STRUCTURAL_FIELDS_LOCKED';
    end if;

    if p_country_codes is not null then
      raise exception 'STRUCTURAL_FIELDS_LOCKED';
    end if;

  end if;

  -- Check after structural locks, preserving their precedence for existing participants.
  if not coalesce(p_all_countries, v_campaign.all_countries) and (
    (p_country_codes is not null and cardinality(p_country_codes) = 0)
    or (p_country_codes is null and not exists (
      select 1 from public.campaign_countries cc where cc.campaign_id = p_campaign_id
    ))
  ) then
    raise exception 'CAMPAIGN_COUNTRIES_REQUIRED';
  end if;

  update public.test_campaigns
  set
    platform = coalesce(p_platform, platform),
    target_testers = coalesce(p_target_testers, target_testers),
    duration_days = coalesce(p_duration_days, duration_days),
    all_countries = coalesce(p_all_countries, all_countries),
    min_os_major = v_min_os_major,
    min_os_minor = v_min_os_minor,
    opt_in_url = case
      when p_opt_in_url is null then opt_in_url
      else nullif(trim(p_opt_in_url), '')
    end,
    store_url = case
      when p_store_url is null then store_url
      else nullif(trim(p_store_url), '')
    end,
    instructions = case
      when p_instructions is null then instructions
      else nullif(trim(p_instructions), '')
    end
  where id = p_campaign_id
  returning *
  into v_campaign;

  -- Países solo pueden modificarse mientras no existan participaciones.
  if not v_has_participations
     and p_country_codes is not null then

    delete from public.campaign_countries
    where campaign_id = p_campaign_id;

    if v_campaign.all_countries = false then

      foreach v_country in array p_country_codes loop

        v_country := upper(trim(v_country));

        if v_country is null or length(v_country) <> 2 then
          raise exception 'INVALID_COUNTRY_CODE';
        end if;

        insert into public.campaign_countries (
          campaign_id,
          country_code
        )
        values (
          p_campaign_id,
          v_country
        )
        on conflict do nothing;

      end loop;

    end if;

  end if;

  return v_campaign;

end;
$$;


-- =========================================================
-- 3. PERMISOS
-- =========================================================

revoke all
on function public.create_campaign(
  uuid,
  public.platform_type,
  integer,
  integer,
  boolean,
  smallint,
  smallint,
  text,
  text,
  text,
  text[]
)
from public;

revoke execute
on function public.create_campaign(
  uuid,
  public.platform_type,
  integer,
  integer,
  boolean,
  smallint,
  smallint,
  text,
  text,
  text,
  text[]
)
from anon;

revoke execute
on function public.create_campaign(
  uuid,
  public.platform_type,
  integer,
  integer,
  boolean,
  smallint,
  smallint,
  text,
  text,
  text,
  text[]
)
from service_role;

grant execute
on function public.create_campaign(
  uuid,
  public.platform_type,
  integer,
  integer,
  boolean,
  smallint,
  smallint,
  text,
  text,
  text,
  text[]
)
to authenticated;


revoke all
on function public.update_campaign(
  uuid,
  public.platform_type,
  integer,
  integer,
  boolean,
  smallint,
  smallint,
  text,
  text,
  text,
  text[],
  boolean,
  boolean
)
from public;

revoke execute
on function public.update_campaign(
  uuid,
  public.platform_type,
  integer,
  integer,
  boolean,
  smallint,
  smallint,
  text,
  text,
  text,
  text[],
  boolean,
  boolean
)
from anon;

revoke execute
on function public.update_campaign(
  uuid,
  public.platform_type,
  integer,
  integer,
  boolean,
  smallint,
  smallint,
  text,
  text,
  text,
  text[],
  boolean,
  boolean
)
from service_role;

grant execute
on function public.update_campaign(
  uuid,
  public.platform_type,
  integer,
  integer,
  boolean,
  smallint,
  smallint,
  text,
  text,
  text,
  text[],
  boolean,
  boolean
)
to authenticated;
