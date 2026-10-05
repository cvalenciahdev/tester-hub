create table public.test_participation_feedback (
  id uuid primary key default gen_random_uuid(),
  participation_id uuid not null references public.test_participations(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  feedback_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint participation_feedback_text_required check (length(trim(feedback_text)) > 0 and feedback_text ~ '[^[:space:]]')
);
create index participation_feedback_chronology on public.test_participation_feedback(participation_id, created_at, id);
create trigger trg_participation_feedback_updated_at before update on public.test_participation_feedback
for each row execute function public.set_updated_at();
alter table public.test_participation_feedback enable row level security;
create policy feedback_select_tester on public.test_participation_feedback for select to authenticated
using (exists(select 1 from public.test_participations tp where tp.id = participation_id and tp.tester_id = auth.uid()));
create policy feedback_select_owner on public.test_participation_feedback for select to authenticated
using (exists(select 1 from public.test_participations tp join public.test_campaigns c on c.id = tp.campaign_id
  join public.apps a on a.id = c.app_id where tp.id = participation_id and a.owner_id = auth.uid()));
create policy feedback_insert_tester on public.test_participation_feedback for insert to authenticated
with check (author_id = auth.uid() and exists(select 1 from public.test_participations tp
  where tp.id = participation_id and tp.tester_id = auth.uid() and tp.status = 'active'));
create policy feedback_update_tester on public.test_participation_feedback for update to authenticated
using (author_id = auth.uid() and exists(select 1 from public.test_participations tp
  where tp.id = participation_id and tp.tester_id = auth.uid() and tp.status = 'active'))
with check (author_id = auth.uid() and exists(select 1 from public.test_participations tp
  where tp.id = participation_id and tp.tester_id = auth.uid() and tp.status = 'active'));
-- Writes use the RPCs so all mutations share campaign -> participation -> feedback locks.
-- No direct INSERT/UPDATE/DELETE grants; no delete policy or delete RPC in this MVP.
revoke all on public.test_participation_feedback from public, anon, authenticated, service_role;
grant select on public.test_participation_feedback to authenticated;

create or replace function public.add_participation_feedback(p_participation_id uuid, p_feedback_text text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid(); v_campaign uuid; v_tester uuid; v_status public.participation_status;
  v_text text := regexp_replace(p_feedback_text, '^[[:space:]]+|[[:space:]]+$', '', 'g');
  v_feedback public.test_participation_feedback%rowtype;
begin
  if v_user is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select campaign_id, tester_id into v_campaign, v_tester from public.test_participations where id = p_participation_id;
  if not found then raise exception 'PARTICIPATION_NOT_FOUND'; end if;
  if v_tester <> v_user then raise exception 'NOT_PARTICIPATION_OWNER'; end if;
  perform 1 from public.test_campaigns where id = v_campaign for update;
  if not found then raise exception 'CAMPAIGN_NOT_FOUND'; end if;
  select tester_id, status into v_tester, v_status from public.test_participations where id = p_participation_id for update;
  if not found then raise exception 'PARTICIPATION_NOT_FOUND'; end if;
  if v_tester <> v_user then raise exception 'NOT_PARTICIPATION_OWNER'; end if;
  if v_status <> 'active' then raise exception 'INVALID_PARTICIPATION_STATE'; end if;
  if v_text is null or v_text !~ '[^[:space:]]' then raise exception 'FEEDBACK_REQUIRED'; end if;
  insert into public.test_participation_feedback(participation_id, author_id, feedback_text)
  values(p_participation_id, v_user, v_text) returning * into v_feedback;
  return jsonb_build_object('feedback_id', v_feedback.id, 'feedback_text', v_feedback.feedback_text,
    'created_at', v_feedback.created_at, 'updated_at', v_feedback.updated_at);
end $$;

create or replace function public.update_participation_feedback(p_feedback_id uuid, p_feedback_text text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid(); v_campaign uuid; v_participation uuid; v_author uuid; v_tester uuid;
  v_status public.participation_status;
  v_text text := regexp_replace(p_feedback_text, '^[[:space:]]+|[[:space:]]+$', '', 'g');
  v_feedback public.test_participation_feedback%rowtype;
begin
  if v_user is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select f.participation_id, f.author_id, tp.campaign_id, tp.tester_id
  into v_participation, v_author, v_campaign, v_tester
  from public.test_participation_feedback f join public.test_participations tp on tp.id = f.participation_id where f.id = p_feedback_id;
  if not found then raise exception 'FEEDBACK_NOT_FOUND'; end if;
  if v_author <> v_user then raise exception 'NOT_FEEDBACK_OWNER'; end if;
  if v_tester <> v_user then raise exception 'NOT_PARTICIPATION_OWNER'; end if;
  perform 1 from public.test_campaigns where id = v_campaign for update;
  if not found then raise exception 'CAMPAIGN_NOT_FOUND'; end if;
  select tester_id, status into v_tester, v_status from public.test_participations where id = v_participation for update;
  if not found then raise exception 'PARTICIPATION_NOT_FOUND'; end if;
  if v_tester <> v_user then raise exception 'NOT_PARTICIPATION_OWNER'; end if;
  if v_status <> 'active' then raise exception 'INVALID_PARTICIPATION_STATE'; end if;
  if v_text is null or v_text !~ '[^[:space:]]' then raise exception 'FEEDBACK_REQUIRED'; end if;
  select * into v_feedback from public.test_participation_feedback where id = p_feedback_id for update;
  if not found then raise exception 'FEEDBACK_NOT_FOUND'; end if;
  if v_feedback.author_id <> v_user then raise exception 'NOT_FEEDBACK_OWNER'; end if;
  update public.test_participation_feedback set feedback_text = v_text where id = p_feedback_id returning * into v_feedback;
  return jsonb_build_object('feedback_id', v_feedback.id, 'feedback_text', v_feedback.feedback_text,
    'created_at', v_feedback.created_at, 'updated_at', v_feedback.updated_at);
end $$;
revoke all on function public.add_participation_feedback(uuid,text), public.update_participation_feedback(uuid,text) from public;
revoke execute on function public.add_participation_feedback(uuid,text), public.update_participation_feedback(uuid,text) from anon, service_role;
grant execute on function public.add_participation_feedback(uuid,text), public.update_participation_feedback(uuid,text) to authenticated;
