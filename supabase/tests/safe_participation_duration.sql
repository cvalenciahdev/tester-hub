begin;
create function pg_temp.range_error(p_sql text, p_expected text) returns void language plpgsql as $$
begin
  begin execute p_sql;
  exception when others then
    if sqlerrm <> p_expected or sqlstate <> 'P0001' then raise exception 'Expected controlled %, got % / %', p_expected, sqlstate, sqlerrm; end if;
    return;
  end;
  raise exception 'Expected %, statement succeeded', p_expected;
end;
$$;
-- Helper normal/high-safe, UTC ISO boundary, Postgres overflow and Infinity checks.
do $$ begin
  if public._safe_participation_end_at('2026-10-09 00:00:00+00',14) <> timestamptz '2026-10-23 00:00:00+00' then raise exception 'Normal date changed'; end if;
  if public._safe_participation_end_at('2026-10-09 00:00:00+00',100000) <> timestamptz '2026-10-09 00:00:00+00' + make_interval(days=>100000) then raise exception 'High safe duration failed'; end if;
  if public._safe_participation_end_at('9999-12-30 00:00:00+00',1) <> timestamptz '9999-12-31 00:00:00+00' then raise exception 'ISO boundary changed'; end if;
end $$;
select pg_temp.range_error('select public._safe_participation_end_at(''9999-12-31 00:00:00+00'',1)', 'DURATION_OUT_OF_RANGE');
select pg_temp.range_error('select public._safe_participation_end_at(''2026-10-09 00:00:00+00'',2147483647)', 'DURATION_OUT_OF_RANGE');
select pg_temp.range_error('select public._safe_participation_end_at(''infinity'',14)', 'DURATION_OUT_OF_RANGE');
-- Calendar-day/DST semantics unchanged.
set local timezone = 'America/New_York';
do $$ begin
  if public._safe_participation_end_at('2026-03-07 12:00:00 America/New_York',2)
    <> timestamptz '2026-03-07 12:00:00 America/New_York' + make_interval(days=>2) then raise exception 'DST semantics changed'; end if;
end $$;
set local timezone = 'UTC';

insert into auth.users(id,email,raw_user_meta_data) values
('51000000-0000-4000-8000-000000000001','range-owner@example.test','{}'),
('51000000-0000-4000-8000-000000000002','range-tester@example.test','{}');
update public.profiles set country_code='MX',testing_email='testing@example.test' where id::text like '51000000-0000-4000-8000-%';
insert into public.apps(id,owner_id,name) values('52000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','Range fixture');
-- A legacy extreme remains stored unchanged; no migration backfill/truncation.
insert into public.test_campaigns(id,app_id,platform,duration_days,target_testers,all_countries,status)
values('53000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001','android',2147483647,2,true,'recruiting');
insert into public.test_participations(id,campaign_id,tester_id,testing_email_snapshot,status)
values('54000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000002','testing@example.test','access_enabled');

set local role authenticated;
select set_config('request.jwt.claim.sub','51000000-0000-4000-8000-000000000001',true);
do $$ declare c public.test_campaigns; begin
  c:= public.create_campaign('52000000-0000-4000-8000-000000000001','android',2,14,true);
  perform set_config('range_test.update',c.id::text,true);
  perform public.publish_campaign(c.id);
  c:= public.create_campaign('52000000-0000-4000-8000-000000000001','android',2,100000,true);
  perform set_config('range_test.high',c.id::text,true);
  c:= public.create_campaign('52000000-0000-4000-8000-000000000001','ios',2,90,true);
  perform set_config('range_test.ios',c.id::text,true);
  perform public.publish_campaign(current_setting('range_test.high')::uuid);
  perform public.publish_campaign(current_setting('range_test.ios')::uuid);
end $$;
select pg_temp.range_error('select public.create_campaign(''52000000-0000-4000-8000-000000000001'',''android'',2,2147483647,true)', 'DURATION_OUT_OF_RANGE');
select pg_temp.range_error(format('select public.update_campaign(%L::uuid,p_duration_days=>2147483647)',current_setting('range_test.update')), 'DURATION_OUT_OF_RANGE');
select pg_temp.range_error('select public.create_campaign(''52000000-0000-4000-8000-000000000001'',''ios'',2,91,true)', 'IOS_DURATION_EXCEEDED');
select set_config('request.jwt.claim.sub','51000000-0000-4000-8000-000000000002',true);
select pg_temp.range_error('select public.confirm_installation(''54000000-0000-4000-8000-000000000001'')', 'DURATION_OUT_OF_RANGE');
do $$ declare p public.test_participations; begin
  select * into p from public.test_participations where id='54000000-0000-4000-8000-000000000001';
  if p.status <> 'access_enabled' or p.installed_at is not null or p.expected_end_at is not null then raise exception 'Failed confirmation changed participation'; end if;
  if exists(select 1 from public.participation_events where participation_id=p.id and event_type='installation_confirmed') then raise exception 'Failed confirmation added event'; end if;
  p:=public.join_campaign(current_setting('range_test.high')::uuid);
  perform set_config('range_test.high_p',p.id::text,true);
  p:=public.join_campaign(current_setting('range_test.ios')::uuid);
  perform set_config('range_test.ios_p',p.id::text,true);
  p:=public.join_campaign(current_setting('range_test.update')::uuid);
  perform set_config('range_test.normal_p',p.id::text,true);
end $$;
select set_config('request.jwt.claim.sub','51000000-0000-4000-8000-000000000001',true);
select public.enable_access(current_setting('range_test.high_p')::uuid);
select public.enable_access(current_setting('range_test.ios_p')::uuid);
select public.enable_access(current_setting('range_test.normal_p')::uuid);
select set_config('request.jwt.claim.sub','51000000-0000-4000-8000-000000000002',true);
do $$ declare p public.test_participations; begin
  p:= public.confirm_installation(current_setting('range_test.high_p')::uuid);
  if p.status <> 'active' or p.expected_end_at <> p.installed_at + make_interval(days=>100000) then raise exception 'Safe high confirmation failed'; end if;
  p:= public.confirm_installation(current_setting('range_test.ios_p')::uuid);
  if p.status <> 'active' or p.expected_end_at <> p.installed_at + make_interval(days=>90) then raise exception 'iOS90 confirmation regressed'; end if;
  p:= public.confirm_installation(current_setting('range_test.normal_p')::uuid);
  if p.status <> 'active' or p.expected_end_at <> p.installed_at + make_interval(days=>14) then raise exception 'Android14 confirmation failed'; end if;
end $$;
reset role;
do $$ begin
  if (select duration_days from public.test_campaigns where id='53000000-0000-4000-8000-000000000001') <> 2147483647 then raise exception 'Legacy duration changed'; end if;
end $$;
rollback;
