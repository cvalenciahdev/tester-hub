-- Bounded local probes, not quotas/rate thresholds. Everything is rolled back.
begin;
create function pg_temp.abuse_error(p_sql text,p_error text) returns void language plpgsql as $$
begin
  begin execute p_sql;
  exception when others then
    if sqlerrm <> p_error then raise exception 'Expected %, got %',p_error,sqlerrm; end if;
    return;
  end;
  raise exception 'Expected %, call succeeded',p_error;
end $$;
insert into auth.users(id,email,raw_user_meta_data) values
('61000000-0000-4000-8000-000000000001','abuse-owner@example.test','{}'),
('61000000-0000-4000-8000-000000000002','abuse-tester@example.test','{}'),
('61000000-0000-4000-8000-000000000003','abuse-other@example.test','{}');
update public.profiles set country_code='MX',testing_email='testing@example.test',initial_intent='both'
where id::text like '61000000-0000-4000-8000-%';
set local role authenticated;
select set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000001',true);
-- Direct REST table writes are part of the real app surface.
insert into public.apps(id,owner_id,name) values
('62000000-0000-4000-8000-000000000001',auth.uid(),'Repeated name'),
('62000000-0000-4000-8000-000000000002',auth.uid(),'Repeated name');
do $$ declare c public.test_campaigns; begin
  c:=public.create_campaign('62000000-0000-4000-8000-000000000001','android',1,14,true);
  perform set_config('abuse_test.campaign',c.id::text,true);
  perform public.create_campaign('62000000-0000-4000-8000-000000000001','android',1,14,true);
  if (select count(*) from public.test_campaigns where app_id='62000000-0000-4000-8000-000000000001') <> 2 then raise exception 'Repeated creation model changed'; end if;
  perform public.publish_campaign(current_setting('abuse_test.campaign')::uuid);
end $$;
select set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000002',true);
-- Collection limits of profile RPCs do not constrain direct owner-scoped device INSERTs.
insert into public.user_devices(user_id,platform,os_major)
select auth.uid(),'android',24 from generate_series(1,3);
do $$ begin
  if (select count(*) from public.user_devices where user_id=auth.uid()) <> 3 then raise exception 'Device probe changed'; end if;
  begin
    insert into public.user_devices(user_id,platform,os_major)
    values('61000000-0000-4000-8000-000000000001','android',24);
    raise exception 'Forged device owner accepted';
  exception when insufficient_privilege then null;
  end;
  raise notice 'Direct device probe: three same-platform own rows accepted; forged owner rejected';
end $$;
do $$ declare p public.test_participations; begin
  p:=public.join_campaign(current_setting('abuse_test.campaign')::uuid);
  perform set_config('abuse_test.participation',p.id::text,true);
end $$;
select pg_temp.abuse_error(format('select public.join_campaign(%L::uuid)',current_setting('abuse_test.campaign')),'ALREADY_JOINED');
do $$ begin
  if (select count(*) from public.test_participations where campaign_id=current_setting('abuse_test.campaign')::uuid) <> 1
    or (select count(*) from public.participation_events where participation_id=current_setting('abuse_test.participation')::uuid and event_type='joined') <> 1 then
    raise exception 'Join created duplicate row/event';
  end if;
