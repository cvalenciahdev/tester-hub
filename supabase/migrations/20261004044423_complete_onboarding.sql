create or replace function public.complete_onboarding(
  p_country_code text,
  p_testing_email text,
  p_initial_intent public.initial_intent_type,
  p_devices jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_country_code text;
  v_testing_email text;
  v_device jsonb;
  v_platform public.platform_type;
  v_os_major smallint;
  v_os_minor smallint;
  v_model text;
  v_platforms public.platform_type[] := array[]::public.platform_type[];
  v_device_count integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  v_country_code := upper(trim(coalesce(p_country_code, '')));
  if v_country_code !~ '^[A-Z]{2}$' then
    raise exception 'INVALID_COUNTRY_CODE';
  end if;

  v_testing_email := nullif(trim(coalesce(p_testing_email, '')), '');
  if v_testing_email is null then
    raise exception 'TESTING_EMAIL_REQUIRED';
  end if;

  if p_initial_intent is null then
    raise exception 'INITIAL_INTENT_REQUIRED';
  end if;

  if p_devices is null or jsonb_typeof(p_devices) <> 'array' then
    raise exception 'DEVICES_REQUIRED';
  end if;

  v_device_count := jsonb_array_length(p_devices);
  if v_device_count < 1 or v_device_count > 2 then
    raise exception 'INVALID_DEVICE';
  end if;

  for v_device in select value from jsonb_array_elements(p_devices)
  loop
    if jsonb_typeof(v_device) is distinct from 'object'
       or jsonb_typeof(v_device -> 'platform') is distinct from 'string'
       or jsonb_typeof(v_device -> 'os_major') is distinct from 'number' then
      raise exception 'INVALID_DEVICE';
    end if;

    if (v_device ->> 'os_major') !~ '^(0|[1-9][0-9]*)$'
       or (v_device ->> 'os_major')::numeric > 32767 then
      raise exception 'INVALID_DEVICE';
    end if;

    if v_device ->> 'platform' = 'android' then
      v_platform := 'android';
    elsif v_device ->> 'platform' = 'ios' then
      v_platform := 'ios';
    else
      raise exception 'INVALID_DEVICE';
    end if;

    if v_platform = any(v_platforms) then
      raise exception 'INVALID_DEVICE';
    end if;
    v_platforms := array_append(v_platforms, v_platform);

    if v_device ? 'os_minor'
       and jsonb_typeof(v_device -> 'os_minor') <> 'null' then
      if jsonb_typeof(v_device -> 'os_minor') is distinct from 'number' then
        raise exception 'INVALID_DEVICE';
      end if;

      if (v_device ->> 'os_minor') !~ '^(0|[1-9][0-9]*)$'
         or (v_device ->> 'os_minor')::numeric > 32767 then
        raise exception 'INVALID_DEVICE';
      end if;
    end if;

    if v_device ? 'model'
       and jsonb_typeof(v_device -> 'model') not in ('string', 'null') then
      raise exception 'INVALID_DEVICE';
    end if;
  end loop;

  update public.profiles
  set
    country_code = v_country_code,
    testing_email = v_testing_email,
    initial_intent = p_initial_intent
  where id = v_user_id;

  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  delete from public.user_devices
  where user_id = v_user_id;

  for v_device in select value from jsonb_array_elements(p_devices)
  loop
    v_platform := (v_device ->> 'platform')::public.platform_type;
    v_os_major := (v_device ->> 'os_major')::smallint;
    v_os_minor := case
      when jsonb_typeof(v_device -> 'os_minor') = 'number'
        then (v_device ->> 'os_minor')::smallint
      else null
    end;
    v_model := nullif(trim(v_device ->> 'model'), '');

    insert into public.user_devices (
      user_id,
      platform,
      os_major,
      os_minor,
      model
    )
    values (
      v_user_id,
      v_platform,
      v_os_major,
      v_os_minor,
      v_model
    );
  end loop;
end;
$$;

revoke all
on function public.complete_onboarding(text, text, public.initial_intent_type, jsonb)
from public;

revoke execute
on function public.complete_onboarding(text, text, public.initial_intent_type, jsonb)
from anon;

revoke execute
on function public.complete_onboarding(text, text, public.initial_intent_type, jsonb)
from service_role;

grant execute
on function public.complete_onboarding(text, text, public.initial_intent_type, jsonb)
to authenticated;