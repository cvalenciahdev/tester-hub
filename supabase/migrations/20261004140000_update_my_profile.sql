create or replace function public.update_my_profile(
  p_display_name text,
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
  v_user_id uuid := auth.uid();
  v_country text := upper(trim(coalesce(p_country_code, '')));
  v_email text := trim(coalesce(p_testing_email, ''));
  v_device jsonb;
  v_id uuid;
  v_ids uuid[] := array[]::uuid[];
  v_platforms text[] := array[]::text[];
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;
  -- Every collection mutation for Profile serializes on the same user row.
  perform 1 from public.profiles where id = v_user_id for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  if v_country !~ '^[A-Z]{2}$' then raise exception 'INVALID_COUNTRY_CODE'; end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'INVALID_TESTING_EMAIL'; end if;
  if p_initial_intent is null then raise exception 'INITIAL_INTENT_REQUIRED'; end if;
  if p_devices is null or jsonb_typeof(p_devices) <> 'array' then raise exception 'INVALID_DEVICES'; end if;
  if jsonb_array_length(p_devices) not between 1 and 2 then raise exception 'INVALID_DEVICES'; end if;
  -- Validate the entire final collection and ownership before changing anything.
  for v_device in select value from jsonb_array_elements(p_devices) loop
    if jsonb_typeof(v_device) is distinct from 'object' then raise exception 'INVALID_DEVICE'; end if;
    if jsonb_typeof(v_device->'platform') is distinct from 'string'
       or v_device->>'platform' not in ('android', 'ios') then raise exception 'INVALID_DEVICE'; end if;
    if v_device->>'platform' = any(v_platforms) then raise exception 'DUPLICATE_PLATFORM'; end if;
    v_platforms := array_append(v_platforms, v_device->>'platform');
    if jsonb_typeof(v_device->'os_major') is distinct from 'number'
       or (v_device->>'os_major') !~ '^(0|[1-9][0-9]*)$' then raise exception 'INVALID_DEVICE'; end if;
    if (v_device->>'os_major')::numeric > 32767 then raise exception 'INVALID_DEVICE'; end if;
    if v_device ? 'os_minor' and jsonb_typeof(v_device->'os_minor') <> 'null' then
      if jsonb_typeof(v_device->'os_minor') is distinct from 'number'
         or (v_device->>'os_minor') !~ '^(0|[1-9][0-9]*)$' then raise exception 'INVALID_DEVICE'; end if;
      if (v_device->>'os_minor')::numeric > 32767 then raise exception 'INVALID_DEVICE'; end if;
    end if;
    if v_device ? 'model' and jsonb_typeof(v_device->'model') not in ('string', 'null') then raise exception 'INVALID_DEVICE'; end if;
    if v_device ? 'id' and jsonb_typeof(v_device->'id') <> 'null' then
      if jsonb_typeof(v_device->'id') is distinct from 'string'
         or (v_device->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'INVALID_DEVICE'; end if;
      v_id := (v_device->>'id')::uuid;
      if v_id = any(v_ids) then raise exception 'INVALID_DEVICE'; end if;
      perform 1 from public.user_devices where id = v_id and user_id = v_user_id for update;
      if not found then raise exception 'DEVICE_NOT_OWNED'; end if;
      v_ids := array_append(v_ids, v_id);
    end if;
  end loop;
  update public.profiles set display_name = nullif(trim(p_display_name), ''), country_code = v_country,
    testing_email = v_email, initial_intent = p_initial_intent where id = v_user_id;
  delete from public.user_devices where user_id = v_user_id and not (id = any(v_ids));
  for v_device in select value from jsonb_array_elements(p_devices) loop
    v_id := (v_device->>'id')::uuid;
    if v_id is null then
      insert into public.user_devices(user_id, platform, os_major, os_minor, model)
      values (v_user_id, (v_device->>'platform')::public.platform_type, (v_device->>'os_major')::smallint,
        (v_device->>'os_minor')::smallint, nullif(trim(v_device->>'model'), ''));
    else
      update public.user_devices set platform = (v_device->>'platform')::public.platform_type,
        os_major = (v_device->>'os_major')::smallint, os_minor = (v_device->>'os_minor')::smallint,
        model = nullif(trim(v_device->>'model'), '') where id = v_id and user_id = v_user_id;
    end if;
  end loop;
end;
$$;
revoke all on function public.update_my_profile(text, text, text, public.initial_intent_type, jsonb) from public;
revoke execute on function public.update_my_profile(text, text, text, public.initial_intent_type, jsonb) from anon, service_role;
grant execute on function public.update_my_profile(text, text, text, public.initial_intent_type, jsonb) to authenticated;
