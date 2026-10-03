-- =========================================================
-- 003_access_and_installation.sql
--
-- Operaciones:
--   enable_access(participation_id)
--   confirm_installation(participation_id)
-- =========================================================


-- =========================================================
-- 1. ENABLE ACCESS
-- =========================================================

create or replace function public.enable_access(
  p_participation_id uuid
)
returns public.test_participations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_participation public.test_participations%rowtype;
  v_campaign public.test_campaigns%rowtype;
  v_app public.apps%rowtype;
begin

  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;


  -- Bloquear participación
  select *
  into v_participation
  from public.test_participations
  where id = p_participation_id
  for update;

  if not found then
    raise exception 'PARTICIPATION_NOT_FOUND';
  end if;


  -- Obtener campaña
  select *
  into v_campaign
  from public.test_campaigns
  where id = v_participation.campaign_id;

  if not found then
    raise exception 'CAMPAIGN_NOT_FOUND';
  end if;


  -- Obtener app
  select *
  into v_app
  from public.apps
  where id = v_campaign.app_id;

  if not found then
    raise exception 'APP_NOT_FOUND';
  end if;


  -- Solo owner
  if v_app.owner_id <> v_user_id then
    raise exception 'NOT_CAMPAIGN_OWNER';
  end if;


  -- Estado válido
  if v_participation.status <> 'waiting_access' then
    raise exception 'INVALID_PARTICIPATION_STATE';
  end if;


  -- Actualizar
  update public.test_participations
  set
    status = 'access_enabled',
    access_enabled_at = now()
  where id = p_participation_id
  returning *
  into v_participation;


  -- Evento
  insert into public.participation_events (
    participation_id,
    event_type,
    actor_user_id,
    metadata
  )
  values (
    v_participation.id,
    'access_enabled',
    v_user_id,
    '{}'::jsonb
  );


  return v_participation;

end;
$$;


-- =========================================================
-- 2. CONFIRM INSTALLATION
-- =========================================================

create or replace function public.confirm_installation(
  p_participation_id uuid
)
returns public.test_participations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_participation public.test_participations%rowtype;
  v_campaign public.test_campaigns%rowtype;
  v_installed_at timestamptz;
begin

  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;


  -- Bloquear participación
  select *
  into v_participation
  from public.test_participations
  where id = p_participation_id
  for update;

  if not found then
    raise exception 'PARTICIPATION_NOT_FOUND';
  end if;


  -- Solo tester propietario
  if v_participation.tester_id <> v_user_id then
    raise exception 'NOT_PARTICIPATION_TESTER';
  end if;


  -- Estado válido
  if v_participation.status <> 'access_enabled' then
    raise exception 'INVALID_PARTICIPATION_STATE';
  end if;


  -- Bloquear campaña
  select *
  into v_campaign
  from public.test_campaigns
  where id = v_participation.campaign_id
  for update;

  if not found then
    raise exception 'CAMPAIGN_NOT_FOUND';
  end if;


  v_installed_at := now();


  -- Activar participación
  update public.test_participations
  set
    status = 'active',
    installed_at = v_installed_at,
    expected_end_at =
      v_installed_at
      + make_interval(days => v_campaign.duration_days)
  where id = p_participation_id
  returning *
  into v_participation;


  -- Si es la primera instalación, iniciar testing de campaña.
  if v_campaign.status = 'recruiting' then

    update public.test_campaigns
    set
      status = 'testing',
      testing_started_at = coalesce(
        testing_started_at,
        v_installed_at
      )
    where id = v_campaign.id;

  end if;


  -- Evento
  insert into public.participation_events (
    participation_id,
    event_type,
    actor_user_id,
    metadata
  )
  values (
    v_participation.id,
    'installation_confirmed',
    v_user_id,
    '{}'::jsonb
  );


  return v_participation;

end;
$$;


-- =========================================================
-- 3. PERMISOS
-- =========================================================

revoke all
on function public.enable_access(uuid)
from public;

revoke execute
on function public.enable_access(uuid)
from anon;

revoke execute
on function public.enable_access(uuid)
from service_role;

grant execute
on function public.enable_access(uuid)
to authenticated;


revoke all
on function public.confirm_installation(uuid)
from public;

revoke execute
on function public.confirm_installation(uuid)
from anon;

revoke execute
on function public.confirm_installation(uuid)
from service_role;

grant execute
on function public.confirm_installation(uuid)
to authenticated;