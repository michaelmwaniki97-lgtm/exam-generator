-- ============================================================================
-- Verified curriculum import infrastructure.
--
-- Additive by design: existing curriculum UUIDs are retained for historical
-- exam JSON references. The transactional import function marks replaced
-- hierarchy roots inactive, snapshots them for audit, and inserts deterministic
-- official rows alongside them. It never deletes legacy curriculum records.
-- ============================================================================

alter table public.grades
  add column if not exists sort_order integer not null default 0;

alter table public.strands
  add column if not exists sort_order integer not null default 0,
  add column if not exists source_code text,
  add column if not exists verification_status text not null default 'unverified',
  add column if not exists outcome_status text not null default 'unverified',
  add column if not exists source_ref text,
  add column if not exists source_metadata jsonb not null default '{}'::jsonb,
  add column if not exists is_active boolean not null default true,
  add column if not exists curriculum_import_id uuid;

alter table public.sub_strands
  add column if not exists sort_order integer not null default 0,
  add column if not exists source_code text,
  add column if not exists verification_status text not null default 'unverified',
  add column if not exists outcome_status text not null default 'unverified',
  add column if not exists source_ref text,
  add column if not exists source_metadata jsonb not null default '{}'::jsonb,
  add column if not exists curriculum_import_id uuid;

alter table public.learning_outcomes
  add column if not exists sort_order integer not null default 0,
  add column if not exists verification_status text not null default 'unverified',
  add column if not exists source_ref text,
  add column if not exists source_metadata jsonb not null default '{}'::jsonb,
  add column if not exists curriculum_import_id uuid;

update public.grades
set sort_order = case name
  when 'PP1' then 1
  when 'PP2' then 2
  when 'Grade 1' then 3
  when 'Grade 2' then 4
  when 'Grade 3' then 5
  when 'Grade 4' then 6
  when 'Grade 5' then 7
  when 'Grade 6' then 8
  when 'Grade 7' then 9
  when 'Grade 8' then 10
  when 'Grade 9' then 11
  when 'Grade 10' then 12
  when 'Form 1' then 13
  when 'Form 2' then 14
  when 'Form 3' then 15
  when 'Form 4' then 16
  else 1000
end
where sort_order = 0;

alter table public.strands
  drop constraint if exists strands_verification_status_check,
  add constraint strands_verification_status_check check (
    verification_status in (
      'unverified',
      'verified_official',
      'textbook_verified_kicd_pending'
    )
  ),
  drop constraint if exists strands_outcome_status_check,
  add constraint strands_outcome_status_check check (
    outcome_status in ('unverified', 'sourced', 'source_required')
  ),
  drop constraint if exists strands_sort_order_check,
  add constraint strands_sort_order_check check (sort_order >= 0);

alter table public.sub_strands
  drop constraint if exists sub_strands_verification_status_check,
  add constraint sub_strands_verification_status_check check (
    verification_status in (
      'unverified',
      'verified_official',
      'textbook_verified_kicd_pending'
    )
  ),
  drop constraint if exists sub_strands_outcome_status_check,
  add constraint sub_strands_outcome_status_check check (
    outcome_status in (
      'unverified',
      'sourced',
      'source_required',
      'official_topic_objectives_apply'
    )
  ),
  drop constraint if exists sub_strands_sort_order_check,
  add constraint sub_strands_sort_order_check check (sort_order >= 0);

alter table public.learning_outcomes
  drop constraint if exists learning_outcomes_verification_status_check,
  add constraint learning_outcomes_verification_status_check check (
    verification_status in (
      'unverified',
      'verified_official',
      'textbook_verified_kicd_pending'
    )
  ),
  drop constraint if exists learning_outcomes_sort_order_check,
  add constraint learning_outcomes_sort_order_check check (sort_order >= 0);

