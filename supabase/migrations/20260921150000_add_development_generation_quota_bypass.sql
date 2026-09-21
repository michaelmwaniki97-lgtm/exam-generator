-- Failed or expired reservations release their lease and no longer count against
-- the rolling quota. Completed and active operations retain the existing limit.
create or replace function public.claim_ai_generation(p_teacher_id uuid, p_request_key uuid)
returns table(outcome text, reservation_id uuid, result_exam_id uuid, result_revision integer)
language plpgsql security definer set search_path = pg_catalog
as $$
declare v_existing public.ai_operation_reservations; v_id uuid;
begin
  if p_teacher_id is null or p_request_key is null then return query select 'invalid', null::uuid, null::uuid, null::integer; return; end if;
  perform 1 from public.teachers where id = p_teacher_id for update;
  if not found then return query select 'invalid', null::uuid, null::uuid, null::integer; return; end if;

  update public.ai_operation_reservations set status = 'expired', completed_at = now()
    where teacher_id = p_teacher_id and operation_type = 'generation' and
      status = 'active' and lease_expires_at <= now();

  select * into v_existing from public.ai_operation_reservations
    where teacher_id = p_teacher_id and operation_type = 'generation' and request_key = p_request_key;
  if found then
    if v_existing.status = 'completed' and v_existing.result_exam_id is not null then
      return query select 'completed', v_existing.id, v_existing.result_exam_id, null::integer;
    elsif v_existing.status = 'active' then
      return query select 'duplicate_active', v_existing.id, null::uuid, null::integer;
    else
      return query select 'terminal', v_existing.id, null::uuid, null::integer;
    end if;
    return;
  end if;
  if exists (select 1 from public.ai_operation_reservations where teacher_id = p_teacher_id and operation_type = 'generation' and status = 'active') then
    return query select 'busy', null::uuid, null::uuid, null::integer; return;
  end if;
  if (select count(*) from public.ai_operation_reservations where teacher_id = p_teacher_id and operation_type = 'generation' and status in ('active', 'completed') and created_at > now() - interval '24 hours') >= 10 then
    return query select 'quota_exceeded', null::uuid, null::uuid, null::integer; return;
  end if;
  insert into public.ai_operation_reservations(teacher_id, operation_type, request_key, status, lease_expires_at)
    values (p_teacher_id, 'generation', p_request_key, 'active', now() + interval '360 seconds') returning id into v_id;
  return query select 'acquired', v_id, null::uuid, null::integer;
end;
$$;

-- Callable only by the trusted server path. The application invokes it only when
-- NODE_ENV is not production and the explicit local bypass flag is enabled.
create function public.reset_development_generation_quota(p_teacher_id uuid)
returns boolean language plpgsql security definer set search_path = pg_catalog
as $$
begin
  update public.ai_operation_reservations
    set created_at = now() - interval '25 hours'
    where teacher_id = p_teacher_id and operation_type = 'generation' and status <> 'active';
  return true;
end;
$$;

revoke all on function public.reset_development_generation_quota(uuid) from public, anon, authenticated;
grant execute on function public.reset_development_generation_quota(uuid) to service_role;
