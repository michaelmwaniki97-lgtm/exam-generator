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
    await client.query("commit");
    const counts = (await client.query(`
      select
        (select count(*)::int from public.teachers where user_id in (
          '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
          '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004',
          '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000006'
        )) as teachers,
        (select count(*)::int from public.admins where user_id = '00000000-0000-4000-8000-000000000005') as admins
    `)).rows[0];
    return { database: admin.database, teachers: counts.teachers, admins: counts.admins };
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
    const result = await client.query(`
      delete from auth.users where id in (
        '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004',
        '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000006'
      )
    `);
    return { database: admin.database, removed: result.rowCount ?? 0 };
  } finally {
    await client.end();
  }
}

export async function preparePostgresIntegrationDatabase(environment = process.env) {
  const prepared = await ensureIntegrationDatabase(environment);
  const migration = await migrateLocalDatabase(prepared);
  const fixtures = await seedPostgresIntegrationFixtures(prepared);
  if (fixtures.teachers !== 6 || fixtures.admins !== 1) {
    throw new Error("PostgreSQL integration fixture verification failed.");
  }
  return { environment: prepared, migration, fixtures };
}
