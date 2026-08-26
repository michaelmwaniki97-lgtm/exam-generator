\set ON_ERROR_STOP on
\pset pager off

create schema if not exists parity_test;

create or replace function parity_test.assert_true(condition boolean, message text)
returns void
language plpgsql
set search_path = pg_catalog
as $assertion$
begin
  if condition is distinct from true then
    raise exception 'PARITY ASSERTION FAILED: %', message;
  end if;
end
$assertion$;

create or replace function parity_test.assert_raises(statement text, expected_message text)
returns void
language plpgsql
set search_path = pg_catalog
as $assertion$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_message in sqlerrm) > 0 then
      return;
    end if;
    raise exception 'PARITY ASSERTION FAILED: expected error containing %, got %', expected_message, sqlerrm;
  end;
  raise exception 'PARITY ASSERTION FAILED: expected error containing %, statement succeeded', expected_message;
end
$assertion$;

create or replace function parity_test.make_exam(owner_teacher_id uuid, label text)
returns uuid
language plpgsql
set search_path = pg_catalog
as $fixture$
declare
  created_id uuid;
begin
  insert into public.exams (
    teacher_id, subject_id, grade_id, exam_type, marks, duration,
    difficulty, term, year, content, status
  ) values (
    owner_teacher_id,
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    label, 20, 30, 'medium', 'Term 1', 2026,
    jsonb_build_object('fixture', label), 'generated'
  ) returning id into created_id;
  return created_id;
end
$fixture$;

grant usage on schema parity_test to authenticated;
grant execute on function parity_test.assert_true(boolean, text) to authenticated;

select parity_test.assert_true(
  current_setting('server_version_num')::integer >= 170000
  and current_setting('server_version_num')::integer < 180000,
  'server must run PostgreSQL 17'
);
select parity_test.assert_true(
  (select extversion is not null from pg_extension where extname = 'pgcrypto'),
  'pgcrypto extension must exist'
);
select parity_test.assert_true(
  (select extversion is not null from pg_extension where extname = 'vector'),
  'pgvector extension must exist'
);

do $schema_parity$
declare
  required_table text;
begin
  foreach required_table in array array[
    'teachers', 'admins', 'subjects', 'grades', 'strands', 'sub_strands',
    'learning_outcomes', 'strand_objectives', 'textbooks',
    'textbook_documents', 'textbook_chunks', 'exams', 'marking_schemes',
    'payments', 'app_settings', 'curriculum_imports',
    'curriculum_import_legacy_records', 'curriculum_source_exceptions',
    'ai_operation_reservations'
  ] loop
    perform parity_test.assert_true(
      to_regclass('public.' || required_table) is not null,
      'missing table public.' || required_table
    );
  end loop;
end
$schema_parity$;

do $rpc_signatures$
declare
  signature text;
begin
  foreach signature in array array[
    'public.import_verified_curriculum(jsonb)',
    'public.list_ready_textbooks(uuid,uuid)',
    'public.match_textbook_chunks(uuid,extensions.vector,integer,uuid)',
    'public.update_exam_and_scheme_atomic(uuid,uuid,integer,jsonb,jsonb)',
    'public.claim_ai_generation(uuid,uuid)',
    'public.claim_ai_regeneration(uuid,uuid,text,uuid,integer)',
    'public.persist_generated_exam_and_complete_ai_operation(uuid,uuid,uuid,uuid,uuid,text,integer,integer,text,text,integer,jsonb,jsonb)',
    'public.persist_regenerated_exam_and_complete_ai_operation(uuid,uuid,uuid,uuid,text,integer,jsonb,jsonb)',
    'public.fail_ai_operation(uuid,uuid)',
    'public.begin_payment_attempt(uuid,uuid,text,text,uuid)',
    'public.acquire_payment_query_lease(uuid,uuid)',
    'public.complete_payment_query_lease(uuid,uuid)',
    'public.finalize_verified_payment(uuid,uuid,uuid,text,integer,text,text,text,text,text)'
  ] loop
    perform parity_test.assert_true(to_regprocedure(signature) is not null, 'missing RPC signature ' || signature);
  end loop;
