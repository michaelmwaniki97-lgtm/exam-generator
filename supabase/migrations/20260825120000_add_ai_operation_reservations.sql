-- Security B1A: durable, serverless-safe AI quotas, leases and idempotency.

create table public.ai_operation_reservations (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  operation_type text not null check (operation_type in ('generation', 'regeneration')),
  request_key uuid not null,
  target_exam_id uuid references public.exams(id) on delete cascade,
  target_slot_id text,
  status text not null check (status in ('active', 'completed', 'failed', 'expired')),
  lease_expires_at timestamptz not null,
  result_exam_id uuid references public.exams(id) on delete set null,
  result_revision integer check (result_revision is null or result_revision > 0),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (teacher_id, operation_type, request_key),
  check (
    (operation_type = 'generation' and target_exam_id is null and target_slot_id is null) or
    (operation_type = 'regeneration' and target_exam_id is not null and target_slot_id is not null and
      length(target_slot_id) between 1 and 200)
  )
);

create unique index ai_one_active_generation_per_teacher
  on public.ai_operation_reservations (teacher_id)
  where operation_type = 'generation' and status = 'active';

create unique index ai_one_active_regeneration_per_exam
  on public.ai_operation_reservations (target_exam_id)
  where operation_type = 'regeneration' and status = 'active';

create index ai_operation_quota_lookup
  on public.ai_operation_reservations (teacher_id, operation_type, created_at desc);

alter table public.ai_operation_reservations enable row level security;
revoke all on public.ai_operation_reservations from public, anon, authenticated;
grant select, insert, update on public.ai_operation_reservations to service_role;

alter table public.exams add column generation_request_key uuid;
create unique index exams_teacher_generation_request_unique
  on public.exams (teacher_id, generation_request_key)
  where generation_request_key is not null;
revoke update (generation_request_key) on public.exams from authenticated;

create function public.claim_ai_generation(p_teacher_id uuid, p_request_key uuid)
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
  if (select count(*) from public.ai_operation_reservations where teacher_id = p_teacher_id and operation_type = 'generation' and created_at > now() - interval '24 hours') >= 10 then
    return query select 'quota_exceeded', null::uuid, null::uuid, null::integer; return;
  end if;
  insert into public.ai_operation_reservations(teacher_id, operation_type, request_key, status, lease_expires_at)
    values (p_teacher_id, 'generation', p_request_key, 'active', now() + interval '360 seconds') returning id into v_id;
  return query select 'acquired', v_id, null::uuid, null::integer;
end;
$$;

create function public.claim_ai_regeneration(p_teacher_id uuid, p_exam_id uuid, p_slot_id text, p_request_key uuid, p_expected_revision integer)
returns table(outcome text, reservation_id uuid, result_exam_id uuid, result_revision integer)
language plpgsql security definer set search_path = pg_catalog
as $$
declare v_existing public.ai_operation_reservations; v_id uuid;
begin
  if p_teacher_id is null or p_exam_id is null or p_request_key is null or p_slot_id is null or length(p_slot_id) not between 1 and 200 or p_expected_revision is null or p_expected_revision <= 0 then
    return query select 'invalid', null::uuid, null::uuid, null::integer; return;
  end if;
  perform 1 from public.teachers where id = p_teacher_id for update;
  if not found or not exists (select 1 from public.exams where id = p_exam_id and teacher_id = p_teacher_id and status not in ('paid', 'downloaded')) then
    return query select 'invalid', null::uuid, null::uuid, null::integer; return;
  end if;
  update public.ai_operation_reservations set status = 'expired', completed_at = now()
    where operation_type = 'regeneration' and target_exam_id = p_exam_id and
      status = 'active' and lease_expires_at <= now();
  select * into v_existing from public.ai_operation_reservations
    where teacher_id = p_teacher_id and operation_type = 'regeneration' and request_key = p_request_key;
  if found then
    if v_existing.target_exam_id <> p_exam_id or v_existing.target_slot_id <> p_slot_id then
      return query select 'terminal', v_existing.id, null::uuid, null::integer;
    elsif v_existing.status = 'completed' and v_existing.result_revision is not null then
      return query select 'completed', v_existing.id, null::uuid, v_existing.result_revision;
    elsif v_existing.status = 'active' then return query select 'duplicate_active', v_existing.id, null::uuid, null::integer;
    else return query select 'terminal', v_existing.id, null::uuid, null::integer; end if;
    return;
  end if;
  if not exists (
    select 1 from public.exams
    where id = p_exam_id and teacher_id = p_teacher_id and
      status not in ('paid', 'downloaded') and revision = p_expected_revision
  ) then
    return query select 'stale', null::uuid, null::uuid, null::integer; return;
  end if;
  if exists (select 1 from public.ai_operation_reservations where operation_type = 'regeneration' and target_exam_id = p_exam_id and status = 'active') then
    return query select 'busy', null::uuid, null::uuid, null::integer; return;
  end if;
  if (select count(*) from public.ai_operation_reservations where teacher_id = p_teacher_id and operation_type = 'regeneration' and created_at > now() - interval '24 hours') >= 50 then
    return query select 'quota_exceeded', null::uuid, null::uuid, null::integer; return;
  end if;
  insert into public.ai_operation_reservations(teacher_id, operation_type, request_key, target_exam_id, target_slot_id, status, lease_expires_at)
    values (p_teacher_id, 'regeneration', p_request_key, p_exam_id, p_slot_id, 'active', now() + interval '330 seconds') returning id into v_id;
  return query select 'acquired', v_id, null::uuid, null::integer;
end;
$$;

