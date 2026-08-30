import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
import { betterAuth } from "better-auth";
import { buildBetterAuthOptions } from "../lib/better-auth/options.ts";
import { provisionBetterAuthApplicationIdentity } from "../lib/better-auth/application-bridge.ts";
import { closeBetterAuthPool } from "../lib/better-auth/pool.ts";
import { closePostgresPool } from "../lib/db/postgres-client.ts";
import { bootstrapDatabaseUrl, bootstrapLocalAdmin } from "./bootstrap-local-admin.mjs";
import { assertSafeLocalDatabaseUrl } from "./migrate-local-postgres.mjs";

const { Pool } = pg;
let activeStage = "startup";

function assertResponse(response, expected, label) {
  if (response.status !== expected) {
    throw new Error(`${label} returned HTTP ${response.status}; expected ${expected}.`);
  }
}

function responseCookies(response) {
  const values = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie")].filter(Boolean);
  const cookie = values.map((value) => value.split(";", 1)[0]).join("; ");
  if (!cookie) throw new Error("Better Auth login did not return a session cookie.");
  return cookie;
}

async function login(origin, email, password) {
  const response = await fetch(`${origin}/api/auth/sign-in/email`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ email, password, rememberMe: true }),
  });
  assertResponse(response, 200, "Better Auth login");
  return responseCookies(response);
}

async function assertAuthenticatedRoutes(origin, cookie, routes, label) {
  for (const route of routes) {
    const response = await fetch(`${origin}${route}`, { redirect: "manual", headers: { cookie } });
    assertResponse(response, 200, `${label} route ${route}`);
  }
}

async function createApplicationUser(auth, input) {
  const signup = await auth.api.signUpEmail({
    body: { name: input.name, email: input.email, password: input.password },
  });
  if (!signup.user?.id || !signup.token) throw new Error("Better Auth signup did not create a persisted credential user.");
  await provisionBetterAuthApplicationIdentity({
    userId: signup.user.id,
    email: input.email,
    name: input.name,
    school: input.school,
    phone: input.phone,
  });
  return signup.user.id;
}

