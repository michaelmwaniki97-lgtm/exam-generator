import assert from "node:assert/strict";
import test from "node:test";
import { updateEnvironmentSource } from "./configure-local-database.mjs";

test("local database environment updates replace known values without exposing duplicates", () => {
  const result = updateEnvironmentSource(
    "DATABASE_URL=old\nAUTH_BACKEND=better-auth\nPOSTGRES_RUNTIME_PASSWORD=old-secret\n",
    {
      DATABASE_URL: "new-runtime-url",
      LOCAL_DATABASE_ADMIN_URL: "new-admin-url",
      POSTGRES_RUNTIME_PASSWORD: "new-runtime-secret",
      POSTGRES_TEST_DATABASE_URL: "new-test-url",
    },
  );
  assert.equal(result.match(/^DATABASE_URL=/gm)?.length, 1);
  assert.equal(result.match(/^POSTGRES_RUNTIME_PASSWORD=/gm)?.length, 1);
  assert.match(result, /^AUTH_BACKEND=better-auth$/m);
  assert.match(result, /^LOCAL_DATABASE_ADMIN_URL=new-admin-url$/m);
  assert.match(result, /^POSTGRES_TEST_DATABASE_URL=new-test-url$/m);
});
