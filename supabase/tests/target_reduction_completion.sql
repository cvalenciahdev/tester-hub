-- Local disposable database only, after all migrations. No remote/deployment execution.
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/target_reduction_completion.sql LOCAL_CONNECTION
-- All fixtures are rolled back, including on successful tests.
begin;

create temporary table completion_cases(name text primary key, campaign_id uuid not null);
grant select on completion_cases to authenticated;

do $$ begin
  for i in 1..8 loop
    insert into auth.users(id, email, raw_user_meta_data)
    values (format('31000000-0000-4000-8000-%s', lpad(i::text, 12, '0'))::uuid,
      format('target-test-%s@example.test', i), '{}');
  end loop;
end $$;
update public.profiles set country_code = 'MX', testing_email = 'testing@example.test', initial_intent = 'both'
where id::text like '31000000-0000-4000-8000-%';
insert into public.apps(id, owner_id, name)
values ('32000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 'Target completion fixture');

create function pg_temp.completion_fixture(p_name text, p_status public.campaign_status,
  p_target integer, p_completed integer, p_open boolean default false) returns void
language plpgsql as $$
declare c uuid := gen_random_uuid();
begin
  insert into public.test_campaigns(id, app_id, platform, target_testers, duration_days, all_countries,
    status, completed_at, cancelled_at)
  values (c, '32000000-0000-4000-8000-000000000001', 'android', p_target, 14, true, p_status,
    case when p_status = 'completed' then now() - interval '1 day' end,
    case when p_status = 'cancelled' then now() - interval '1 day' end);
  insert into completion_cases values(p_name, c);
  for i in 1..p_completed loop
    insert into public.test_participations(campaign_id, tester_id, testing_email_snapshot, status, closed_at)
    values(c, format('31000000-0000-4000-8000-%s', lpad((i+1)::text, 12, '0'))::uuid,
      'testing@example.test', 'completed', now() - interval '1 day');
  end loop;
  if p_open then
    insert into public.test_participations(campaign_id, tester_id, testing_email_snapshot, status, installed_at, expected_end_at)
    values(c, '31000000-0000-4000-8000-000000000007', 'testing@example.test', 'active',
      now() - interval '16 days', now() - interval '2 days');
  end if;
end;
$$;
select pg_temp.completion_fixture('A', 'testing', 10, 5);
select pg_temp.completion_fixture('B', 'testing', 10, 5);
select pg_temp.completion_fixture('C', 'testing', 10, 5, true);
select pg_temp.completion_fixture('D', 'recruiting', 10, 5);
select pg_temp.completion_fixture('draft', 'draft', 10, 5);
select pg_temp.completion_fixture('E', 'completed', 5, 5);
select pg_temp.completion_fixture('F', 'cancelled', 10, 5);
select pg_temp.completion_fixture('G', 'testing', 5, 5);
select pg_temp.completion_fixture('no_target', 'testing', 5, 5);
select pg_temp.completion_fixture('last_complete', 'testing', 5, 4, true);
select pg_temp.completion_fixture('last_cancel', 'testing', 6, 5, true);

create function pg_temp.expect_completion_update(p_name text, p_target integer, p_status public.campaign_status) returns void
language plpgsql as $$
declare c public.test_campaigns; stored public.test_campaigns;
begin
  c := public.update_campaign((select campaign_id from completion_cases where name = p_name), p_target_testers => p_target);
  select * into stored from public.test_campaigns where id = c.id;
  if c.status <> p_status or stored.status <> p_status or c.target_testers <> p_target then
    raise exception 'Case %: returned/stored state or target incorrect', p_name;
  end if;
  if c.completed_at is distinct from stored.completed_at then raise exception 'Case % returned stale completed_at', p_name; end if;
  if p_status = 'completed' and c.completed_at is null then raise exception 'Case % completed_at missing', p_name; end if;
  if p_status <> 'completed' and c.completed_at is not null then raise exception 'Case % unexpectedly completed', p_name; end if;
end;
$$;

create function pg_temp.expect_completion_error(p_name text, p_target integer, p_error text) returns void
language plpgsql as $$
declare before_row public.test_campaigns; after_row public.test_campaigns;
begin
  select * into before_row from public.test_campaigns where id = (select campaign_id from completion_cases where name = p_name);
  begin
    perform public.update_campaign((select campaign_id from completion_cases where name = p_name), p_target_testers => p_target);
    raise exception 'Expected error %, update succeeded', p_error;
  exception when others then
    if sqlerrm <> p_error then raise; end if;
  end;
  select * into after_row from public.test_campaigns where id = before_row.id;
  if before_row is distinct from after_row then raise exception 'Rejected case % changed campaign', p_name; end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000001', true);
select pg_temp.expect_completion_update('A', 5, 'completed');
select pg_temp.expect_completion_update('B', 6, 'testing');
-- C: covered=6 (5 completed+1 active). Preserve target floor; target=5 is rejected.
select pg_temp.expect_completion_error('C', 5, 'TARGET_BELOW_COVERED_TESTERS');
select pg_temp.expect_completion_update('C', 6, 'testing');
select pg_temp.expect_completion_update('D', 5, 'recruiting');
select pg_temp.expect_completion_update('draft', 5, 'draft');
select pg_temp.expect_completion_error('E', 10, 'INVALID_CAMPAIGN_STATE');
select pg_temp.expect_completion_error('F', 5, 'INVALID_CAMPAIGN_STATE');
select pg_temp.expect_completion_update('G', 10, 'testing');
do $$
declare c public.test_campaigns;
begin
  c := public.update_campaign((select campaign_id from completion_cases where name = 'no_target'), p_instructions => 'No target supplied');
  if c.status <> 'testing' then raise exception 'Unrelated edit triggered completion'; end if;
  if exists(select 1 from public.participation_events e join public.test_participations p on p.id = e.participation_id
    where p.campaign_id = (select campaign_id from completion_cases where name = 'A')) then
    raise exception 'Target completion invented a participation event';
  end if;
end;
$$;

-- Regression: last tester completion still uses the original helper and writes its event.
select set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000007', true);
do $$
declare p uuid;
begin
  select id into p from public.test_participations where campaign_id = (select campaign_id from completion_cases where name = 'last_complete') and tester_id = auth.uid();
  perform public.add_participation_feedback(p, 'Completion regression feedback');
  perform public.complete_participation(p);
  if not exists(select 1 from public.participation_events where participation_id = p and event_type = 'completed') then
    raise exception 'Existing completion event missing';
  end if;
end;
$$;
select set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000001', true);
do $$
declare c public.test_campaigns;
begin
  select * into c from public.test_campaigns where id = (select campaign_id from completion_cases where name = 'last_complete');
  if c.status <> 'completed' or c.completed_at is null then raise exception 'Last participant completion regressed'; end if;
  perform public.cancel_participation((select id from public.test_participations
    where campaign_id = (select campaign_id from completion_cases where name = 'last_cancel') and status = 'active'));
  select * into c from public.test_campaigns where id = (select campaign_id from completion_cases where name = 'last_cancel');
  if c.status <> 'testing' or c.completed_at is not null then raise exception 'Cancellation incorrectly counted as completed'; end if;
end;
$$;
select pg_temp.expect_completion_update('last_cancel', 5, 'completed');

-- Actor checks remain intact (RPC direct, no Next UI).
select set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000008', true);
do $$ begin
  begin
    perform public.update_campaign((select campaign_id from completion_cases where name = 'B'), p_target_testers => 10);
    raise exception 'Nonowner update succeeded';
  exception when others then
    if sqlerrm <> 'NOT_CAMPAIGN_OWNER' then raise; end if;
  end;
end;
$$;
select set_config('request.jwt.claim.sub', '', true);
do $$ begin
  begin
    perform public.update_campaign((select campaign_id from completion_cases where name = 'B'), p_target_testers => 10);
    raise exception 'Unauthenticated update succeeded';
  exception when others then
    if sqlerrm <> 'NOT_AUTHENTICATED' then raise; end if;
  end;
end;
$$;
reset role;
rollback;