async function main() {
  activeStage = "configuration";
  const { database } = assertSafeLocalDatabaseUrl(process.env.DATABASE_URL, process.env);
  const origin = process.env.BETTER_AUTH_URL?.replace(/\/$/, "");
  if (origin !== "http://localhost:3000") {
    throw new Error("Local auth verification requires BETTER_AUTH_URL=http://localhost:3000.");
  }

  const options = buildBetterAuthOptions();
  const auth = betterAuth({ ...options, plugins: [] });
  const pool = new Pool({ connectionString: bootstrapDatabaseUrl(process.env) });
  const suffix = randomUUID();
  const teacher = {
    name: "Local Verification Teacher",
    email: `local-teacher-${suffix}@example.test`,
    password: randomBytes(32).toString("base64url"),
    school: "Local Verification School",
    phone: "+254700000001",
  };
  const admin = {
    name: "Local Verification Admin",
    email: `local-admin-${suffix}@example.test`,
    password: randomBytes(32).toString("base64url"),
    school: "Local Verification School",
    phone: "+254700000002",
  };
  const userIds = [];

  try {
    activeStage = "teacher-signup";
    const teacherId = await createApplicationUser(auth, teacher);
    userIds.push(teacherId);
    const teacherProfile = await pool.query(
      "select 1 from public.teachers where user_id = $1::uuid",
      [teacherId],
    );
    if (teacherProfile.rowCount !== 1) throw new Error("Teacher signup did not create an application profile.");

    activeStage = "invalid-password";
    const invalid = await fetch(`${origin}/api/auth/sign-in/email`, {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({ email: teacher.email, password: `${teacher.password}-wrong` }),
    });
    if (invalid.status < 400) throw new Error("Invalid password was accepted.");

    activeStage = "teacher-login";
    const teacherCookie = await login(origin, teacher.email, teacher.password);
    activeStage = "teacher-session";
    const session = await fetch(`${origin}/api/auth/get-session`, { headers: { cookie: teacherCookie } });
    assertResponse(session, 200, "Teacher session lookup");
    const sessionBody = await session.json();
    if (sessionBody?.user?.id !== teacherId) throw new Error("Teacher session identity did not persist.");

    activeStage = "teacher-dashboard";
    const teacherDashboard = await fetch(`${origin}/teacher/dashboard`, { redirect: "manual", headers: { cookie: teacherCookie } });
    assertResponse(teacherDashboard, 200, "Authenticated teacher dashboard");
    activeStage = "teacher-routes";
    await assertAuthenticatedRoutes(origin, teacherCookie, [
      "/teacher/profile",
      "/teacher/exams",
      "/teacher/exams/new",
      "/teacher/transactions",
    ], "Teacher");
    activeStage = "teacher-admin-isolation";
    const teacherAdmin = await fetch(`${origin}/admin`, { redirect: "manual", headers: { cookie: teacherCookie } });
    assertResponse(teacherAdmin, 307, "Teacher admin-route isolation");
    if (teacherAdmin.headers.get("location") !== "/teacher/dashboard") {
      throw new Error("Teacher admin-route redirect target is incorrect.");
    }

    activeStage = "teacher-logout";
    const logout = await fetch(`${origin}/api/auth/sign-out`, {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/json", cookie: teacherCookie, origin },
      body: "{}",
    });
    assertResponse(logout, 200, "Teacher logout");
    const afterLogout = await fetch(`${origin}/teacher/dashboard`, { redirect: "manual", headers: { cookie: teacherCookie } });
    assertResponse(afterLogout, 307, "Logged-out teacher protection");
    if (afterLogout.headers.get("location") !== "/login") throw new Error("Logout did not revoke protected-route access.");

    activeStage = "admin-signup";
    const adminId = await createApplicationUser(auth, admin);
    userIds.push(adminId);
    activeStage = "admin-bootstrap";
    await bootstrapLocalAdmin(admin.email);
    const roles = await pool.query(
      `select exists(select 1 from public.admins where user_id = $1::uuid) as is_admin,
              exists(select 1 from public.teachers where user_id = $1::uuid) as is_teacher`,
      [adminId],
    );
    if (roles.rows[0]?.is_admin !== true || roles.rows[0]?.is_teacher !== false) {
      throw new Error("Local admin bootstrap did not produce an isolated admin role.");
    }

    activeStage = "admin-login";
    const adminCookie = await login(origin, admin.email, admin.password);
    activeStage = "admin-dashboard";
    const adminDashboard = await fetch(`${origin}/admin`, { redirect: "manual", headers: { cookie: adminCookie } });
    assertResponse(adminDashboard, 200, "Authenticated admin dashboard");
    activeStage = "admin-routes";
    await assertAuthenticatedRoutes(origin, adminCookie, [
      "/admin/teachers",
      "/admin/subjects",
      "/admin/grades",
      "/admin/curriculum",
      "/admin/textbooks",
      "/admin/settings",
    ], "Admin");
    activeStage = "admin-teacher-isolation";
    const adminTeacher = await fetch(`${origin}/teacher/dashboard`, { redirect: "manual", headers: { cookie: adminCookie } });
    assertResponse(adminTeacher, 307, "Admin teacher-route isolation");
    if (adminTeacher.headers.get("location") !== "/admin") {
      throw new Error("Admin teacher-route redirect target is incorrect.");
    }

    console.log(JSON.stringify({
      database,
      signup: "PASS",
      invalidPassword: "PASS",
      login: "PASS",
      sessionPersistence: "PASS",
      logout: "PASS",
      teacherDashboard: "PASS",
      teacherRoutes: "PASS",
      teacherAdminIsolation: "PASS",
      adminBootstrap: "PASS",
      adminDashboard: "PASS",
      adminRoutes: "PASS",
      adminTeacherIsolation: "PASS",
    }, null, 2));
  } finally {
    for (const userId of userIds) {
      try { await pool.query("delete from public.admins where user_id = $1::uuid", [userId]); } catch { /* disposable cleanup */ }
      try { await pool.query("delete from public.teachers where user_id = $1::uuid", [userId]); } catch { /* disposable cleanup */ }
      try { await pool.query("delete from auth.users where id = $1::uuid", [userId]); } catch { /* disposable cleanup */ }
      try { await pool.query("delete from better_auth.users where id = $1::uuid", [userId]); } catch { /* disposable cleanup */ }
    }
    await pool.end();
    await closePostgresPool();
    await closeBetterAuthPool();
  }
}

main().catch((error) => {
  const detail = error instanceof Error ? (error.message || error.name) : "unknown error";
  console.error(`Local auth verification failed during ${activeStage}: ${detail}`);
  process.exitCode = 1;
});
