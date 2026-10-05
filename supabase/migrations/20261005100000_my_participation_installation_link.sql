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
        'closed_at', closed_at, 'close_reason', close_reason, 'can_complete', can_complete
      ) order by joined_at desc, participation_id
    ), '[]'::jsonb)
  ) into v_result from own;
  return v_result;
end;
$$;

revoke all on function public.list_my_participations() from public;
revoke execute on function public.list_my_participations() from anon, service_role;
grant execute on function public.list_my_participations() to authenticated;
