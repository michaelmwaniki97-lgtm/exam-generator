import pg from "pg";
import { assertSafeLocalDatabaseUrl, migrateLocalDatabase } from "./migrate-local-postgres.mjs";

const { Client } = pg;

export function integrationDatabaseEnvironment(environment = process.env) {
  const configuredApplication = assertSafeLocalDatabaseUrl(environment.DATABASE_URL, environment);
  const applicationUrl = environment.POSTGRES_TEST_DATABASE_URL
    ? new URL(environment.POSTGRES_TEST_DATABASE_URL)
    : new URL(configuredApplication.url);
  if (!environment.POSTGRES_TEST_DATABASE_URL) {
    applicationUrl.pathname = configuredApplication.database.endsWith("_test")
      ? `/${configuredApplication.database}`
      : `/${configuredApplication.database}_test`;
  }
  const application = assertSafeLocalDatabaseUrl(applicationUrl.href, environment);
  if (!application.database.endsWith("_test")) {
    throw new Error("PostgreSQL integrations require a dedicated *_test database.");
  }

  const configuredAdmin = assertSafeLocalDatabaseUrl(
    environment.LOCAL_DATABASE_ADMIN_URL || environment.DATABASE_URL,
    environment,
  );
  const adminUrl = new URL(configuredAdmin.url);
  adminUrl.pathname = `/${application.database}`;

  return {
    ...environment,
    DATABASE_URL: application.url.href,
    LOCAL_DATABASE_ADMIN_URL: adminUrl.href,
  };
}

export async function ensureIntegrationDatabase(environment = process.env) {
  const prepared = integrationDatabaseEnvironment(environment);
  const target = assertSafeLocalDatabaseUrl(prepared.LOCAL_DATABASE_ADMIN_URL, prepared);
  const maintenanceUrl = new URL(target.url);
  maintenanceUrl.pathname = "/postgres";
  const client = new Client({
    connectionString: maintenanceUrl.href,
    connectionTimeoutMillis: 5_000,
    application_name: "exam-generator-local-test-database-bootstrap",
  });
  await client.connect();
  try {
    const identity = (await client.query(
      "select (select rolsuper from pg_roles where rolname = current_user) as is_superuser",
    )).rows[0];
    if (!identity.is_superuser) {
      throw new Error("Creating the disposable integration database requires the local database superuser.");
    }
    const exists = (await client.query(
      "select exists(select 1 from pg_database where datname = $1) as exists",
      [target.database],
    )).rows[0].exists;
    if (!exists) {
      const statement = (await client.query(
        "select format('create database %I', $1::text) as sql",
        [target.database],
      )).rows[0].sql;
      await client.query(statement);
    }
  } finally {
    await client.end();
  }
  return prepared;
}

