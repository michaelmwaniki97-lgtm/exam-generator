/**
 * Development-only corpus evaluator. It never imports the corpus into the app,
 * writes no extracted question text, and reports only aggregate conventions.
 * Usage: node scripts/evaluate-kenyan-reference-style.mjs <reference-directory>
 */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const root = process.argv[2];
if (!root) throw new Error("Provide the extracted reference directory.");
const files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(absolute);
    else if ([".pdf", ".docx"].includes(path.extname(entry.name).toLowerCase())) files.push(absolute);
  }
}
await walk(root);

const terms = ["answer all questions", "section", "marks", "time", "calculate", "state", "name", "identify", "explain", "describe", "draw", "plot", "working", "diagram", "table", "graph", "composition", "practical"];
const aggregate = Object.fromEntries(terms.map(term => [term, 0]));
const buckets = {};
const fingerprints = new Set();
for (const file of files) {
  const relative = path.relative(root, file).replaceAll(path.sep, "/");
  const ext = path.extname(file).toLowerCase();
  let text = "";
  if (ext === ".pdf") {
    const pdf = await getDocument({ data: new Uint8Array(await readFile(file)), disableWorker: true, standardFontDataUrl: `${process.cwd()}/node_modules/pdfjs-dist/standard_fonts/` }).promise;
    for (let page = 1; page <= Math.min(pdf.numPages, 8); page++) {
      const content = await (await pdf.getPage(page)).getTextContent();
      text += " " + content.items.map(item => "str" in item ? item.str : "").join(" ");
    }
  } else {
    // DOCX text remains in the development-only archive and is represented only by a fingerprint.
    text = (await readFile(file)).subarray(0, 4096).toString("base64");
  }
  const normalized = text.toLowerCase().replace(/\s+/g, " ");
  const bucket = relative.split("/").slice(-5, -3).join("/") || "other";
  buckets[bucket] ??= { files: 0, pagesSampled: 0, terms: Object.fromEntries(terms.map(term => [term, 0])) };
  buckets[bucket].files++;
  if (ext === ".pdf") buckets[bucket].pagesSampled += Math.min(8, text ? 8 : 0);
  for (const term of terms) {
    const present = normalized.includes(term);
    if (present) { aggregate[term]++; buckets[bucket].terms[term]++; }
  }
  fingerprints.add(createHash("sha256").update(normalized).digest("hex"));
}
console.log(JSON.stringify({ files: files.length, uniqueFingerprints: fingerprints.size, aggregateTermPresence: aggregate, buckets }, null, 2));
