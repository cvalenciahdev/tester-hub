-- =========================================================
-- 002_join_campaign.sql
--
-- Operación:
--   join_campaign(campaign_id)
--
-- Responsabilidad:
--   Permitir que el usuario autenticado ocupe una plaza
--   válida en una ronda de prueba.
--
-- No implementa todavía:
--   - matching por versión de SO
--   - matching por dispositivo
--   - filtros avanzados
-- =========================================================


create or replace function public.join_campaign(
  p_campaign_id uuid
)
returns public.test_participations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_campaign public.test_campaigns%rowtype;
  v_app public.apps%rowtype;
  v_profile public.profiles%rowtype;
  v_covered_testers integer;
  v_participation public.test_participations%rowtype;
begin

  -- -------------------------------------------------------
  -- 1. Usuario autenticado
  -- -------------------------------------------------------

  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;


  -- -------------------------------------------------------
  -- 2. Cargar y bloquear campaña
  --
  -- FOR UPDATE evita que dos join_campaign concurrentes
  -- consuman simultáneamente la última plaza.
  -- -------------------------------------------------------

  select *
  into v_campaign
  from public.test_campaigns
  where id = p_campaign_id
  for update;

  if not found then
    raise exception 'CAMPAIGN_NOT_FOUND';
  end if;


  -- -------------------------------------------------------
  -- 3. Estado válido
  -- -------------------------------------------------------

  if v_campaign.status not in ('recruiting', 'testing') then
    raise exception 'CAMPAIGN_NOT_OPEN';
  end if;


  -- -------------------------------------------------------
  -- 4. App asociada
  -- -------------------------------------------------------

  select *
  into v_app
  from public.apps
  where id = v_campaign.app_id;

  if not found then
    raise exception 'APP_NOT_FOUND';
  end if;

  if v_app.archived_at is not null then
    raise exception 'APP_ARCHIVED';
  end if;


  -- -------------------------------------------------------
  -- 5. Owner no puede participar
  -- -------------------------------------------------------

  if v_app.owner_id = v_user_id then
    raise exception 'OWNER_CANNOT_JOIN';
  end if;


  -- -------------------------------------------------------
  -- 6. Perfil y correo de testing
  -- -------------------------------------------------------

  select *
  into v_profile
  from public.profiles
  where id = v_user_id;

  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  if v_profile.testing_email is null
     or length(trim(v_profile.testing_email)) = 0 then
    raise exception 'TESTING_EMAIL_REQUIRED';
  end if;


  -- -------------------------------------------------------
  -- 7. Participación duplicada
  -- -------------------------------------------------------

  if exists (
    select 1
    from public.test_participations tp
    where tp.campaign_id = p_campaign_id
      and tp.tester_id = v_user_id
  ) then
    raise exception 'ALREADY_JOINED';
  end if;


  -- -------------------------------------------------------
  -- 8. Contar plazas cubiertas
  -- -------------------------------------------------------

  select count(*)
  into v_covered_testers
  from public.test_participations tp
  where tp.campaign_id = p_campaign_id
    and tp.status in (
      'waiting_access',
      'access_enabled',
      'active',
      'completed'
    );


  -- -------------------------------------------------------
  -- 9. Verificar disponibilidad
  -- -------------------------------------------------------

  if v_covered_testers >= v_campaign.target_testers then
    raise exception 'NO_AVAILABLE_SLOTS';
  end if;


  -- -------------------------------------------------------
  -- 10. Crear participación
  -- -------------------------------------------------------

  insert into public.test_participations (
    campaign_id,
    tester_id,
    testing_email_snapshot,
    status,
    joined_at
  )
  values (
    p_campaign_id,
    v_user_id,
    v_profile.testing_email,
    'waiting_access',
    now()
  )
  returning *
  into v_participation;


  -- -------------------------------------------------------
  -- 11. Registrar evento
  -- -------------------------------------------------------

  insert into public.participation_events (
    participation_id,
    event_type,
    actor_user_id,
    metadata
  )
  values (
    v_participation.id,
    'joined',
    v_user_id,
    '{}'::jsonb
  );


  -- -------------------------------------------------------
  -- 12. Resultado
  -- -------------------------------------------------------

  return v_participation;

end;
$$;


-- =========================================================
-- Permisos
-- =========================================================

revoke all
on function public.join_campaign(uuid)
from public;

revoke execute
on function public.join_campaign(uuid)
from anon;

revoke execute
on function public.join_campaign(uuid)
from service_role;

grant execute
on function public.join_campaign(uuid)
to authenticated;