end
$rpc_signatures$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000001', 'teacher-one@example.test', '{"name":"Teacher One"}'),
  ('00000000-0000-4000-8000-000000000002', 'teacher-two@example.test', '{"name":"Teacher Two"}'),
  ('00000000-0000-4000-8000-000000000003', 'teacher-three@example.test', '{"name":"Teacher Three"}'),
  ('00000000-0000-4000-8000-000000000004', 'teacher-four@example.test', '{"name":"Teacher Four"}'),
  ('00000000-0000-4000-8000-000000000005', 'admin@example.test', '{"name":"Parity Admin"}')
on conflict (id) do nothing;

insert into public.admins (user_id, name)
values ('00000000-0000-4000-8000-000000000005', 'Parity Admin')
on conflict (user_id) do nothing;

insert into public.subjects (id, name)
values ('10000000-0000-4000-8000-000000000001', 'Parity Synthetic Subject')
on conflict (id) do nothing;
insert into public.grades (id, name, level)
values ('10000000-0000-4000-8000-000000000002', 'Parity Synthetic Grade', 'Junior School')
on conflict (id) do nothing;

-- Temporary auth compatibility and RLS behavior.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
select parity_test.assert_true(auth.uid() = '00000000-0000-4000-8000-000000000001'::uuid, 'auth.uid compatibility');
select parity_test.assert_true(public.current_teacher_id() = (select id from public.teachers where user_id = auth.uid()), 'current_teacher_id compatibility');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000005', false);
select parity_test.assert_true(public.is_admin(), 'is_admin compatibility');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
select parity_test.assert_true(
  (select count(*) = 1 from public.teachers),
  'authenticated teacher RLS must expose only the current teacher'
);
reset role;

-- Curriculum import RPC is executable directly and retains its service-role guard.
select set_config('request.jwt.claim.role', 'authenticated', false);
select parity_test.assert_raises(
  $$select public.import_verified_curriculum('{"schema_version":1}'::jsonb)$$,
  'service_role is required'
);
select set_config('request.jwt.claim.role', 'service_role', false);
select parity_test.assert_raises(
  $$select public.import_verified_curriculum('{"schema_version":0}'::jsonb)$$,
  'Unsupported curriculum import payload schema version'
);

-- Private textbook and 2048-dimensional pgvector fixtures.
insert into public.textbooks (id, subject_id, grade_id, name, publisher)
values (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  'Synthetic Parity Textbook', 'Synthetic Publisher'
);

insert into public.textbook_documents (
  id, textbook_id, storage_path, original_filename, mime_type, file_size,
  content_sha256, processing_status, page_count, extracted_character_count,
  chunk_count, embedding_model, embedding_dimension, source_type,
  authorization_acknowledged, uploaded_by, processed_at
) values (
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000001',
  'textbooks/20000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000002/synthetic.pdf',
  'synthetic.pdf', 'application/pdf', 128,
  repeat('a', 64), 'ready', 3, 180, 3, 'synthetic-local', 2048,
  'oer', true, '00000000-0000-4000-8000-000000000005', now()
);

do $vector_fixtures$
declare
  first_vector real[] := array_fill(0::real, array[2048]);
  second_vector real[] := array_fill(0::real, array[2048]);
  opposite_vector real[] := array_fill(0::real, array[2048]);
begin
  first_vector[1] := 1;
  second_vector[2] := 1;
  opposite_vector[1] := -1;

  insert into public.textbook_chunks (
    id, document_id, textbook_id, chunk_index, page_start, page_end,
    text, character_count, embedding
  ) values
    ('20000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 0, 1, 1,
     repeat('nearest synthetic vector content ', 2), char_length(repeat('nearest synthetic vector content ', 2)), ('[' || array_to_string(first_vector, ',') || ']')::extensions.vector),
    ('20000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 1, 2, 2,
     repeat('orthogonal synthetic vector content ', 2), char_length(repeat('orthogonal synthetic vector content ', 2)), ('[' || array_to_string(second_vector, ',') || ']')::extensions.vector),
    ('20000000-0000-4000-8000-000000000013', '20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 2, 3, 3,
     repeat('opposite synthetic vector content ', 2), char_length(repeat('opposite synthetic vector content ', 2)), ('[' || array_to_string(opposite_vector, ',') || ']')::extensions.vector);
