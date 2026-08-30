import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";
import { assertSafeLocalDatabaseUrl } from "./migrate-local-postgres.mjs";

const { Client } = pg;

export function normalizeBootstrapEmail(value) {
  const email = value?.trim().toLowerCase() ?? "";
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Provide one valid existing Better Auth email with --email=<address>.");
  }
  return email;
}

export function bootstrapDatabaseUrl(environment = process.env) {
  const application = assertSafeLocalDatabaseUrl(environment.DATABASE_URL, environment);
  const operator = assertSafeLocalDatabaseUrl(
    environment.LOCAL_DATABASE_ADMIN_URL || environment.DATABASE_URL,
    environment,
  );
  if (application.database !== operator.database) {
    throw new Error("DATABASE_URL and LOCAL_DATABASE_ADMIN_URL must target the same local database.");
  }
  return operator.url.href;
}

function emailArgument(argv) {
  const item = argv.find((value) => value.startsWith("--email="));
  if (!item || argv.some((value) => value.startsWith("--password"))) {
    throw new Error("Usage: npm run local:bootstrap-admin -- --email=<existing-local-account>");
  }
  return normalizeBootstrapEmail(item.slice("--email=".length));
}

export async function bootstrapLocalAdmin(email, environment = process.env) {
  const normalizedEmail = normalizeBootstrapEmail(email);
  const operatorUrl = bootstrapDatabaseUrl(environment);
  const client = new Client({
    connectionString: operatorUrl,
    connectionTimeoutMillis: 5_000,
    query_timeout: 15_000,
    statement_timeout: 15_000,
    application_name: "exam-generator-local-admin-bootstrap",
  });
  await client.connect();
  try {
    await client.query("begin");
    const user = (await client.query(
      `select id::text, name
         from better_auth.users
        where lower(email) = $1
        limit 1`,
      [normalizedEmail],
    )).rows[0];
    if (!user) throw new Error("No Better Auth account exists for that email. Sign up locally first.");

    const anchors = (await client.query(
      `select source.relname as source_table,
              target_ns.nspname || '.' || target.relname as target
         from pg_constraint c
         join pg_class source on source.oid = c.conrelid
         join pg_namespace source_ns on source_ns.oid = source.relnamespace
         join pg_class target on target.oid = c.confrelid
         join pg_namespace target_ns on target_ns.oid = target.relnamespace
        where c.contype = 'f'
          and source_ns.nspname = 'public'
          and ((source.relname = 'teachers' and c.conname = 'teachers_user_id_fkey')
            or (source.relname = 'admins' and c.conname = 'admins_user_id_fkey'))
        order by source.relname`,
    )).rows;
    if (anchors.length !== 2 || new Set(anchors.map((row) => row.target)).size !== 1) {
      throw new Error("Teacher/admin identity schema is incomplete or mid-cutover.");
    }
    const anchor = anchors[0].target;
    if (anchor !== "auth.users" && anchor !== "better_auth.users") {
      throw new Error("Teacher/admin identity schema uses an unsupported anchor.");
    }
    if (anchor === "auth.users") {
      const mirrored = await client.query("select 1 from auth.users where id = $1::uuid", [user.id]);
      if (!mirrored.rowCount) throw new Error("The Better Auth account has no application identity mirror.");
    }

    const usage = (await client.query(
      `select
         exists(select 1 from public.exams where teacher_id = t.id) as has_exams,
         exists(select 1 from public.payments where teacher_id = t.id) as has_payments,
         exists(select 1 from public.ai_operation_reservations where teacher_id = t.id) as has_ai_operations
       from public.teachers t
       where t.user_id = $1::uuid`,
      [user.id],
    )).rows[0];
    if (usage?.has_exams || usage?.has_payments || usage?.has_ai_operations) {
      throw new Error("Refusing to promote an account that already owns teacher data.");
    }

    await client.query(
      `insert into public.admins (user_id, name)
       values ($1::uuid, $2)
       on conflict (user_id) do nothing`,
      [user.id, user.name],
    );
    await client.query("delete from public.teachers where user_id = $1::uuid", [user.id]);
    await client.query("commit");
    return { status: "admin-ready", teacherProfileRemoved: true };
  } catch (error) {
    try { await client.query("rollback"); } catch { /* preserve the bootstrap error */ }
    throw error;
  } finally {
    await client.end();
  }
}

async function main() {
  const email = emailArgument(process.argv.slice(2));
  const result = await bootstrapLocalAdmin(email);
  console.log(JSON.stringify(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Local admin bootstrap failed.");
    process.exitCode = 1;
  });
}