create function public.persist_generated_exam_and_complete_ai_operation(
  p_teacher_id uuid,
  p_reservation_id uuid,
  p_request_key uuid,
  p_subject_id uuid,
  p_grade_id uuid,
  p_exam_type text,
  p_marks integer,
  p_duration integer,
  p_difficulty text,
  p_term text,
  p_year integer,
  p_exam_content jsonb,
  p_marking_content jsonb
)
returns uuid language plpgsql security definer set search_path = pg_catalog
as $$
declare v_reservation public.ai_operation_reservations; v_exam_id uuid;
begin
  if p_teacher_id is null or p_reservation_id is null or p_request_key is null or
     p_subject_id is null or p_grade_id is null or p_exam_type is null or
     p_marks is null or p_duration is null or p_difficulty is null or
     p_term is null or p_year is null or p_exam_content is null or p_marking_content is null then
    raise exception using errcode = '22023', message = 'invalid_generation_persistence';
  end if;

  select * into v_reservation from public.ai_operation_reservations
    where id = p_reservation_id for update;
  if not found or v_reservation.teacher_id <> p_teacher_id or
     v_reservation.operation_type <> 'generation' or
     v_reservation.request_key <> p_request_key or
     v_reservation.status <> 'active' or v_reservation.lease_expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'invalid_generation_reservation';
  end if;

  insert into public.exams(
    teacher_id, subject_id, grade_id, exam_type, marks, duration, difficulty,
    term, year, status, generation_request_key, content
  ) values (
    p_teacher_id, p_subject_id, p_grade_id, p_exam_type, p_marks, p_duration,
    p_difficulty, p_term, p_year, 'generated', p_request_key, p_exam_content
  ) returning id into v_exam_id;

  insert into public.marking_schemes(exam_id, content)
    values (v_exam_id, p_marking_content);

  update public.ai_operation_reservations set status = 'completed', result_exam_id = v_exam_id, completed_at = now(), lease_expires_at = now()
    where id = p_reservation_id;
  return v_exam_id;
end;
$$;

create function public.persist_regenerated_exam_and_complete_ai_operation(
  p_teacher_id uuid,
  p_reservation_id uuid,
  p_request_key uuid,
  p_exam_id uuid,
  p_slot_id text,
  p_expected_revision integer,
  p_exam_content jsonb,
  p_marking_content jsonb
)
returns integer language plpgsql security definer set search_path = pg_catalog
as $$
declare v_reservation public.ai_operation_reservations; v_exam public.exams%rowtype; v_affected_rows integer; v_new_revision integer;
begin
  if p_teacher_id is null or p_reservation_id is null or p_request_key is null or
     p_exam_id is null or p_slot_id is null or length(p_slot_id) not between 1 and 200 or
     p_expected_revision is null or p_expected_revision <= 0 or
     p_exam_content is null or p_marking_content is null then
    raise exception using errcode = '22023', message = 'invalid_regeneration_persistence';
  end if;

  select * into v_reservation from public.ai_operation_reservations
    where id = p_reservation_id for update;
  if not found or v_reservation.teacher_id <> p_teacher_id or
     v_reservation.operation_type <> 'regeneration' or
     v_reservation.request_key <> p_request_key or
     v_reservation.target_exam_id <> p_exam_id or
     v_reservation.target_slot_id <> p_slot_id or
     v_reservation.status <> 'active' or v_reservation.lease_expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'invalid_regeneration_reservation';
  end if;

  select * into v_exam from public.exams where id = p_exam_id for update;
  if not found or v_exam.teacher_id <> p_teacher_id then
    raise exception using errcode = 'P0001', message = 'exam_not_editable';
  end if;
  if v_exam.status in ('paid', 'downloaded') then
    raise exception using errcode = 'P0001', message = 'exam_locked';
  end if;
  if v_exam.revision <> p_expected_revision then
    raise exception using errcode = '40001', message = 'stale_exam_revision';
  end if;

  update public.marking_schemes set content = p_marking_content where exam_id = p_exam_id;
  get diagnostics v_affected_rows = row_count;
  if v_affected_rows <> 1 then
    raise exception using errcode = 'P0001', message = 'marking_scheme_not_editable';
  end if;

  update public.exams set content = p_exam_content, revision = revision + 1
    where id = p_exam_id returning revision into v_new_revision;
  update public.ai_operation_reservations set status = 'completed', result_revision = v_new_revision,
    completed_at = now(), lease_expires_at = now() where id = p_reservation_id;
  return v_new_revision;
end;
$$;

create function public.fail_ai_operation(p_teacher_id uuid, p_reservation_id uuid)
returns boolean language plpgsql security definer set search_path = pg_catalog
as $$
begin
  update public.ai_operation_reservations set status = 'failed', completed_at = now(), lease_expires_at = now()
    where id = p_reservation_id and teacher_id = p_teacher_id and status = 'active';
  return found;
end;
$$;

revoke all on function public.claim_ai_generation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.claim_ai_regeneration(uuid, uuid, text, uuid, integer) from public, anon, authenticated;
revoke all on function public.persist_generated_exam_and_complete_ai_operation(uuid, uuid, uuid, uuid, uuid, text, integer, integer, text, text, integer, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.persist_regenerated_exam_and_complete_ai_operation(uuid, uuid, uuid, uuid, text, integer, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.fail_ai_operation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_ai_generation(uuid, uuid) to service_role;
grant execute on function public.claim_ai_regeneration(uuid, uuid, text, uuid, integer) to service_role;
grant execute on function public.persist_generated_exam_and_complete_ai_operation(uuid, uuid, uuid, uuid, uuid, text, integer, integer, text, text, integer, jsonb, jsonb) to service_role;
grant execute on function public.persist_regenerated_exam_and_complete_ai_operation(uuid, uuid, uuid, uuid, text, integer, jsonb, jsonb) to service_role;
grant execute on function public.fail_ai_operation(uuid, uuid) to service_role;