end
$vector_fixtures$;

create table parity_test.vector_index_probe (
  id integer primary key,
  embedding extensions.vector(3) not null
);
insert into parity_test.vector_index_probe values (1, '[1,0,0]'), (2, '[0,1,0]');
create index parity_test_vector_index_probe_hnsw
  on parity_test.vector_index_probe using hnsw (embedding extensions.vector_cosine_ops);

select set_config('request.jwt.claim.role', 'authenticated', false);
select parity_test.assert_true(
  (select count(*) = 1 from public.list_ready_textbooks(
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002'
  )),
  'list_ready_textbooks direct SQL result'
);

select set_config('request.jwt.claim.role', 'service_role', false);
do $vector_search$
declare
  query_vector real[] := array_fill(0::real, array[2048]);
  ordered_ids uuid[];
begin
  query_vector[1] := 1;
  select array_agg(chunk_id order by relevance_score desc, chunk_id)
    into ordered_ids
  from public.match_textbook_chunks(
    '20000000-0000-4000-8000-000000000001',
    ('[' || array_to_string(query_vector, ',') || ']')::extensions.vector,
    3,
    '20000000-0000-4000-8000-000000000002'
  );
  perform parity_test.assert_true(
    ordered_ids = array[
      '20000000-0000-4000-8000-000000000011'::uuid,
      '20000000-0000-4000-8000-000000000012'::uuid,
      '20000000-0000-4000-8000-000000000013'::uuid
    ],
    'deterministic cosine similarity order for 2048-dimensional vectors'
  );
end
$vector_search$;

-- AI generation/regeneration reservations and atomic persistence.
do $ai_security_b1$
declare
  teacher_one uuid := (select id from public.teachers where user_id = '00000000-0000-4000-8000-000000000001');
  teacher_two uuid := (select id from public.teachers where user_id = '00000000-0000-4000-8000-000000000002');
  generation record;
  replay record;
  generated_exam uuid;
  regeneration record;
  new_revision integer;
  quota_exam uuid;
