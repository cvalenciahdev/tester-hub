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