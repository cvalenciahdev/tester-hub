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
     or length(trim(v_country_code)) <> 2 then
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
     or length(trim(v_country_code)) <> 2 then
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