begin
  select * into generation from public.claim_ai_generation(teacher_one, '30000000-0000-4000-8000-000000000001');
  perform parity_test.assert_true(generation.outcome = 'acquired', 'generation reservation acquired');
  select * into replay from public.claim_ai_generation(teacher_one, '30000000-0000-4000-8000-000000000001');
  perform parity_test.assert_true(replay.outcome = 'duplicate_active' and replay.reservation_id = generation.reservation_id, 'generation idempotency replay');
  select * into replay from public.claim_ai_generation(teacher_one, '30000000-0000-4000-8000-000000000002');
  perform parity_test.assert_true(replay.outcome = 'busy', 'one active generation per teacher');

  update public.ai_operation_reservations set lease_expires_at = now() - interval '1 second'
  where id = generation.reservation_id;
  select * into generation from public.claim_ai_generation(teacher_one, '30000000-0000-4000-8000-000000000003');
  perform parity_test.assert_true(generation.outcome = 'acquired', 'expired generation lease is reclaimed');

  generated_exam := public.persist_generated_exam_and_complete_ai_operation(
    teacher_one, generation.reservation_id, '30000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
    'Parity Generated', 20, 30, 'medium', 'Term 1', 2026,
    '{"exam":"atomic"}'::jsonb, '{"scheme":"atomic"}'::jsonb
  );
  perform parity_test.assert_true(
    (select count(*) = 1 from public.exams e join public.marking_schemes m on m.exam_id = e.id where e.id = generated_exam),
    'atomic exam and marking-scheme persistence'
  );

  select * into regeneration from public.claim_ai_regeneration(
    teacher_one, generated_exam, 'slot-1', '30000000-0000-4000-8000-000000000004', 1
  );
  perform parity_test.assert_true(regeneration.outcome = 'acquired', 'regeneration reservation acquired');
  select * into replay from public.claim_ai_regeneration(
    teacher_one, generated_exam, 'slot-2', '30000000-0000-4000-8000-000000000005', 1
  );
  perform parity_test.assert_true(replay.outcome = 'busy', 'concurrent regeneration protection');
  new_revision := public.persist_regenerated_exam_and_complete_ai_operation(
    teacher_one, regeneration.reservation_id, '30000000-0000-4000-8000-000000000004',
    generated_exam, 'slot-1', 1, '{"exam":"regenerated"}'::jsonb, '{"scheme":"regenerated"}'::jsonb
  );
  perform parity_test.assert_true(new_revision = 2, 'atomic regeneration increments revision');
  select * into replay from public.claim_ai_regeneration(
    teacher_one, generated_exam, 'slot-3', '30000000-0000-4000-8000-000000000006', 1
  );
  perform parity_test.assert_true(replay.outcome = 'stale', 'stale regeneration revision rejected');

  select * into regeneration from public.claim_ai_regeneration(
    teacher_one, generated_exam, 'slot-fail', '30000000-0000-4000-8000-000000000007', 2
  );
  perform parity_test.assert_true(public.fail_ai_operation(teacher_one, regeneration.reservation_id), 'active AI operation can fail');
  perform parity_test.assert_true(not public.fail_ai_operation(teacher_one, regeneration.reservation_id), 'AI failure is idempotent');

  perform parity_test.assert_true(
    public.update_exam_and_scheme_atomic(generated_exam, teacher_one, 2, '{"exam":"edited"}'::jsonb, '{"scheme":"edited"}'::jsonb) = 3,
    'exam editor atomic update'
  );
  perform parity_test.assert_raises(
    format('select public.update_exam_and_scheme_atomic(%L::uuid,%L::uuid,2,%L::jsonb,%L::jsonb)', generated_exam, teacher_one, '{}', '{}'),
    'stale_exam_revision'
  );

  insert into public.ai_operation_reservations (
    teacher_id, operation_type, request_key, status, lease_expires_at, created_at, completed_at
  ) select teacher_two, 'generation', gen_random_uuid(), 'failed', now(), now() - interval '10 minutes', now()
  from generate_series(1, 10);
  select * into replay from public.claim_ai_generation(teacher_two, '30000000-0000-4000-8000-000000000008');
  perform parity_test.assert_true(replay.outcome = 'quota_exceeded', 'generation daily quota');

  quota_exam := parity_test.make_exam(teacher_two, 'Regeneration quota fixture');
  insert into public.ai_operation_reservations (
    teacher_id, operation_type, request_key, target_exam_id, target_slot_id,
    status, lease_expires_at, created_at, completed_at
  ) select teacher_two, 'regeneration', gen_random_uuid(), quota_exam, 'quota-' || value,
    'failed', now(), now() - interval '10 minutes', now()
  from generate_series(1, 50) value;
  select * into replay from public.claim_ai_regeneration(
    teacher_two, quota_exam, 'quota-new', '30000000-0000-4000-8000-000000000009', 1
  );
  perform parity_test.assert_true(replay.outcome = 'quota_exceeded', 'regeneration daily quota');
end
$ai_security_b1$;

-- Payment initiation controls, reconciliation lease/backoff, and trusted finalization.
do $payment_security_b1$
declare
  teacher_one uuid := (select id from public.teachers where user_id = '00000000-0000-4000-8000-000000000001');
  teacher_two uuid := (select id from public.teachers where user_id = '00000000-0000-4000-8000-000000000002');
  teacher_three uuid := (select id from public.teachers where user_id = '00000000-0000-4000-8000-000000000003');
  teacher_four uuid := (select id from public.teachers where user_id = '00000000-0000-4000-8000-000000000004');
  exam_primary uuid;
  exam_other uuid;
  payment_primary public.payments;
  payment_replay public.payments;
  lease_token uuid := '40000000-0000-4000-8000-000000000099';
  target_exam uuid;
  target_payment uuid;
  index_value integer;
