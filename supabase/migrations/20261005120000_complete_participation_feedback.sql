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

  if not exists (
    select 1 from public.test_participation_feedback
    where participation_id = p_participation_id and feedback_text ~ '[^[:space:]]'
  ) then
    raise exception 'FEEDBACK_REQUIRED';
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
