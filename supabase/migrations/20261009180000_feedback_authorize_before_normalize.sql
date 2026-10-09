-- Reduce rejected-call CPU and lock hold time without quotas or rate limiting.
-- Same errors, state checks, return fields and existing ACLs via CREATE OR REPLACE.

create or replace function public.add_participation_feedback(p_participation_id uuid, p_feedback_text text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid(); v_campaign uuid; v_tester uuid; v_status public.participation_status;
  v_text text;
  v_feedback public.test_participation_feedback%rowtype;
begin
  if v_user is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select campaign_id, tester_id into v_campaign, v_tester from public.test_participations where id = p_participation_id;
  if not found then raise exception 'PARTICIPATION_NOT_FOUND'; end if;
  if v_tester <> v_user then raise exception 'NOT_PARTICIPATION_OWNER'; end if;
  -- Normalize only after the initial actor checks, before retaining campaign locks.
  v_text := regexp_replace(p_feedback_text, '^[[:space:]]+|[[:space:]]+$', '', 'g');
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
  v_text text;
  v_feedback public.test_participation_feedback%rowtype;
begin
  if v_user is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select f.participation_id, f.author_id, tp.campaign_id, tp.tester_id
  into v_participation, v_author, v_campaign, v_tester
  from public.test_participation_feedback f join public.test_participations tp on tp.id = f.participation_id where f.id = p_feedback_id;
  if not found then raise exception 'FEEDBACK_NOT_FOUND'; end if;
  if v_author <> v_user then raise exception 'NOT_FEEDBACK_OWNER'; end if;
  if v_tester <> v_user then raise exception 'NOT_PARTICIPATION_OWNER'; end if;
  -- Normalize only after the initial actor checks, before retaining campaign locks.
  v_text := regexp_replace(p_feedback_text, '^[[:space:]]+|[[:space:]]+$', '', 'g');
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
