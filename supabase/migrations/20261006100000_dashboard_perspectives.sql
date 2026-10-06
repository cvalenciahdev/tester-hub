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
     or length(trim(v_country_code)) <> 2 then
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
