-- Disposable local fixtures, all rolled back. Run after platform_duration migration.
begin;
create function pg_temp.duration_error(p_sql text, p_expected text) returns void language plpgsql as $$
begin
  begin execute p_sql;
  exception when others then
    if sqlerrm <> p_expected then raise exception 'Expected %, got %', p_expected, sqlerrm; end if;
    return;
  end;
  raise exception 'Expected %, statement succeeded', p_expected;
end;
$$;
insert into auth.users(id, email, raw_user_meta_data) values
('41000000-0000-4000-8000-000000000001', 'duration-owner@example.test', '{}'),
('41000000-0000-4000-8000-000000000002', 'duration-tester@example.test', '{}');
update public.profiles set country_code = 'MX', testing_email = 'testing@example.test'
where id::text like '41000000-0000-4000-8000-%';
insert into public.apps(id, owner_id, name) values
('42000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', 'Duration fixture');

-- Simulate invalid pre-migration data; the trigger is immediately restored in this transaction.
alter table public.test_campaigns disable trigger trg_campaign_ios_duration;
insert into public.test_campaigns(id, app_id, platform, duration_days, target_testers, all_countries, status) values
('43000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', 'ios', 91, 2, true, 'testing'),
('43000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000001', 'ios', 91, 2, true, 'draft');
alter table public.test_campaigns enable trigger trg_campaign_ios_duration;
insert into public.test_participations(campaign_id, tester_id, testing_email_snapshot, status)
values('43000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000002', 'testing@example.test', 'active');

set local role authenticated;
select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000001', true);
do $$
declare a public.test_campaigns; i public.test_campaigns;
begin
  a := public.create_campaign('42000000-0000-4000-8000-000000000001', 'android', 2, 1, true);
  if a.duration_days <> 1 then raise exception 'Android 1 failed'; end if;
  i := public.create_campaign('42000000-0000-4000-8000-000000000001', 'ios', 2, 90, true);
  if i.duration_days <> 90 then raise exception 'iOS 90 failed'; end if;
  perform set_config('duration_test.ios', i.id::text, true);
  a := public.create_campaign('42000000-0000-4000-8000-000000000001', 'android', 2, 120, true);
  perform set_config('duration_test.android', a.id::text, true);
end $$;
select pg_temp.duration_error('select public.create_campaign(''42000000-0000-4000-8000-000000000001'', ''ios'', 2, 91, true)', 'IOS_DURATION_EXCEEDED');
select pg_temp.duration_error('select public.create_campaign(''42000000-0000-4000-8000-000000000001'', ''android'', 2, 0, true)', 'INVALID_DURATION_DAYS');
select pg_temp.duration_error(format('select public.update_campaign(%L::uuid, p_duration_days=>91)', current_setting('duration_test.ios')), 'IOS_DURATION_EXCEEDED');
select pg_temp.duration_error(format('select public.update_campaign(%L::uuid, p_platform=>''ios'')', current_setting('duration_test.android')), 'IOS_DURATION_EXCEEDED');
select pg_temp.duration_error('select public.update_campaign(''43000000-0000-4000-8000-000000000001'', p_duration_days=>90)', 'STRUCTURAL_FIELDS_LOCKED');
select pg_temp.duration_error('select public.update_campaign(''43000000-0000-4000-8000-000000000002'', p_instructions=>''unlocked legacy must be corrected'')', 'IOS_DURATION_EXCEEDED');
do $$ declare c public.test_campaigns; begin
  c := public.update_campaign('43000000-0000-4000-8000-000000000001', p_instructions=>'Locked legacy unchanged');
  if c.duration_days <> 91 then raise exception 'Legacy silently changed'; end if;
  c := public.update_campaign('43000000-0000-4000-8000-000000000002', p_duration_days=>90);
  if c.duration_days <> 90 then raise exception 'Unlocked correction failed'; end if;
end $$;
-- Table-level guard also rejects privileged new invalid data, preserving unchanged legacy rows.
reset role;
select pg_temp.duration_error('update public.test_campaigns set duration_days=91 where id=''' || current_setting('duration_test.ios') || '''::uuid', 'IOS_DURATION_EXCEEDED');
rollback;
