import { spawnSync } from "node:child_process";
import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";

const root = process.cwd();
const pdfTest = "lib/exam-document/pdf.test.tsx";
const testPattern = /\.test\.(?:mjs|ts|tsx)$/;

async function collectTests(directory, files = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === ".next" || entry.name === "node_modules") continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await collectTests(absolute, files);
    else {
      const relative = path.relative(root, absolute).replaceAll(path.sep, "/");
      if (testPattern.test(relative) && !relative.includes(".integration.test.")) files.push(relative);
    }
  }
  return files;
}

function runNode(args, label) {
  const environment = { ...process.env };
  delete environment.NODE_OPTIONS;
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env: environment,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status ?? "unknown"}.`);
}

const tests = (await collectTests(root)).sort();
const serverConditionTests = tests.filter((file) => file !== pdfTest);
runNode([
  "--conditions=react-server",
  "--import",
  "tsx",
  "--test",
  "--test-concurrency=1",
  ...serverConditionTests,
], "Non-integration test suite");

// React DOM's server renderer is intentionally unavailable under the global
// react-server condition. Bundle this TSX test as ESM so React-PDF and
// react-dom/server resolve their normal Node server exports on every platform.
const generatedDirectory = path.join(root, ".next", "test");
const generatedPdfTest = path.join(generatedDirectory, "pdf.test.mjs");
await mkdir(generatedDirectory, { recursive: true });
try {
  await build({
    absWorkingDir: root,
    bundle: true,
    entryPoints: [pdfTest],
    format: "esm",
    logLevel: "warning",
    outfile: generatedPdfTest,
    packages: "external",
    platform: "node",
    tsconfig: path.join(root, "tsconfig.json"),
  });
  runNode(["--test", "--test-concurrency=1", generatedPdfTest], "PDF renderer test suite");
} finally {
  await rm(generatedPdfTest, { force: true });
}
