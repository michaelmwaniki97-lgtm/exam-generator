-- ============================================================================
-- Checkpoint 2: Database schema + Row Level Security
-- NOT YET APPLIED — for review.
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- TABLES
-- ============================================================================

create table teachers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null,
  school text,
  phone text,
  created_at timestamptz not null default now()
);

create table admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table grades (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  level text not null,
  created_at timestamptz not null default now()
);

create table strands (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects (id) on delete cascade,
  grade_id uuid not null references grades (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table sub_strands (
  id uuid primary key default gen_random_uuid(),
  strand_id uuid not null references strands (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table learning_outcomes (
  id uuid primary key default gen_random_uuid(),
  sub_strand_id uuid not null references sub_strands (id) on delete cascade,
  description text not null,
  created_at timestamptz not null default now()
);

-- Style-reference names only — no copyrighted textbook content is stored here.
create table textbooks (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects (id) on delete cascade,
  grade_id uuid not null references grades (id) on delete cascade,
  name text not null,
  publisher text,
  created_at timestamptz not null default now()
);

create table exams (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers (id) on delete cascade,
  subject_id uuid not null references subjects (id) on delete restrict,
  grade_id uuid not null references grades (id) on delete restrict,
  exam_type text not null,
  marks integer not null,
  duration integer not null,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  content jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'generated', 'paid', 'downloaded')),
  created_at timestamptz not null default now()
);

create table marking_schemes (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references exams (id) on delete cascade,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references exams (id) on delete restrict,
  teacher_id uuid not null references teachers (id) on delete restrict,
  amount numeric(10, 2) not null,
  mpesa_ref text,
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  created_at timestamptz not null default now()
);

create table app_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- INDEXES (foreign key lookups)
-- ============================================================================

create index idx_strands_subject_id on strands (subject_id);
create index idx_strands_grade_id on strands (grade_id);
create index idx_sub_strands_strand_id on sub_strands (strand_id);
create index idx_learning_outcomes_sub_strand_id on learning_outcomes (sub_strand_id);
create index idx_textbooks_subject_id on textbooks (subject_id);
create index idx_textbooks_grade_id on textbooks (grade_id);
create index idx_exams_teacher_id on exams (teacher_id);
create index idx_exams_subject_id on exams (subject_id);
create index idx_exams_grade_id on exams (grade_id);
create index idx_marking_schemes_exam_id on marking_schemes (exam_id);
create index idx_payments_exam_id on payments (exam_id);
create index idx_payments_teacher_id on payments (teacher_id);

-- ============================================================================
-- HELPER FUNCTIONS (SECURITY DEFINER — bypass RLS internally to avoid
-- recursive policy evaluation; owned by the migration-running role, which
-- Supabase grants BYPASSRLS)
-- ============================================================================

create function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.admins where user_id = auth.uid()
  );
$$;

create function public.current_teacher_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.teachers where user_id = auth.uid();
$$;

-- ============================================================================
-- AUTH TRIGGER — creates the teacher profile row on signup
-- (SECURITY DEFINER: bypasses RLS on `teachers`, since there is no
-- client-facing INSERT policy for that table)
-- ============================================================================

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.teachers (user_id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table teachers enable row level security;
alter table admins enable row level security;
alter table subjects enable row level security;
alter table grades enable row level security;
alter table strands enable row level security;
alter table sub_strands enable row level security;
alter table learning_outcomes enable row level security;
alter table textbooks enable row level security;
alter table exams enable row level security;
alter table marking_schemes enable row level security;
alter table payments enable row level security;
alter table app_settings enable row level security;

-- ---- teachers: a teacher can SELECT/UPDATE only their own row -------------

create policy teachers_select_own
  on teachers for select
  to authenticated
  using (user_id = auth.uid());

create policy teachers_update_own
  on teachers for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- No INSERT/DELETE policy: teacher profile rows are created by the
-- handle_new_user trigger above, not self-service via the client.

create policy teachers_admin_select
  on teachers for select
  to authenticated
  using (public.is_admin());

-- ---- exams: teacher SELECT/INSERT own rows only; UPDATE own rows while ----
-- ---- not yet paid (locks the exam at the DB level once status = 'paid') ---

create policy exams_select_own
  on exams for select
  to authenticated
  using (teacher_id = public.current_teacher_id());

create policy exams_insert_own
  on exams for insert
  to authenticated
  with check (teacher_id = public.current_teacher_id());

create policy exams_update_own_unpaid
  on exams for update
  to authenticated
  using (teacher_id = public.current_teacher_id() and status != 'paid')
  with check (teacher_id = public.current_teacher_id() and status != 'paid');

create policy exams_admin_select
  on exams for select
  to authenticated
  using (public.is_admin());

-- ---- marking_schemes: teacher SELECT/INSERT own (via parent exam); --------
-- ---- UPDATE own while the parent exam is not yet paid ---------------------

create policy marking_schemes_select_own
  on marking_schemes for select
  to authenticated
  using (
    exists (
      select 1 from exams e
      where e.id = marking_schemes.exam_id
        and e.teacher_id = public.current_teacher_id()
    )
  );

create policy marking_schemes_insert_own
  on marking_schemes for insert
  to authenticated
  with check (
    exists (
      select 1 from exams e
      where e.id = marking_schemes.exam_id
        and e.teacher_id = public.current_teacher_id()
    )
  );

create policy marking_schemes_update_own_unpaid
  on marking_schemes for update
  to authenticated
  using (
    exists (
      select 1 from exams e
      where e.id = marking_schemes.exam_id
        and e.teacher_id = public.current_teacher_id()
        and e.status != 'paid'
    )
  )
  with check (
    exists (
      select 1 from exams e
      where e.id = marking_schemes.exam_id
        and e.teacher_id = public.current_teacher_id()
        and e.status != 'paid'
    )
  );

-- ---- payments: teacher SELECT own rows only; all writes are service-role --
-- (no insert/update/delete policy is defined for `authenticated`, so those
-- commands are denied by default for regular users; the service role key
-- bypasses RLS entirely, which is how the server-side M-Pesa/Paystack
-- webhook handler will write these rows)

create policy payments_select_own
  on payments for select
  to authenticated
  using (teacher_id = public.current_teacher_id());

create policy payments_admin_select
  on payments for select
  to authenticated
  using (public.is_admin());

-- ---- curriculum tables: SELECT for any authenticated user, ----------------
-- ---- writes for admins only ------------------------------------------------

create policy subjects_select_all
  on subjects for select
  to authenticated
  using (true);

create policy subjects_admin_write
  on subjects for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy grades_select_all
  on grades for select
  to authenticated
  using (true);

create policy grades_admin_write
  on grades for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy strands_select_all
  on strands for select
  to authenticated
  using (true);

create policy strands_admin_write
  on strands for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy sub_strands_select_all
  on sub_strands for select
  to authenticated
  using (true);

create policy sub_strands_admin_write
  on sub_strands for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy learning_outcomes_select_all
  on learning_outcomes for select
  to authenticated
  using (true);

create policy learning_outcomes_admin_write
  on learning_outcomes for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy textbooks_select_all
  on textbooks for select
  to authenticated
  using (true);

create policy textbooks_admin_write
  on textbooks for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---- admins, app_settings: readable/writable by admins only ---------------

create policy admins_admin_only
  on admins for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy app_settings_admin_only
  on app_settings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
