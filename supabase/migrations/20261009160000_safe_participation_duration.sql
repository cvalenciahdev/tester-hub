-- Technical representability guard, not an Android/Google Play product limit.
-- Four-digit ISO years match the existing PostgREST JSON -> Date.parse consumer contract.
create or replace function public._safe_participation_end_at(p_installed_at timestamptz, p_duration_days integer)
returns timestamptz language plpgsql security invoker set search_path = '' as $$
declare v_end timestamptz;
begin
  if p_duration_days is null or p_duration_days < 1 then
    raise exception 'INVALID_DURATION_DAYS';
  end if;
  if p_installed_at is null or not pg_catalog.isfinite(p_installed_at) then
    raise exception 'DURATION_OUT_OF_RANGE';
  end if;
  begin
    -- Preserve the existing calendar-day/timezone semantics, including DST.
    v_end := p_installed_at + pg_catalog.make_interval(days => p_duration_days);
    -- Keep conversion/range checks inside the protected calculation as well.
    if not pg_catalog.isfinite(v_end)
       or v_end < timestamptz '0001-01-01 00:00:00+00'
       or v_end >= timestamptz '10000-01-01 00:00:00+00'
       or extract(year from v_end) not between 1 and 9999 then
      raise exception 'DURATION_OUT_OF_RANGE';
    end if;
  exception
    when datetime_field_overflow or interval_field_overflow or numeric_value_out_of_range then
      raise exception 'DURATION_OUT_OF_RANGE';
  end;
  return v_end;
end;
$$;
revoke all on function public._safe_participation_end_at(timestamptz,integer)
from public, anon, authenticated, service_role;

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

  if p_platform = 'ios' and p_duration_days > 90 then
    raise exception 'IOS_DURATION_EXCEEDED';
  end if;

  -- Reject dates outside the current database/application representation, not a product duration cap.
  perform public._safe_participation_end_at(now(), p_duration_days);

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

  -- Unlocked legacy durations require correction; locked unchanged values remain visible/read-only.
  if not v_has_participations
     and coalesce(p_platform, v_campaign.platform) = 'ios'
     and coalesce(p_duration_days, v_campaign.duration_days) > 90 then
    raise exception 'IOS_DURATION_EXCEEDED';
  end if;

  -- Locked unchanged legacy durations stay untouched; installation always rechecks its actual anchor.
  if not v_has_participations then
    perform public._safe_participation_end_at(now(), coalesce(p_duration_days, v_campaign.duration_days));
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

  -- Reuse the central evaluator while this transaction still holds the campaign lock.
  -- Refresh the return row: UPDATE RETURNING above predates the helper's state change.
  if p_target_testers is not null then
    perform public._evaluate_campaign_completion(p_campaign_id);

    select *
    into v_campaign
    from public.test_campaigns
    where id = p_campaign_id;
  end if;

  return v_campaign;

end;
$$;

create or replace function public.confirm_installation(
  p_participation_id uuid
)
returns public.test_participations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_campaign_id uuid;
  v_tester_id uuid;
  v_participation public.test_participations%rowtype;
  v_campaign public.test_campaigns%rowtype;
  v_installed_at timestamptz;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select campaign_id, tester_id
  into v_campaign_id, v_tester_id
  from public.test_participations
  where id = p_participation_id;

  if not found then
    raise exception 'PARTICIPATION_NOT_FOUND';
  end if;

  if v_tester_id <> v_user_id then
    raise exception 'NOT_PARTICIPATION_TESTER';
  end if;

  select *
  into v_campaign
  from public.test_campaigns
  where id = v_campaign_id
  for update;

  if not found then
    raise exception 'CAMPAIGN_NOT_FOUND';
  end if;

  select *
  into v_participation
  from public.test_participations
  where id = p_participation_id
  for update;

  if not found then
    raise exception 'PARTICIPATION_NOT_FOUND';
  end if;

  if v_participation.tester_id <> v_user_id then
    raise exception 'NOT_PARTICIPATION_TESTER';
  end if;

  if v_participation.status <> 'access_enabled' then
    raise exception 'INVALID_PARTICIPATION_STATE';
  end if;

  v_installed_at := now();

  update public.test_participations
  set
    status = 'active',
    installed_at = v_installed_at,
    expected_end_at =
      public._safe_participation_end_at(v_installed_at, v_campaign.duration_days)
  where id = p_participation_id
  returning *
  into v_participation;

  if v_campaign.status = 'recruiting' then
    update public.test_campaigns
    set
      status = 'testing',
      testing_started_at = coalesce(
        testing_started_at,
        v_installed_at
      )
    where id = v_campaign.id;
  end if;

  insert into public.participation_events (
    participation_id,
    event_type,
    actor_user_id,
    metadata
  )
  values (
    v_participation.id,
    'installation_confirmed',
    v_user_id,
    '{}'::jsonb
  );

  return v_participation;
end;
$$;