export async function seedPostgresIntegrationFixtures(environment = process.env) {
  const prepared = integrationDatabaseEnvironment(environment);
  const admin = assertSafeLocalDatabaseUrl(prepared.LOCAL_DATABASE_ADMIN_URL, prepared);
  const client = new Client({
    connectionString: admin.url.href,
    connectionTimeoutMillis: 5_000,
    application_name: "exam-generator-local-integration-fixtures",
  });
  await client.connect();
  try {
    await client.query("begin");
    await client.query(`
      insert into auth.users (id, email, raw_user_meta_data) values
        ('00000000-0000-4000-8000-000000000001', 'teacher-one@example.test', '{"name":"Teacher One"}'),
        ('00000000-0000-4000-8000-000000000002', 'teacher-two@example.test', '{"name":"Teacher Two"}'),
        ('00000000-0000-4000-8000-000000000003', 'teacher-three@example.test', '{"name":"Teacher Three"}'),
        ('00000000-0000-4000-8000-000000000004', 'teacher-four@example.test', '{"name":"Teacher Four"}'),
        ('00000000-0000-4000-8000-000000000006', 'adapter-teacher@example.test', '{"name":"Adapter Teacher"}'),
        ('00000000-0000-4000-8000-000000000005', 'admin@example.test', '{"name":"Parity Admin"}')
      on conflict (id) do update
        set email = excluded.email, raw_user_meta_data = excluded.raw_user_meta_data
    `);
    await client.query(`
      insert into public.teachers (user_id, name)
      select fixture.user_id, fixture.name
        from (values
          ('00000000-0000-4000-8000-000000000001'::uuid, 'Teacher One'),
          ('00000000-0000-4000-8000-000000000002'::uuid, 'Teacher Two'),
          ('00000000-0000-4000-8000-000000000003'::uuid, 'Teacher Three'),
          ('00000000-0000-4000-8000-000000000004'::uuid, 'Teacher Four'),
          ('00000000-0000-4000-8000-000000000006'::uuid, 'Adapter Teacher'),
          ('00000000-0000-4000-8000-000000000005'::uuid, 'Parity Admin')
        ) as fixture(user_id, name)
      on conflict (user_id) do update set name = excluded.name
    `);
    await client.query(`
      insert into public.admins (user_id, name)
      values ('00000000-0000-4000-8000-000000000005', 'Parity Admin')
      on conflict (user_id) do update set name = excluded.name
    `);
    await client.query(`
      insert into public.subjects (id, name)
      values ('10000000-0000-4000-8000-000000000001', 'Parity Synthetic Subject')
      on conflict (id) do update set name = excluded.name
    `);
    await client.query(`
      insert into public.grades (id, name, level)
      values ('10000000-0000-4000-8000-000000000002', 'Parity Synthetic Grade', 'Junior School')
      on conflict (id) do update set name = excluded.name, level = excluded.level
    `);
    await client.query(`
      insert into public.textbooks (id, subject_id, grade_id, name, publisher)
      values (
        '20000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000002',
        'Synthetic Parity Textbook',
        'Synthetic Publisher'
      )
      on conflict (id) do update set
        subject_id = excluded.subject_id,
        grade_id = excluded.grade_id,
        name = excluded.name,
        publisher = excluded.publisher
    `);
    await client.query(`
      insert into public.textbook_documents (
        id, textbook_id, storage_path, original_filename, mime_type, file_size,
        content_sha256, processing_status, processing_error, page_count,
        extracted_character_count, chunk_count, embedding_model,
        embedding_dimension, source_type, authorization_note,
        authorization_acknowledged, uploaded_by, processed_at, updated_at
      ) values (
        '20000000-0000-4000-8000-000000000002',
        '20000000-0000-4000-8000-000000000001',
        'textbooks/20000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000002/synthetic.pdf',
        'synthetic.pdf', 'application/pdf', 128, repeat('a', 64), 'ready', null,
        3, 180, 3, 'synthetic-local', 2048, 'oer',
        'Disposable PostgreSQL integration fixture', true,
        '00000000-0000-4000-8000-000000000005', now(), now()
      )
      on conflict (id) do update set
        textbook_id = excluded.textbook_id,
        storage_path = excluded.storage_path,
        original_filename = excluded.original_filename,
        mime_type = excluded.mime_type,
        file_size = excluded.file_size,
        content_sha256 = excluded.content_sha256,
        processing_status = excluded.processing_status,
        processing_error = excluded.processing_error,
        page_count = excluded.page_count,
        extracted_character_count = excluded.extracted_character_count,
        chunk_count = excluded.chunk_count,
        embedding_model = excluded.embedding_model,
        embedding_dimension = excluded.embedding_dimension,
        source_type = excluded.source_type,
        authorization_note = excluded.authorization_note,
        authorization_acknowledged = excluded.authorization_acknowledged,
        uploaded_by = excluded.uploaded_by,
        processed_at = excluded.processed_at,
        updated_at = excluded.updated_at
    `);
    await client.query(`
      delete from public.textbook_chunks
       where document_id = '20000000-0000-4000-8000-000000000002'
    `);
    await client.query(`
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
    `);
    await client.query("commit");
    const counts = (await client.query(`
      select
        (select count(*)::int from public.teachers where user_id in (
          '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
          '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004',
          '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000006'
        )) as teachers,
        (select count(*)::int from public.admins where user_id = '00000000-0000-4000-8000-000000000005') as admins,
        (select count(*)::int from public.textbook_documents
          where id = '20000000-0000-4000-8000-000000000002'
            and processing_status = 'ready'
            and embedding_dimension = 2048
            and chunk_count = 3) as ready_textbooks,
        (select count(*)::int from public.textbook_chunks
          where document_id = '20000000-0000-4000-8000-000000000002') as textbook_chunks
    `)).rows[0];
    return {
      database: admin.database,
      teachers: counts.teachers,
      admins: counts.admins,
      readyTextbooks: counts.ready_textbooks,
      textbookChunks: counts.textbook_chunks,
    };
  } catch (error) {
    try { await client.query("rollback"); } catch { /* preserve fixture error */ }
    throw error;
  } finally {
    await client.end();
  }
}

export async function clearPostgresIntegrationIdentityFixtures(environment = process.env) {
  const prepared = integrationDatabaseEnvironment(environment);
  const admin = assertSafeLocalDatabaseUrl(prepared.LOCAL_DATABASE_ADMIN_URL, prepared);
  const client = new Client({
    connectionString: admin.url.href,
    connectionTimeoutMillis: 5_000,
    application_name: "exam-generator-local-integration-fixture-reset",
  });
  await client.connect();
  try {
    await client.query("begin");
    await client.query(`
      delete from public.payments
       where teacher_id in (
         select id from public.teachers where user_id in (
           '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
           '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004',
           '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000006'
         )
       )
    `);
    await client.query(`
      delete from public.textbook_chunks
       where document_id = '20000000-0000-4000-8000-000000000002';
      delete from public.textbook_documents
       where id = '20000000-0000-4000-8000-000000000002';
      delete from public.textbooks
       where id = '20000000-0000-4000-8000-000000000001';
    `);
    const result = await client.query(`
      delete from auth.users where id in (
        '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004',
        '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000006'
      )
    `);
    await client.query("commit");
    return { database: admin.database, removed: result.rowCount ?? 0 };
  } catch (error) {
    try { await client.query("rollback"); } catch { /* preserve the cleanup error */ }
    throw error;
  } finally {
    await client.end();
  }
}

export async function preparePostgresIntegrationDatabase(environment = process.env) {
  const prepared = await ensureIntegrationDatabase(environment);
  const migration = await migrateLocalDatabase(prepared);
  const fixtures = await seedPostgresIntegrationFixtures(prepared);
  if (fixtures.teachers !== 6 || fixtures.admins !== 1
    || fixtures.readyTextbooks !== 1 || fixtures.textbookChunks !== 3) {
    throw new Error("PostgreSQL integration fixture verification failed.");
  }
  return { environment: prepared, migration, fixtures };
}
