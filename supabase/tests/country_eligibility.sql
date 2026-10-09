-- Run ONLY against a disposable local Supabase database after db reset.
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/country_eligibility.sql LOCAL_CONNECTION
-- Fixtures and any changes are rolled back. This is NOT a remote/deployment script.
begin;

create function pg_temp.expect_error(p_sql text, p_message text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm <> p_message then
      raise exception 'Expected %, got %', p_message, sqlerrm;
    end if;
    return;
  end;
  raise exception 'Expected error %, statement succeeded', p_message;
end;
$$;

insert into auth.users(id, email, raw_user_meta_data) values
('10000000-0000-4000-8000-000000000001', 'owner-country@example.test', '{}'),
('10000000-0000-4000-8000-000000000002', 'tester-mx@example.test', '{}'),
('10000000-0000-4000-8000-000000000003', 'tester-de@example.test', '{}'),
('10000000-0000-4000-8000-000000000004', 'tester-missing@example.test', '{}'),
('10000000-0000-4000-8000-000000000005', 'tester-invalid@example.test', '{}');
update public.profiles set country_code = case
  when id = '10000000-0000-4000-8000-000000000004' then null
  when id = '10000000-0000-4000-8000-000000000003' then 'DE' else 'MX' end,
  testing_email = 'testing@example.test', initial_intent = 'both'
where id::text like '10000000-0000-4000-8000-%';

-- Simulate a pre-migration invalid legacy row. Constraint is restored immediately;
-- all schema/data changes in this disposable local fixture roll back at the end.
alter table public.profiles drop constraint profiles_country_code_iso;
update public.profiles set country_code = 'ZZ' where id = '10000000-0000-4000-8000-000000000005';
alter table public.profiles add constraint profiles_country_code_iso
  check (country_code is null or public.is_valid_country_code(country_code)) not valid;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
insert into public.apps(id, owner_id, name) values
('20000000-0000-4000-8000-000000000001', auth.uid(), 'Country eligibility fixture');

do $$
declare c public.test_campaigns;
begin
  c := public.create_campaign('20000000-0000-4000-8000-000000000001', 'android', 2, 14,
    false, null, null, null, null, null, array['MX','AR','MX']);
  perform set_config('country_test.specific', c.id::text, true);
  if (select count(*) from public.campaign_countries where campaign_id = c.id) <> 2 then
    raise exception 'Expected two unique country records';
  end if;
  perform public.publish_campaign(c.id);
  c := public.create_campaign('20000000-0000-4000-8000-000000000001', 'android', 2, 14, true);
  perform set_config('country_test.all', c.id::text, true);
  if exists(select 1 from public.campaign_countries where campaign_id = c.id) then
    raise exception 'All countries must not require country rows';
  end if;
  perform public.publish_campaign(c.id);
end $$;

select pg_temp.expect_error('select public.create_campaign(''20000000-0000-4000-8000-000000000001'', ''android'', 2, 14, false)', 'CAMPAIGN_COUNTRIES_REQUIRED');
select pg_temp.expect_error(format('select public.update_campaign(%L::uuid, p_all_countries => false, p_country_codes => array[]::text[])', current_setting('country_test.all')), 'CAMPAIGN_COUNTRIES_REQUIRED');

-- Direct RPC eligible country; preserves waiting_access and joined event.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
do $$
declare p public.test_participations;
begin
  if not exists(select 1 from public.list_available_campaigns() where campaign_id = current_setting('country_test.specific')::uuid) then
    raise exception 'MX discovery must include MX/AR campaign';
  end if;
  p := public.join_campaign(current_setting('country_test.specific')::uuid);
  if p.status <> 'waiting_access' then raise exception 'Join must start waiting_access'; end if;
  if not exists(select 1 from public.participation_events where participation_id = p.id and event_type = 'joined') then
    raise exception 'Joined event missing';
  end if;
end $$;
select pg_temp.expect_error(format('select public.join_campaign(%L::uuid)', current_setting('country_test.specific')), 'ALREADY_JOINED');

-- Country exclusion is enforced by SQL even if Next/Explore is bypassed.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select pg_temp.expect_error(format('select public.join_campaign(%L::uuid)', current_setting('country_test.specific')), 'COUNTRY_NOT_ELIGIBLE');
select pg_temp.expect_error(format('select public.get_campaign_detail(%L::uuid)', current_setting('country_test.specific')), 'CAMPAIGN_NOT_AVAILABLE');
do $$
begin
  if exists(select 1 from public.list_available_campaigns() where campaign_id = current_setting('country_test.specific')::uuid) then
    raise exception 'DE discovery must exclude MX/AR campaign';
  end if;
  perform public.join_campaign(current_setting('country_test.all')::uuid);
  perform public.get_dashboard_data();
  perform public.list_my_participations();
end $$;

-- Missing country fails even on all_countries.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
select pg_temp.expect_error(format('select public.join_campaign(%L::uuid)', current_setting('country_test.all')), 'COUNTRY_NOT_ELIGIBLE');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000005', true);
select pg_temp.expect_error(format('select public.join_campaign(%L::uuid)', current_setting('country_test.all')), 'COUNTRY_NOT_ELIGIBLE');
select pg_temp.expect_error(format('select public.join_campaign(%L::uuid)', current_setting('country_test.specific')), 'COUNTRY_NOT_ELIGIBLE');
select pg_temp.expect_error('select public.list_available_campaigns()', 'PROFILE_COUNTRY_REQUIRED');
select pg_temp.expect_error('select public.get_dashboard_data()', 'PROFILE_COUNTRY_REQUIRED');

-- Catalog rejection in direct writes and onboarding/profile/campaign RPCs.
do $$
begin
  if public.is_valid_country_code('ZZ') or public.is_valid_country_code('mx') then raise exception 'Non-ISO input accepted'; end if;
  begin
    update public.profiles set country_code = 'ZZ' where id = auth.uid();
    raise exception 'Invalid direct profile write succeeded';
  exception when check_violation then null;
  end;
  begin
    perform public.complete_onboarding('ZZ', 'testing@example.test', 'tester', '[{"platform":"android","os_major":24}]');
    raise exception 'Invalid onboarding country succeeded';
  exception when check_violation then null;
  end;
  begin
    perform public.update_my_profile('Tester', 'ZZ', 'testing@example.test', 'tester', '[{"platform":"android","os_major":24}]');
    raise exception 'Invalid profile RPC country succeeded';
  exception when check_violation then null;
  end;
end $$;

-- Profile ISO persistence and direct owner checks/structural lock regression.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select public.update_my_profile('Tester', 'AR', 'testing@example.test', 'tester', '[{"platform":"android","os_major":24}]');
do $$ begin
  if (select country_code from public.profiles where id = auth.uid()) <> 'AR' then raise exception 'Profile did not persist AR'; end if;
end $$;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
do $$ begin
  begin
    perform public.create_campaign('20000000-0000-4000-8000-000000000001', 'android', 2, 14,
      false, null, null, null, null, null, array['ZZ']);
    raise exception 'Invalid campaign country succeeded';
  exception when check_violation then null;
  end;
end $$;
select pg_temp.expect_error(format('select public.join_campaign(%L::uuid)', current_setting('country_test.all')), 'OWNER_CANNOT_JOIN');
select pg_temp.expect_error(format('select public.update_campaign(%L::uuid, p_country_codes => array[''DE''])', current_setting('country_test.specific')), 'STRUCTURAL_FIELDS_LOCKED');
select pg_temp.expect_error(format('select public.update_campaign(%L::uuid, p_country_codes => array[]::text[])', current_setting('country_test.specific')), 'STRUCTURAL_FIELDS_LOCKED');
select public.get_campaign_tracking(current_setting('country_test.specific')::uuid);
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.expect_error(format('select public.join_campaign(%L::uuid)', current_setting('country_test.all')), 'NOT_AUTHENTICATED');

reset role;
rollback;