begin
  exam_primary := parity_test.make_exam(teacher_three, 'Payment primary');
  payment_primary := public.begin_payment_attempt(exam_primary, teacher_three, '254711000001', 'daraja', '40000000-0000-4000-8000-000000000001');
  payment_replay := public.begin_payment_attempt(exam_primary, teacher_three, '254711000001', 'daraja', '40000000-0000-4000-8000-000000000002');
  perform parity_test.assert_true(payment_replay.id = payment_primary.id, 'duplicate active payment is reused before quotas');

  exam_other := parity_test.make_exam(teacher_three, 'Teacher cooldown');
  perform parity_test.assert_raises(
    format('select public.begin_payment_attempt(%L::uuid,%L::uuid,%L,%L,%L::uuid)', exam_other, teacher_three, '254711000002', 'daraja', '40000000-0000-4000-8000-000000000003'),
    'payment teacher cooldown'
  );

  target_exam := parity_test.make_exam(teacher_four, 'Exam cooldown');
  insert into public.payments (exam_id, teacher_id, amount, provider, currency, phone, status, verification_status, idempotency_key, created_at)
  values (target_exam, teacher_one, 100, 'daraja', 'KES', '254711000003', 'failed', 'rejected', gen_random_uuid(), now());
  perform parity_test.assert_raises(
    format('select public.begin_payment_attempt(%L::uuid,%L::uuid,%L,%L,%L::uuid)', target_exam, teacher_four, '254711000004', 'daraja', '40000000-0000-4000-8000-000000000004'),
    'payment exam cooldown'
  );

  target_exam := parity_test.make_exam(teacher_two, 'Phone cooldown');
  insert into public.payments (exam_id, teacher_id, amount, provider, currency, phone, status, verification_status, idempotency_key, created_at)
  values (parity_test.make_exam(teacher_one, 'Phone cooldown history'), teacher_one, 100, 'daraja', 'KES', '254711000005', 'failed', 'rejected', gen_random_uuid(), now());
  perform parity_test.assert_raises(
    format('select public.begin_payment_attempt(%L::uuid,%L::uuid,%L,%L,%L::uuid)', target_exam, teacher_two, '254711000005', 'daraja', '40000000-0000-4000-8000-000000000005'),
    'payment phone cooldown'
  );

  -- Clear prior fixtures from rolling windows before isolated daily-limit tests.
  update public.payments set created_at = now() - interval '2 days' where created_at > now() - interval '1 hour';

  for index_value in 1..10 loop
    insert into public.payments (exam_id, teacher_id, amount, provider, currency, phone, status, verification_status, idempotency_key, created_at)
    values (parity_test.make_exam(teacher_one, 'Teacher daily ' || index_value), teacher_one, 100, 'daraja', 'KES', '254712' || lpad(index_value::text, 6, '0'), 'failed', 'rejected', gen_random_uuid(), now() - interval '10 minutes');
  end loop;
  target_exam := parity_test.make_exam(teacher_one, 'Teacher daily blocked');
  perform parity_test.assert_raises(
    format('select public.begin_payment_attempt(%L::uuid,%L::uuid,%L,%L,%L::uuid)', target_exam, teacher_one, '254712999999', 'daraja', gen_random_uuid()),
    'payment teacher daily limit'
  );

  for index_value in 1..3 loop
    if index_value = 1 then target_exam := parity_test.make_exam(teacher_two, 'Exam daily blocked'); end if;
    insert into public.payments (exam_id, teacher_id, amount, provider, currency, phone, status, verification_status, idempotency_key, created_at)
    values (target_exam, teacher_three, 100, 'daraja', 'KES', '254713' || lpad(index_value::text, 6, '0'), 'failed', 'rejected', gen_random_uuid(), now() - interval '10 minutes');
  end loop;
  perform parity_test.assert_raises(
    format('select public.begin_payment_attempt(%L::uuid,%L::uuid,%L,%L,%L::uuid)', target_exam, teacher_two, '254713999999', 'daraja', gen_random_uuid()),
    'payment exam daily limit'
  );

  for index_value in 1..5 loop
    insert into public.payments (exam_id, teacher_id, amount, provider, currency, phone, status, verification_status, idempotency_key, created_at)
    values (parity_test.make_exam(teacher_three, 'Phone daily ' || index_value), teacher_four, 100, 'daraja', 'KES', '254714000000', 'failed', 'rejected', gen_random_uuid(), now() - interval '10 minutes');
  end loop;
  target_exam := parity_test.make_exam(teacher_two, 'Phone daily blocked');
  perform parity_test.assert_raises(
    format('select public.begin_payment_attempt(%L::uuid,%L::uuid,%L,%L,%L::uuid)', target_exam, teacher_two, '254714000000', 'daraja', gen_random_uuid()),
    'payment phone daily limit'
  );

  -- Isolate a payment for lease/finalization checks.
  update public.payments set created_at = now() - interval '2 days';
  target_exam := parity_test.make_exam(teacher_four, 'Lease and finalization');
  payment_primary := public.begin_payment_attempt(target_exam, teacher_four, '254715000001', 'daraja', '40000000-0000-4000-8000-000000000010');
  update public.payments set status = 'pending', verification_status = 'pending', external_request_id = 'checkout-parity-1', query_next_at = now() - interval '1 second'
  where id = payment_primary.id;
  perform parity_test.assert_true(public.acquire_payment_query_lease(payment_primary.id, lease_token), 'query lease acquired');
  perform parity_test.assert_true(not public.acquire_payment_query_lease(payment_primary.id, gen_random_uuid()), 'concurrent query lease rejected');
  perform parity_test.assert_true(public.complete_payment_query_lease(payment_primary.id, lease_token), 'query lease completed');
  perform parity_test.assert_true(
    (select query_next_at > now() and query_lease_token is null and query_attempt_count = 1 from public.payments where id = payment_primary.id),
    'query backoff and lease cleanup'
  );
  update public.payments set query_attempt_count = 8, query_next_at = now() - interval '1 second' where id = payment_primary.id;
  perform parity_test.assert_true(not public.acquire_payment_query_lease(payment_primary.id, gen_random_uuid()), 'maximum query attempts enforced');

  perform parity_test.assert_true(public.finalize_verified_payment(
    payment_primary.id, target_exam, teacher_four, 'daraja', 100, 'KES',
    'provider-reference-parity-1', 'RECEIPT001', '0', 'verified'
  ), 'trusted payment finalization');
  perform parity_test.assert_true(public.finalize_verified_payment(
    payment_primary.id, target_exam, teacher_four, 'daraja', 100, 'KES',
    'provider-reference-parity-1', 'RECEIPT001', '0', 'verified'
  ), 'idempotent finalization replay');
  perform parity_test.assert_true(not public.finalize_verified_payment(
    payment_primary.id, target_exam, teacher_four, 'daraja', 100, 'KES',
    'different-provider-reference', 'RECEIPT001', '0', 'verified'
  ), 'mismatched replay rejected');
  perform parity_test.assert_true(
    (select status = 'paid' from public.exams where id = target_exam)
    and (select count(*) = 1 from public.payments where exam_id = target_exam and status = 'paid'),
    'one successful payment unlock behavior'
  );

  target_exam := parity_test.make_exam(teacher_two, 'Receipt uniqueness');
  insert into public.payments (exam_id, teacher_id, amount, provider, currency, phone, status, verification_status, idempotency_key)
  values (target_exam, teacher_two, 100, 'daraja', 'KES', '254715000002', 'pending', 'pending', gen_random_uuid())
  returning id into target_payment;
  perform parity_test.assert_true(not public.finalize_verified_payment(
    target_payment, target_exam, teacher_two, 'daraja', 100, 'KES',
    'provider-reference-parity-1', 'RECEIPT002', '0', 'verified'
  ), 'provider reference uniqueness protected');
  perform parity_test.assert_true(not public.finalize_verified_payment(
    target_payment, target_exam, teacher_two, 'daraja', 100, 'KES',
    'provider-reference-parity-2', 'RECEIPT001', '0', 'verified'
  ), 'receipt uniqueness protected');

  perform parity_test.assert_true(not public.finalize_verified_payment(
    target_payment, target_exam, teacher_two, 'daraja', 99, 'KES',
    'provider-reference-parity-2', 'RECEIPT002', '0', 'verified'
  ), 'amount mismatch rejected');
end
$payment_security_b1$;

select current_setting('server_version') as postgres_version;
select extname, extversion from pg_extension where extname in ('pgcrypto', 'vector') order by extname;
select 'PASS: all 13 direct RPC signatures, Security B1, RLS compatibility, and pgvector parity' as result;
