-- Installation link is returned only for the caller's access_enabled/active participations.
create or replace function public.list_my_participations()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  with own as (
    select tp.id as participation_id, tp.campaign_id, a.name as app_name,
      c.platform, c.status as campaign_status, tp.status as participation_status,
      c.duration_days, case when tp.status in ('access_enabled', 'active') then c.store_url else null end as store_url,
      tp.installed_at, tp.expected_end_at, tp.closed_at, tp.close_reason,
      (tp.status = 'active' and tp.expected_end_at is not null and now() >= tp.expected_end_at) as can_complete,
      tp.joined_at
    from public.test_participations tp
    join public.test_campaigns c on c.id = tp.campaign_id
    join public.apps a on a.id = c.app_id
    where tp.tester_id = v_user_id
  )
  select jsonb_build_object(
    'metrics', jsonb_build_object(
      'in_progress', count(*) filter (where participation_status in ('access_enabled', 'active')),
      'waiting_access', count(*) filter (where participation_status = 'waiting_access'),
      'completed', count(*) filter (where participation_status = 'completed')
    ),
    'participations', coalesce(jsonb_agg(
      jsonb_build_object(
        'participation_id', participation_id, 'campaign_id', campaign_id,
        'app_name', app_name, 'platform', platform, 'campaign_status', campaign_status,
        'participation_status', participation_status, 'duration_days', duration_days, 'store_url', store_url,
        'installed_at', installed_at, 'expected_end_at', expected_end_at,
        'closed_at', closed_at, 'close_reason', close_reason, 'can_complete', can_complete,
        'feedbacks', coalesce((select jsonb_agg(jsonb_build_object(
          'feedback_id', f.id, 'feedback_text', f.feedback_text, 'created_at', f.created_at, 'updated_at', f.updated_at
        ) order by f.created_at, f.id) from public.test_participation_feedback f
          where f.participation_id = own.participation_id and f.author_id = v_user_id), '[]'::jsonb)
      ) order by joined_at desc, participation_id
    ), '[]'::jsonb)
  ) into v_result from own;
  return v_result;
end;
$$;

revoke all on function public.list_my_participations() from public;
revoke execute on function public.list_my_participations() from anon, service_role;
grant execute on function public.list_my_participations() to authenticated;

-- Owner-only tracking. Independent of discovery, country and app archive state.
create or replace function public.get_campaign_tracking(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_campaign public.test_campaigns%rowtype;
  v_app public.apps%rowtype;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  select c.* into v_campaign
  from public.test_campaigns c
  join public.apps a on a.id = c.app_id
  where c.id = p_campaign_id and a.owner_id = v_user_id;
  if not found then
    raise exception 'CAMPAIGN_NOT_AVAILABLE';
  end if;
  select * into v_app from public.apps where id = v_campaign.app_id;

  with scoped as (
    select tp.id as participation_id, tp.tester_id, p.display_name, p.country_code,
      tp.testing_email_snapshot, tp.status as participation_status, tp.joined_at,
      tp.access_enabled_at, tp.installed_at, tp.expected_end_at, tp.closed_at, tp.close_reason
    from public.test_participations tp
    left join public.profiles p on p.id = tp.tester_id
    where tp.campaign_id = v_campaign.id
  ), metrics as (
    select count(*) as total,
      count(*) filter (where participation_status = 'waiting_access') as waiting,
      count(*) filter (where participation_status = 'access_enabled') as enabled,
      count(*) filter (where participation_status = 'active') as active,
      count(*) filter (where participation_status = 'completed') as completed,
      count(*) filter (where participation_status = 'incompatible') as incompatible,
      count(*) filter (where participation_status = 'abandoned') as abandoned,
      count(*) filter (where participation_status = 'cancelled') as cancelled
    from scoped
  )
  select jsonb_build_object(
    'campaign', jsonb_build_object(
      'campaign_id', v_campaign.id, 'app_id', v_app.id, 'app_name', v_app.name,
      'platform', v_campaign.platform, 'campaign_status', v_campaign.status,
      'target_testers', v_campaign.target_testers, 'duration_days', v_campaign.duration_days,
      'covered_testers', m.waiting + m.enabled + m.active + m.completed,
      'available_slots', greatest(v_campaign.target_testers - (m.waiting + m.enabled + m.active + m.completed), 0),
      'total_participations', m.total, 'waiting_access_count', m.waiting,
      'access_enabled_count', m.enabled, 'active_count', m.active, 'completed_count', m.completed,
      'incompatible_count', m.incompatible, 'abandoned_count', m.abandoned, 'cancelled_count', m.cancelled
    ),
    'participations', coalesce((select jsonb_agg(
      jsonb_build_object(
        'participation_id', participation_id, 'tester_id', tester_id,
        'display_name', display_name, 'country_code', country_code,
        'testing_email_snapshot', testing_email_snapshot, 'participation_status', participation_status,
        'joined_at', joined_at, 'access_enabled_at', access_enabled_at, 'installed_at', installed_at,
        'expected_end_at', expected_end_at, 'closed_at', closed_at, 'close_reason', close_reason,
        'feedbacks', coalesce((select jsonb_agg(jsonb_build_object(
          'feedback_id', f.id, 'feedback_text', f.feedback_text, 'created_at', f.created_at, 'updated_at', f.updated_at
        ) order by f.created_at, f.id) from public.test_participation_feedback f
          where f.participation_id = scoped.participation_id), '[]'::jsonb)
      ) order by joined_at desc, participation_id
    ) from scoped), '[]'::jsonb)
  ) into v_result from metrics m;
  return v_result;
end;
$$;

comment on function public.get_campaign_tracking(uuid) is
  'Owner-only history. country_code is the current profile value, not a historical snapshot; testing_email_snapshot is the participation snapshot.';
revoke all on function public.get_campaign_tracking(uuid) from public;
revoke execute on function public.get_campaign_tracking(uuid) from anon, service_role;
grant execute on function public.get_campaign_tracking(uuid) to authenticated;
