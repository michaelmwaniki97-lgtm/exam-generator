/** Development-only near-copy check. The reference corpus stays outside runtime.
 * Usage: node scripts/check-reference-originality.mjs <reference-directory> <generated-exam.json> */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const [referenceRoot, generatedFile] = process.argv.slice(2);
if (!referenceRoot || !generatedFile) throw new Error("Usage: check-reference-originality <reference-directory> <generated-exam.json>");
const candidates = [];
async function walk(directory) { for (const entry of await readdir(directory, { withFileTypes: true })) { const name = path.join(directory, entry.name); if (entry.isDirectory()) await walk(name); else if (path.extname(entry.name).toLowerCase() === ".pdf") candidates.push(name); } }
const words = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(word => word.length > 2);
const shingles = (text) => { const value = words(text); return new Set(Array.from({ length: Math.max(0, value.length - 6) }, (_, index) => value.slice(index, index + 7).join(" "))); };
const generated = JSON.parse(await readFile(generatedFile, "utf8"));
const questions = (generated.sections ?? []).flatMap(section => section.questions ?? []).map(question => ({ slotId: question.slotId ?? String(question.number), shingles: shingles(question.text ?? "") })).filter(question => question.shingles.size);
await walk(referenceRoot);
const referenceShingles = new Set();
for (const file of candidates) {
  const pdf = await getDocument({ data: new Uint8Array(await readFile(file)), disableWorker: true, standardFontDataUrl: `${process.cwd()}/node_modules/pdfjs-dist/standard_fonts/` }).promise;
  let text = "";
  for (let page = 1; page <= pdf.numPages; page++) text += " " + (await (await pdf.getPage(page)).getTextContent()).items.map(item => "str" in item ? item.str : "").join(" ");
  for (const shingle of shingles(text)) referenceShingles.add(shingle);
}
const flagged = questions.filter(question => [...question.shingles].filter(shingle => referenceShingles.has(shingle)).length / question.shingles.size >= 0.3).map(question => question.slotId);
console.log(JSON.stringify({ referenceFilesScanned: candidates.length, generatedQuestionsScanned: questions.length, suspiciousQuestionSlotIds: flagged, threshold: "30% of seven-word shingles" }, null, 2));
process.exitCode = flagged.length ? 2 : 0;
