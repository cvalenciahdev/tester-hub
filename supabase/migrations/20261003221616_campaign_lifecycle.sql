-- =========================================================
-- Campaign lifecycle operations and automatic completion.
-- =========================================================


-- Internal helper: close a testing campaign once its target is
-- completed and no participants remain in an open state.
create or replace function public._evaluate_campaign_completion(
  p_campaign_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.test_campaigns%rowtype;
  v_completed_count integer;
begin
  select *
  into v_campaign
  from public.test_campaigns
  where id = p_campaign_id
  for update;

  if not found or v_campaign.status <> 'testing' then
    return;
  end if;

  if exists (
    select 1
    from public.test_participations tp
    where tp.campaign_id = p_campaign_id
      and tp.status in ('waiting_access', 'access_enabled', 'active')
  ) then
    return;
  end if;

  select count(*)
  into v_completed_count
  from public.test_participations tp
  where tp.campaign_id = p_campaign_id
    and tp.status = 'completed';

  if v_completed_count >= v_campaign.target_testers then
    update public.test_campaigns
    set
      status = 'completed',
      completed_at = now()
    where id = p_campaign_id
      and status = 'testing';
  end if;
end;
$$;

revoke all
on function public._evaluate_campaign_completion(uuid)
from public, anon, authenticated, service_role;


-- Publish a draft campaign after validating its owner and audience.
create or replace function public.publish_campaign(
  p_campaign_id uuid
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

  if v_campaign.status <> 'draft' then
    raise exception 'INVALID_CAMPAIGN_STATE';
  end if;

  if not v_campaign.all_countries and not exists (
    select 1
    from public.campaign_countries cc
    where cc.campaign_id = p_campaign_id
  ) then
    raise exception 'CAMPAIGN_COUNTRIES_REQUIRED';
  end if;

  update public.test_campaigns
  set
    status = 'recruiting',
    published_at = now()
  where id = p_campaign_id
  returning *
  into v_campaign;

  return v_campaign;
end;
$$;

revoke all
on function public.publish_campaign(uuid)
from public;

revoke execute
on function public.publish_campaign(uuid)
from anon;

revoke execute
on function public.publish_campaign(uuid)
from service_role;

grant execute
on function public.publish_campaign(uuid)
to authenticated;


-- Cancel a campaign and close all open participations atomically.
create or replace function public.cancel_campaign(
  p_campaign_id uuid,
  p_reason text default null
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
  v_reason text;
  v_close_reason text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  v_reason := nullif(trim(p_reason), '');

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

  if v_campaign.status not in ('draft', 'recruiting', 'testing') then
    raise exception 'INVALID_CAMPAIGN_STATE';
  end if;

  v_close_reason := 'Cancelled by campaign cancellation';
  if v_reason is not null then
    v_close_reason := v_close_reason || ': ' || v_reason;
  end if;

  update public.test_campaigns
  set
    status = 'cancelled',
    cancelled_at = now(),
    cancel_reason = v_reason
  where id = p_campaign_id
  returning *
  into v_campaign;

  with cancelled_participations as (
    update public.test_participations
    set
      status = 'cancelled',
      closed_at = now(),
      close_reason = v_close_reason
    where campaign_id = p_campaign_id
      and status in ('waiting_access', 'access_enabled', 'active')
    returning id
  )
  insert into public.participation_events (
    participation_id,
    event_type,
    actor_user_id,
    metadata
  )
  select
    cp.id,
    'cancelled',
    v_user_id,
    jsonb_build_object(
      'source', 'campaign_cancellation',
      'campaign_id', p_campaign_id,
      'reason', v_reason
    )
  from cancelled_participations cp;

  return v_campaign;
end;
$$;

revoke all
on function public.cancel_campaign(uuid, text)
from public;

revoke execute
on function public.cancel_campaign(uuid, text)
from anon;

revoke execute
on function public.cancel_campaign(uuid, text)
from service_role;

grant execute
on function public.cancel_campaign(uuid, text)
to authenticated;


-- Acquire campaign locks before participation locks. Campaign cancellation
-- uses this same lock order while closing all open participations.
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
      v_installed_at
      + make_interval(days => v_campaign.duration_days)
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

revoke all
on function public.confirm_installation(uuid)
from public;

revoke execute
on function public.confirm_installation(uuid)
from anon;

revoke execute
on function public.confirm_installation(uuid)
from service_role;

grant execute
on function public.confirm_installation(uuid)
to authenticated;


-- Preserve completion behavior and invoke automatic campaign completion
-- after the participation's completion event is recorded.
create or replace function public.complete_participation(
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

  perform 1
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

  if v_participation.status <> 'active' then
    raise exception 'INVALID_PARTICIPATION_STATE';
  end if;

  if v_participation.expected_end_at is null
     or now() < v_participation.expected_end_at then
    raise exception 'TEST_PERIOD_NOT_FINISHED';
  end if;

  update public.test_participations
  set
    status = 'completed',
    closed_at = now()
  where id = p_participation_id
  returning *
  into v_participation;

  insert into public.participation_events (
    participation_id,
    event_type,
    actor_user_id,
    metadata
  )
  values (
    v_participation.id,
    'completed',
    v_user_id,
    '{}'::jsonb
  );

  perform public._evaluate_campaign_completion(v_participation.campaign_id);

  return v_participation;
end;
$$;

revoke all
on function public.complete_participation(uuid)
from public;

revoke execute
on function public.complete_participation(uuid)
from anon;

revoke execute
on function public.complete_participation(uuid)
from service_role;

grant execute
on function public.complete_participation(uuid)
to authenticated;