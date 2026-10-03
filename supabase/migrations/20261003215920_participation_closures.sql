-- =========================================================
-- 004_participation_closures.sql
--
-- Operaciones:
--   complete_participation(participation_id)
--   mark_incompatible(participation_id, reason)
--   abandon_participation(participation_id, reason)
--   cancel_participation(participation_id, reason)
-- =========================================================


-- =========================================================
-- 1. COMPLETE PARTICIPATION
-- =========================================================

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
  v_participation public.test_participations%rowtype;
begin

  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
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

  return v_participation;

end;
$$;


-- =========================================================
-- 2. MARK INCOMPATIBLE
-- =========================================================

create or replace function public.mark_incompatible(
  p_participation_id uuid,
  p_reason text
)
returns public.test_participations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_participation public.test_participations%rowtype;
begin

  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'REASON_REQUIRED';
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

  if v_participation.status not in (
    'waiting_access',
    'access_enabled',
    'active'
  ) then
    raise exception 'INVALID_PARTICIPATION_STATE';
  end if;

  update public.test_participations
  set
    status = 'incompatible',
    closed_at = now(),
    close_reason = trim(p_reason)
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
    'marked_incompatible',
    v_user_id,
    jsonb_build_object(
      'reason',
      trim(p_reason)
    )
  );

  return v_participation;

end;
$$;


-- =========================================================
-- 3. ABANDON PARTICIPATION
-- =========================================================

create or replace function public.abandon_participation(
  p_participation_id uuid,
  p_reason text default null
)
returns public.test_participations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_participation public.test_participations%rowtype;
  v_reason text;
begin

  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  v_reason := nullif(trim(p_reason), '');

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

  if v_participation.status not in (
    'waiting_access',
    'access_enabled',
    'active'
  ) then
    raise exception 'INVALID_PARTICIPATION_STATE';
  end if;

  update public.test_participations
  set
    status = 'abandoned',
    closed_at = now(),
    close_reason = v_reason
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
    'abandoned',
    v_user_id,
    case
      when v_reason is null then '{}'::jsonb
      else jsonb_build_object('reason', v_reason)
    end
  );

  return v_participation;

end;
$$;


-- =========================================================
-- 4. CANCEL PARTICIPATION
-- =========================================================

create or replace function public.cancel_participation(
  p_participation_id uuid,
  p_reason text default null
)
returns public.test_participations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_participation public.test_participations%rowtype;
  v_campaign public.test_campaigns%rowtype;
  v_app public.apps%rowtype;
  v_reason text;
begin

  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  v_reason := nullif(trim(p_reason), '');

  select *
  into v_participation
  from public.test_participations
  where id = p_participation_id
  for update;

  if not found then
    raise exception 'PARTICIPATION_NOT_FOUND';
  end if;

  select *
  into v_campaign
  from public.test_campaigns
  where id = v_participation.campaign_id;

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

  if v_participation.status not in (
    'waiting_access',
    'access_enabled',
    'active'
  ) then
    raise exception 'INVALID_PARTICIPATION_STATE';
  end if;

  update public.test_participations
  set
    status = 'cancelled',
    closed_at = now(),
    close_reason = v_reason
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
    'cancelled',
    v_user_id,
    case
      when v_reason is null then '{}'::jsonb
      else jsonb_build_object('reason', v_reason)
    end
  );

  return v_participation;

end;
$$;


-- =========================================================
-- 5. PERMISSIONS
-- =========================================================

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


revoke all
on function public.mark_incompatible(uuid, text)
from public;

revoke execute
on function public.mark_incompatible(uuid, text)
from anon;

revoke execute
on function public.mark_incompatible(uuid, text)
from service_role;

grant execute
on function public.mark_incompatible(uuid, text)
to authenticated;


revoke all
on function public.abandon_participation(uuid, text)
from public;

revoke execute
on function public.abandon_participation(uuid, text)
from anon;

revoke execute
on function public.abandon_participation(uuid, text)
from service_role;

grant execute
on function public.abandon_participation(uuid, text)
to authenticated;


revoke all
on function public.cancel_participation(uuid, text)
from public;

revoke execute
on function public.cancel_participation(uuid, text)
from anon;

revoke execute
on function public.cancel_participation(uuid, text)
from service_role;

grant execute
on function public.cancel_participation(uuid, text)
to authenticated;