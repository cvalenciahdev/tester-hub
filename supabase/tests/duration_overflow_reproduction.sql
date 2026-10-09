-- Baseline arithmetic reproduction remains valid after hardening. No mutations.
begin;
do $$
declare v_state text; v_message text; v_interval interval;
begin
  v_interval := make_interval(days => 2147483647);
  begin
    perform timestamptz '2026-10-09 00:00:00+00' + v_interval;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
  end;
  if v_state is distinct from '22008' or v_message is distinct from 'timestamp out of range' then
    raise exception 'Unexpected baseline: SQLSTATE %, message %', v_state, v_message;
  end if;
  raise notice 'Baseline captured: duration=2147483647, interval succeeds, sum fails SQLSTATE=% message=%', v_state, v_message;
end $$;
rollback;