end $$;
select set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000003',true);
select pg_temp.abuse_error(format('select public.join_campaign(%L::uuid)',current_setting('abuse_test.campaign')),'NO_AVAILABLE_SLOTS');
select set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000001',true);
select public.enable_access(current_setting('abuse_test.participation')::uuid);
select pg_temp.abuse_error(format('select public.enable_access(%L::uuid)',current_setting('abuse_test.participation')),'INVALID_PARTICIPATION_STATE');
select set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000002',true);
select public.confirm_installation(current_setting('abuse_test.participation')::uuid);
select pg_temp.abuse_error(format('select public.confirm_installation(%L::uuid)',current_setting('abuse_test.participation')),'INVALID_PARTICIPATION_STATE');
do $$ declare f jsonb; begin
  f:=public.add_participation_feedback(current_setting('abuse_test.participation')::uuid,E' \t first feedback \n ');
  if f->>'feedback_text' <> 'first feedback' then raise exception 'Normalization changed'; end if;
  perform set_config('abuse_test.feedback',f->>'feedback_id',true);
  -- Twenty is a probe size, NOT a maximum or production threshold.
  for i in 1..20 loop
    perform public.add_participation_feedback(current_setting('abuse_test.participation')::uuid,'Repeated feedback');
    perform public.update_participation_feedback(current_setting('abuse_test.feedback')::uuid,'first feedback');
  end loop;
  if (select count(*) from public.test_participation_feedback where participation_id=current_setting('abuse_test.participation')::uuid) <> 21 then raise exception 'Multiple feedback model changed'; end if;
  if exists(select 1 from public.test_participation_feedback where participation_id=current_setting('abuse_test.participation')::uuid and author_id<>auth.uid()) then raise exception 'Author identity is not auth.uid'; end if;
end $$;
select set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000001',true);
do $$ declare tracking jsonb; begin
  tracking:=public.get_campaign_tracking(current_setting('abuse_test.campaign')::uuid);
  if jsonb_array_length(tracking->'participations'->0->'feedbacks') <> 21 then raise exception 'Tracking scope/count changed'; end if;
  raise notice 'Feedback probe: 21 records returned; tracking payload=% bytes',octet_length(tracking::text);
end $$;
select pg_temp.abuse_error(format('select public.update_participation_feedback(%L::uuid,''owner edit'')',current_setting('abuse_test.feedback')),'NOT_FEEDBACK_OWNER');
-- Measure denied large-text calls on local DB; timing is evidence, not a pass threshold.
select set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000003',true);
do $$ declare payload text:=repeat('x',1048576); started timestamptz; elapsed numeric; begin
  started:=clock_timestamp();
  for i in 1..3 loop
    begin perform public.add_participation_feedback(current_setting('abuse_test.participation')::uuid,payload);
    exception when others then if sqlerrm<>'NOT_PARTICIPATION_OWNER' then raise; end if; end;
  end loop;
  elapsed:=extract(epoch from(clock_timestamp()-started))*1000;
  raise notice 'Denied add 3x1MiB: % ms',round(elapsed,3);
  started:=clock_timestamp();
  for i in 1..3 loop
    begin perform public.update_participation_feedback(current_setting('abuse_test.feedback')::uuid,payload);
    exception when others then if sqlerrm<>'NOT_FEEDBACK_OWNER' then raise; end if; end;
  end loop;
  elapsed:=extract(epoch from(clock_timestamp()-started))*1000;
  raise notice 'Denied update 3x1MiB: % ms',round(elapsed,3);
end $$;
-- Terminal repetition must not create extra events or feedback.
reset role;
update public.test_participations set expected_end_at=now()-interval '1 second' where id=current_setting('abuse_test.participation')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000002',true);
select public.complete_participation(current_setting('abuse_test.participation')::uuid);
select pg_temp.abuse_error(format('select public.complete_participation(%L::uuid)',current_setting('abuse_test.participation')),'INVALID_PARTICIPATION_STATE');
select pg_temp.abuse_error(format('select public.add_participation_feedback(%L::uuid,''after close'')',current_setting('abuse_test.participation')),'INVALID_PARTICIPATION_STATE');
do $$ begin
    if (select count(*) from public.participation_events where participation_id=current_setting('abuse_test.participation')::uuid and event_type='access_enabled') <> 1
       or (select count(*) from public.participation_events where participation_id=current_setting('abuse_test.participation')::uuid and event_type='installation_confirmed') <> 1
       or (select count(*) from public.participation_events where participation_id=current_setting('abuse_test.participation')::uuid and event_type='completed') <> 1 then
      raise exception 'Repeated transition duplicated events';
    end if;
end $$;
reset role;
rollback;