create table if not exists public.curriculum_imports (
  id uuid primary key default gen_random_uuid(),
  dataset_version text not null,
  dataset_hash text not null unique,
  status text not null check (status in ('running', 'complete')),
  expected_counts jsonb not null,
  source_manifest jsonb not null,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.strands
  drop constraint if exists strands_curriculum_import_id_fkey,
  add constraint strands_curriculum_import_id_fkey
    foreign key (curriculum_import_id)
    references public.curriculum_imports (id)
    on delete restrict;

alter table public.sub_strands
  drop constraint if exists sub_strands_curriculum_import_id_fkey,
  add constraint sub_strands_curriculum_import_id_fkey
    foreign key (curriculum_import_id)
    references public.curriculum_imports (id)
    on delete restrict;

alter table public.learning_outcomes
  drop constraint if exists learning_outcomes_curriculum_import_id_fkey,
  add constraint learning_outcomes_curriculum_import_id_fkey
    foreign key (curriculum_import_id)
    references public.curriculum_imports (id)
    on delete restrict;

create table if not exists public.strand_objectives (
  id uuid primary key default gen_random_uuid(),
  strand_id uuid not null references public.strands (id) on delete cascade,
  description text not null,
  label text,
  sort_order integer not null default 0 check (sort_order >= 0),
  verification_status text not null default 'unverified' check (
    verification_status in (
      'unverified',
      'verified_official',
      'textbook_verified_kicd_pending'
    )
  ),
  source_ref text,
  source_metadata jsonb not null default '{}'::jsonb,
  curriculum_import_id uuid references public.curriculum_imports (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.curriculum_import_legacy_records (
  import_id uuid not null references public.curriculum_imports (id) on delete restrict,
  record_type text not null check (
    record_type in ('strand', 'sub_strand', 'learning_outcome')
  ),
  record_id uuid not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  primary key (import_id, record_type, record_id)
);

create table if not exists public.curriculum_source_exceptions (
  id uuid primary key,
  grade_id uuid not null references public.grades (id) on delete restrict,
  subject_id uuid not null references public.subjects (id) on delete restrict,
  status text not null check (status in ('source_unavailable')),
  details jsonb not null,
  curriculum_import_id uuid not null references public.curriculum_imports (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (grade_id, subject_id)
);

create unique index if not exists uq_subjects_name_ci
  on public.subjects (lower(name));
create unique index if not exists uq_grades_name_ci
  on public.grades (lower(name));
create unique index if not exists uq_active_unkeyed_strands_parent_name_ci
  on public.strands (grade_id, subject_id, lower(name))
  where is_active and source_ref is null;
create unique index if not exists uq_active_sourced_strands_parent_order
  on public.strands (grade_id, subject_id, sort_order)
  where is_active and source_ref is not null;
create unique index if not exists uq_unkeyed_sub_strands_parent_name_ci
  on public.sub_strands (strand_id, lower(name))
  where source_ref is null;
create unique index if not exists uq_sourced_sub_strands_parent_order
  on public.sub_strands (strand_id, sort_order)
  where source_ref is not null;
create index if not exists idx_strands_parent_source_code
  on public.strands (grade_id, subject_id, source_code);
create index if not exists idx_sub_strands_parent_source_code
  on public.sub_strands (strand_id, source_code);
create unique index if not exists uq_learning_outcomes_parent_description_ci
  on public.learning_outcomes (sub_strand_id, lower(description));
create unique index if not exists uq_strand_objectives_parent_description_ci
  on public.strand_objectives (strand_id, lower(description));
create index if not exists idx_strands_active_context_order
  on public.strands (grade_id, subject_id, is_active, sort_order);
create index if not exists idx_sub_strands_parent_order
  on public.sub_strands (strand_id, sort_order);
create index if not exists idx_learning_outcomes_parent_order
  on public.learning_outcomes (sub_strand_id, sort_order);
create index if not exists idx_strand_objectives_parent_order
  on public.strand_objectives (strand_id, sort_order);
create index if not exists idx_curriculum_legacy_record_id
  on public.curriculum_import_legacy_records (record_id);

alter table public.strand_objectives enable row level security;
alter table public.curriculum_imports enable row level security;
alter table public.curriculum_import_legacy_records enable row level security;
alter table public.curriculum_source_exceptions enable row level security;

drop policy if exists strand_objectives_select_all on public.strand_objectives;
create policy strand_objectives_select_all
  on public.strand_objectives for select
  to authenticated
  using (true);

drop policy if exists strand_objectives_admin_write on public.strand_objectives;
create policy strand_objectives_admin_write
  on public.strand_objectives for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists curriculum_imports_admin_select on public.curriculum_imports;
create policy curriculum_imports_admin_select
  on public.curriculum_imports for select
  to authenticated
  using (public.is_admin());

drop policy if exists curriculum_import_legacy_records_admin_select
  on public.curriculum_import_legacy_records;
create policy curriculum_import_legacy_records_admin_select
  on public.curriculum_import_legacy_records for select
  to authenticated
  using (public.is_admin());

drop policy if exists curriculum_source_exceptions_admin_select
  on public.curriculum_source_exceptions;
create policy curriculum_source_exceptions_admin_select
  on public.curriculum_source_exceptions for select
  to authenticated
  using (public.is_admin());

grant select, insert, update, delete on public.strand_objectives to authenticated;
grant select on public.curriculum_imports to authenticated;
grant select on public.curriculum_import_legacy_records to authenticated;
grant select on public.curriculum_source_exceptions to authenticated;
grant all on public.strand_objectives, public.curriculum_imports, public.curriculum_import_legacy_records, public.curriculum_source_exceptions to service_role;

create or replace function public.import_verified_curriculum(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_import_id uuid;
  v_existing_summary jsonb;
  v_dataset_hash text := p_payload ->> 'dataset_hash';
  v_dataset_version text := p_payload ->> 'dataset_version';
  v_expected jsonb := p_payload -> 'expected_counts';
  v_preconditions jsonb := p_payload -> 'preconditions';
  v_legacy_strands integer;
  v_legacy_sub_strands integer;
  v_legacy_outcomes integer;
  v_historical_topic_references integer;
  v_summary jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role is required for verified curriculum import'
      using errcode = '42501';
  end if;

  if coalesce((p_payload ->> 'schema_version')::integer, 0) <> 1 then
    raise exception 'Unsupported curriculum import payload schema version';
  end if;
  if v_dataset_hash is null or v_dataset_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'A valid SHA-256 dataset hash is required';
  end if;
  if nullif(v_dataset_version, '') is null then
    raise exception 'A dataset version is required';
  end if;

  select summary
  into v_existing_summary
  from public.curriculum_imports
  where dataset_hash = v_dataset_hash
    and status = 'complete';

  if found then
    return v_existing_summary || jsonb_build_object('repeat_run', true);
  end if;

  if (select count(*) from public.subjects) <> (v_preconditions ->> 'subjects')::bigint
    or (select count(*) from public.grades) <> (v_preconditions ->> 'grades')::bigint
    or (select count(*) from public.strands) <> (v_preconditions ->> 'strands')::bigint
    or (select count(*) from public.sub_strands) <> (v_preconditions ->> 'sub_strands')::bigint
    or (select count(*) from public.learning_outcomes) <> (v_preconditions ->> 'learning_outcomes')::bigint
    or (select count(*) from public.textbooks) <> (v_preconditions ->> 'textbooks')::bigint
    or (select count(*) from public.exams) <> (v_preconditions ->> 'exams')::bigint
    or (select count(*) from public.marking_schemes) <> (v_preconditions ->> 'marking_schemes')::bigint
  then
    raise exception 'Live database changed after preflight; regenerate the import plan';
  end if;

  create temp table tmp_curriculum_subjects (
    id uuid primary key,
    name text not null
  ) on commit drop;
  create temp table tmp_curriculum_grades (
    id uuid primary key,
    name text not null
  ) on commit drop;
  create temp table tmp_curriculum_contexts (
    id uuid primary key,
    grade_id uuid not null,
    subject_id uuid not null,
    education_system text not null,
    verification_status text not null,
    outcome_status text not null,
    source_ref text not null
  ) on commit drop;
  create temp table tmp_curriculum_strands (
    id uuid primary key,
    context_id uuid not null,
    grade_id uuid not null,
    subject_id uuid not null,
    name text not null,
    sort_order integer not null,
    source_code text,
    verification_status text not null,
    outcome_status text not null,
    source_ref text not null,
    source_metadata jsonb not null
  ) on commit drop;
  create temp table tmp_curriculum_sub_strands (
    id uuid primary key,
    strand_id uuid not null,
    name text not null,
    sort_order integer not null,
    source_code text,
    verification_status text not null,
    outcome_status text not null,
    source_ref text not null,
    source_metadata jsonb not null
  ) on commit drop;
  create temp table tmp_curriculum_strand_objectives (
    id uuid primary key,
    strand_id uuid not null,
    description text not null,
    label text,
    sort_order integer not null,
    verification_status text not null,
    source_ref text not null,
    source_metadata jsonb not null
  ) on commit drop;
  create temp table tmp_curriculum_source_exceptions (
    id uuid primary key,
    grade_id uuid not null,
    subject_id uuid not null,
    status text not null,
    details jsonb not null
  ) on commit drop;

  insert into tmp_curriculum_subjects
  select * from jsonb_to_recordset(coalesce(p_payload -> 'subjects', '[]'::jsonb))
    as row(id uuid, name text);
  insert into tmp_curriculum_grades
  select * from jsonb_to_recordset(coalesce(p_payload -> 'grades', '[]'::jsonb))
    as row(id uuid, name text);
  insert into tmp_curriculum_contexts
  select * from jsonb_to_recordset(coalesce(p_payload -> 'contexts', '[]'::jsonb))
    as row(
      id uuid,
      grade_id uuid,
      subject_id uuid,
      education_system text,
      verification_status text,
      outcome_status text,
      source_ref text
    );
  insert into tmp_curriculum_strands
  select * from jsonb_to_recordset(coalesce(p_payload -> 'strands', '[]'::jsonb))
    as row(
      id uuid,
      context_id uuid,
      grade_id uuid,
      subject_id uuid,
      name text,
      sort_order integer,
      source_code text,
      verification_status text,
      outcome_status text,
      source_ref text,
      source_metadata jsonb
    );
  insert into tmp_curriculum_sub_strands
  select * from jsonb_to_recordset(coalesce(p_payload -> 'sub_strands', '[]'::jsonb))
    as row(
      id uuid,
      strand_id uuid,
      name text,
      sort_order integer,
      source_code text,
      verification_status text,
      outcome_status text,
      source_ref text,
      source_metadata jsonb
    );
  insert into tmp_curriculum_strand_objectives
  select * from jsonb_to_recordset(coalesce(p_payload -> 'strand_objectives', '[]'::jsonb))
    as row(
      id uuid,
      strand_id uuid,
      description text,
      label text,
      sort_order integer,
      verification_status text,
      source_ref text,
      source_metadata jsonb
    );
  insert into tmp_curriculum_source_exceptions
  select * from jsonb_to_recordset(coalesce(p_payload -> 'source_exceptions', '[]'::jsonb))
    as row(id uuid, grade_id uuid, subject_id uuid, status text, details jsonb);

  if (select count(*) from tmp_curriculum_contexts) <> (v_expected ->> 'official_contexts')::integer
    or (select count(*) from tmp_curriculum_strands) <> (v_expected ->> 'strands_and_topics')::integer
    or (select count(*) from tmp_curriculum_sub_strands) <> (v_expected ->> 'sub_strands_and_sub_topics')::integer
    or (select count(*) from tmp_curriculum_strand_objectives) <> (v_expected ->> 'strand_objectives')::integer
    or (select count(*) from tmp_curriculum_source_exceptions) <> (v_expected ->> 'source_exceptions')::integer
  then
    raise exception 'Payload row counts do not match expected counts';
  end if;

  if (select count(*) from tmp_curriculum_contexts where education_system = 'CBC') <> 117
    or (select count(*) from tmp_curriculum_contexts where education_system = '8-4-4') <> 24
    or (
      select count(*)
      from tmp_curriculum_strands s
      join tmp_curriculum_contexts c on c.id = s.context_id
      where c.education_system = '8-4-4'
    ) <> 191
    or (
      select count(*)
      from tmp_curriculum_sub_strands ss
      join tmp_curriculum_strands s on s.id = ss.strand_id
      join tmp_curriculum_contexts c on c.id = s.context_id
      where c.education_system = '8-4-4'
    ) <> 1101
    or (select count(*) from tmp_curriculum_strand_objectives) <> 1287
    or (select count(*) from tmp_curriculum_source_exceptions) <> 4
  then
    raise exception 'Payload does not match the locked verified curriculum milestone totals';
  end if;

  if exists (
    select 1
    from tmp_curriculum_contexts
    group by grade_id, subject_id
    having count(*) > 1
  ) or exists (
    select 1
    from tmp_curriculum_strands
    group by grade_id, subject_id, sort_order
    having count(*) > 1
  ) or exists (
    select 1
    from tmp_curriculum_sub_strands
    group by strand_id, sort_order
    having count(*) > 1
  ) or exists (
    select 1
    from tmp_curriculum_strand_objectives
    group by strand_id, lower(description)
    having count(*) > 1
  ) then
    raise exception 'Payload contains a duplicate parent-context key';
  end if;

  if exists (
    select 1
    from tmp_curriculum_grades incoming
    left join public.grades live on live.id = incoming.id
    where live.id is null or live.name <> incoming.name
  ) then
    raise exception 'Required grade/class IDs and exact names do not match the live database';
  end if;

  if exists (
    select 1
    from tmp_curriculum_subjects incoming
    join public.subjects live on lower(live.name) = lower(incoming.name)
    where live.id <> incoming.id
  ) or exists (
    select 1
    from tmp_curriculum_subjects incoming
    join public.subjects live on live.id = incoming.id
    where lower(live.name) <> lower(incoming.name)
  ) then
    raise exception 'Subject name or deterministic ID collision detected';
  end if;

  if exists (
    select 1
    from tmp_curriculum_strands incoming
    join public.strands live on live.id = incoming.id
    where live.grade_id <> incoming.grade_id
      or live.subject_id <> incoming.subject_id
      or live.name <> incoming.name
  ) or exists (
    select 1
    from tmp_curriculum_sub_strands incoming
    join public.sub_strands live on live.id = incoming.id
    where live.strand_id <> incoming.strand_id or live.name <> incoming.name
  ) or exists (
    select 1
    from tmp_curriculum_strand_objectives incoming
    join public.strand_objectives live on live.id = incoming.id
    where live.strand_id <> incoming.strand_id
      or live.description <> incoming.description
  ) then
    raise exception 'Deterministic curriculum UUID collision detected';
  end if;

  if (
    select count(*)
    from tmp_curriculum_strands s
    join tmp_curriculum_contexts c on c.id = s.context_id
    join tmp_curriculum_grades g on g.id = c.grade_id
    join tmp_curriculum_subjects subject on subject.id = c.subject_id
    where g.name = 'Form 3'
      and subject.name = 'Christian Religious Education'
      and s.outcome_status = 'source_required'
  ) <> 6 then
    raise exception 'The six source-required Form 3 CRE topics were not preserved';
  end if;

  insert into public.curriculum_imports (
    dataset_version,
    dataset_hash,
    status,
    expected_counts,
    source_manifest
  ) values (
    v_dataset_version,
    v_dataset_hash,
    'running',
    v_expected,
    coalesce(p_payload -> 'source_manifest', '[]'::jsonb)
  ) returning id into v_import_id;

  insert into public.subjects (id, name)
  select id, name from tmp_curriculum_subjects
  on conflict (id) do nothing;

  insert into public.curriculum_import_legacy_records (
    import_id,
    record_type,
    record_id,
    snapshot
  )
  select
    v_import_id,
    'strand',
    s.id,
    to_jsonb(s)
  from public.strands s
  join tmp_curriculum_contexts c
    on c.grade_id = s.grade_id and c.subject_id = s.subject_id
  where s.is_active
    and not exists (select 1 from tmp_curriculum_strands incoming where incoming.id = s.id)
  on conflict do nothing;

  insert into public.curriculum_import_legacy_records (
    import_id,
    record_type,
    record_id,
    snapshot
  )
  select
    v_import_id,
    'sub_strand',
    ss.id,
    to_jsonb(ss)
  from public.sub_strands ss
  join public.strands s on s.id = ss.strand_id
  join tmp_curriculum_contexts c
    on c.grade_id = s.grade_id and c.subject_id = s.subject_id
  where s.is_active
    and not exists (select 1 from tmp_curriculum_strands incoming where incoming.id = s.id)
  on conflict do nothing;

  insert into public.curriculum_import_legacy_records (
    import_id,
    record_type,
    record_id,
    snapshot
  )
  select
    v_import_id,
    'learning_outcome',
    lo.id,
    to_jsonb(lo)
  from public.learning_outcomes lo
  join public.sub_strands ss on ss.id = lo.sub_strand_id
  join public.strands s on s.id = ss.strand_id
  join tmp_curriculum_contexts c
    on c.grade_id = s.grade_id and c.subject_id = s.subject_id
  where s.is_active
    and not exists (select 1 from tmp_curriculum_strands incoming where incoming.id = s.id)
  on conflict do nothing;

  select count(*) filter (where record_type = 'strand'),
         count(*) filter (where record_type = 'sub_strand'),
         count(*) filter (where record_type = 'learning_outcome')
  into v_legacy_strands, v_legacy_sub_strands, v_legacy_outcomes
  from public.curriculum_import_legacy_records
  where import_id = v_import_id;

  select count(*)
  into v_historical_topic_references
  from public.exams e
  cross join lateral jsonb_array_elements_text(
    coalesce(e.content #> '{meta,topicIds}', '[]'::jsonb)
  ) topic_id
  join public.sub_strands ss on ss.id::text = topic_id.value
  join public.strands s on s.id = ss.strand_id
  join tmp_curriculum_contexts c
    on c.grade_id = s.grade_id and c.subject_id = s.subject_id;

  update public.strands s
  set is_active = false
  from tmp_curriculum_contexts c
  where c.grade_id = s.grade_id
    and c.subject_id = s.subject_id
    and s.is_active
    and not exists (select 1 from tmp_curriculum_strands incoming where incoming.id = s.id);

  insert into public.strands (
    id,
    grade_id,
    subject_id,
    name,
    sort_order,
    source_code,
    verification_status,
    outcome_status,
    source_ref,
    source_metadata,
    is_active,
    curriculum_import_id
  )
  select
    id,
    grade_id,
    subject_id,
    name,
    sort_order,
    source_code,
    verification_status,
    outcome_status,
    source_ref,
    source_metadata,
    true,
    v_import_id
  from tmp_curriculum_strands
  on conflict (id) do update set
    sort_order = excluded.sort_order,
    source_code = excluded.source_code,
    verification_status = excluded.verification_status,
    outcome_status = excluded.outcome_status,
    source_ref = excluded.source_ref,
    source_metadata = excluded.source_metadata,
    is_active = true,
    curriculum_import_id = excluded.curriculum_import_id;

  insert into public.sub_strands (
    id,
    strand_id,
    name,
    sort_order,
    source_code,
    verification_status,
    outcome_status,
    source_ref,
    source_metadata,
    curriculum_import_id
  )
  select
    id,
    strand_id,
    name,
    sort_order,
    source_code,
    verification_status,
    outcome_status,
    source_ref,
    source_metadata,
    v_import_id
  from tmp_curriculum_sub_strands
  on conflict (id) do update set
    sort_order = excluded.sort_order,
    source_code = excluded.source_code,
    verification_status = excluded.verification_status,
    outcome_status = excluded.outcome_status,
    source_ref = excluded.source_ref,
    source_metadata = excluded.source_metadata,
    curriculum_import_id = excluded.curriculum_import_id;

  insert into public.strand_objectives (
    id,
    strand_id,
    description,
    label,
    sort_order,
    verification_status,
    source_ref,
    source_metadata,
    curriculum_import_id
  )
  select
    id,
    strand_id,
    description,
    label,
    sort_order,
    verification_status,
    source_ref,
    source_metadata,
    v_import_id
  from tmp_curriculum_strand_objectives
  on conflict (id) do update set
    label = excluded.label,
    sort_order = excluded.sort_order,
    verification_status = excluded.verification_status,
    source_ref = excluded.source_ref,
    source_metadata = excluded.source_metadata,
    curriculum_import_id = excluded.curriculum_import_id;

  insert into public.curriculum_source_exceptions (
    id,
    grade_id,
    subject_id,
    status,
    details,
    curriculum_import_id
  )
  select id, grade_id, subject_id, status, details, v_import_id
  from tmp_curriculum_source_exceptions
  on conflict (grade_id, subject_id) do update set
    id = excluded.id,
    status = excluded.status,
    details = excluded.details,
    curriculum_import_id = excluded.curriculum_import_id,
    updated_at = now();

  v_summary := jsonb_build_object(
    'repeat_run', false,
    'dataset_hash', v_dataset_hash,
    'official_contexts', (select count(*) from tmp_curriculum_contexts),
    'active_strands_and_topics', (select count(*) from tmp_curriculum_strands),
    'sub_strands_and_sub_topics', (select count(*) from tmp_curriculum_sub_strands),
    'strand_objectives', (select count(*) from tmp_curriculum_strand_objectives),
    'learning_outcomes_imported', 0,
    'source_exceptions', (select count(*) from tmp_curriculum_source_exceptions),
    'legacy_strands_retained_inactive', v_legacy_strands,
    'legacy_sub_strands_retained', v_legacy_sub_strands,
    'legacy_learning_outcomes_retained', v_legacy_outcomes,
    'historical_exam_topic_references_preserved', v_historical_topic_references
  );

  update public.curriculum_imports
  set status = 'complete', summary = v_summary, completed_at = now()
  where id = v_import_id;

  return v_summary || jsonb_build_object('import_id', v_import_id);
end;
$$;

revoke all on function public.import_verified_curriculum(jsonb) from public;
revoke all on function public.import_verified_curriculum(jsonb) from anon;
revoke all on function public.import_verified_curriculum(jsonb) from authenticated;
grant execute on function public.import_verified_curriculum(jsonb) to service_role;
