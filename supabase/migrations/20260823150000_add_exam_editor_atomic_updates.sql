-- Phase 8: optimistic concurrency and atomic exam/marking-scheme editing.

alter table public.exams
  add column revision integer not null default 1
  check (revision > 0);

create function public.update_exam_and_scheme_atomic(
  p_exam_id uuid,
  p_teacher_id uuid,
  p_expected_revision integer,
  p_exam_content jsonb,
  p_marking_content jsonb
)
returns integer
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_exam public.exams%rowtype;
  v_affected_rows integer;
  v_new_revision integer;
begin
  if p_exam_id is null
    or p_teacher_id is null
    or p_expected_revision is null
    or p_expected_revision <= 0
    or p_exam_content is null
    or p_marking_content is null then
    raise exception using
      errcode = '22023',
      message = 'invalid_exam_update';
  end if;

  select *
  into v_exam
  from public.exams
  where id = p_exam_id
  for update;

  if not found or v_exam.teacher_id <> p_teacher_id then
    raise exception using
      errcode = 'P0001',
      message = 'exam_not_editable';
  end if;

  if v_exam.status in ('paid', 'downloaded') then
    raise exception using
      errcode = 'P0001',
      message = 'exam_locked';
  end if;

  if v_exam.revision <> p_expected_revision then
    raise exception using
      errcode = '40001',
      message = 'stale_exam_revision';
  end if;

  update public.marking_schemes
  set content = p_marking_content
  where exam_id = p_exam_id;

  get diagnostics v_affected_rows = row_count;
  if v_affected_rows <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'marking_scheme_not_editable';
  end if;

  update public.exams
  set content = p_exam_content,
      revision = revision + 1
  where id = p_exam_id
  returning revision into v_new_revision;

  return v_new_revision;
end;
$$;

revoke all on function public.update_exam_and_scheme_atomic(uuid, uuid, integer, jsonb, jsonb)
from public, anon, authenticated;

grant execute on function public.update_exam_and_scheme_atomic(uuid, uuid, integer, jsonb, jsonb)
to service_role;
