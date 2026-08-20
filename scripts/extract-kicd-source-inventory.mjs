import { mkdir, readFile, writeFile } from "node:fs/promises";

const ROOT = new URL("../tmp/kicd-source-inventory/", import.meta.url);
const LANDING_PAGES = [
  {
    key: "lower-primary",
    url: "https://kicd.ac.ke/cbc-materials/lower-primary/",
    scanAllPages: true,
  },
  ...[4, 5, 6, 7, 8, 9].map((grade) => ({
    key: `grade-${grade}`,
    url: `https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-${[
      "zero",
      "one",
      "two",
      "three",
      "four",
      "five",
      "six",
      "seven",
      "eight",
      "nine",
    ][grade]}-designs/`,
    scanAllPages: true,
  })),
];

function unique(values) {
  return [...new Set(values)];
}

function driveLinks(html) {
  return unique(
    [...html.matchAll(/https:\/\/drive\.google\.com\/file\/d\/[^"'\\<]+\/preview/g)].map(
      (match) => match[0],
    ),
  );
}

function decodeViewerUrl(value) {
  return value.replaceAll("\\u003d", "=").replaceAll("\\u0026", "&");
}

function parseAntiXssiJson(value) {
  return JSON.parse(value.startsWith(")]}'") ? value.slice(5) : value);
}

function pageWords(value) {
  return [...value.matchAll(/\],"((?:\\.|[^"\\])*)"\]/g)].map((match) =>
    JSON.parse(`"${match[1]}"`),
  );
}

async function fetchText(url) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "Mozilla/5.0 KICD curriculum verification" },
      });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}: ${url}`);
      }
      return response.text();
    } catch (error) {
      lastError = error;
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    }
  }
  throw lastError;
}

async function mapLimit(values, limit, mapper) {
  const result = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor++;
      result[index] = await mapper(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
  return result;
}

async function inspectDocument(previewUrl, scanAllPages) {
  const previewHtml = await fetchText(previewUrl);
  const title = previewHtml.match(/<title>(.*?)<\/title>/s)?.[1]?.trim() ?? "Untitled";
  const uploadUrl = decodeViewerUrl(
    previewHtml.match(
      /https:\/\/drive\.google\.com\/viewer\/upload\?[^"']+/,
    )?.[0] ?? "",
  );
  if (!uploadUrl) throw new Error(`Viewer manifest URL missing: ${previewUrl}`);

  const manifest = parseAntiXssiJson(await fetchText(uploadUrl));
  const metadata = parseAntiXssiJson(
    await fetchText(new URL(manifest.meta, "https://drive.google.com/viewer/").href),
  );
  const pageCount = metadata.pages;
  const pageIndexes = Array.from(
    { length: scanAllPages ? pageCount : Math.min(pageCount, 30) },
    (_, index) => index,
  );
  const pageBaseUrl = new URL(
    manifest.presspage,
    "https://drive.google.com/viewer/",
  ).href;
  const pages = await mapLimit(pageIndexes, 6, async (pageIndex) => {
    const separator = pageBaseUrl.includes("?") ? "&" : "?";
    const raw = await fetchText(`${pageBaseUrl}${separator}page=${pageIndex}`);
    const text = pageWords(raw.startsWith(")]}'") ? raw.slice(5) : raw).join(" ");
    return { page: pageIndex + 1, text };
  });
  const relevantPages = pages.filter(({ text }) =>
    /SUMMARY OF STRANDS?|STRAND\s+SUB[ -]?STRAND|GRADE\s+[123]|MUHTASARI|MADA\s+MADA\s+NDOGO|VIPINDI|\b\d+\s*\.\s*0\b.*\b\d+\s*\.\s*\d+\b|\b\d+\s*\.\s*\d+(?:\s*\.\s*\d+)?\b.*(?:LESSONS?|SESSIONS?|VIPINDI|LEÇONS?|SÉANCES?)/i.test(
      text,
    ),
  );

  return { previewUrl, title, pageCount, relevantPages };
}

await mkdir(ROOT, { recursive: true });
const requestedDocumentIndex = Number.parseInt(
  process.argv.find((value) => value.startsWith("--document-index="))?.split("=")[1] ?? "",
  10,
);
const requestedKeys = new Set(
  process.argv.slice(2).filter((value) => !value.startsWith("--")),
);
for (const landingPage of LANDING_PAGES) {
  if (requestedKeys.size > 0 && !requestedKeys.has(landingPage.key)) continue;

  const outputFile = new URL(`${landingPage.key}.json`, ROOT);
  const html = await fetchText(landingPage.url);
  const previewUrls = driveLinks(html);
  let documents = [];
  if (Number.isInteger(requestedDocumentIndex)) {
    const existing = JSON.parse(await readFile(outputFile, "utf8"));
    documents = existing.documents;
  }
  for (const [documentIndex, previewUrl] of previewUrls.entries()) {
    if (
      Number.isInteger(requestedDocumentIndex) &&
      documentIndex !== requestedDocumentIndex
    ) {
      continue;
    }
    const document = await inspectDocument(previewUrl, landingPage.scanAllPages);
    documents[documentIndex] = document;
    console.log(`${landingPage.key}: ${documentIndex + 1} ${document.title}`);
  }
  await writeFile(
    outputFile,
    `${JSON.stringify({ ...landingPage, documents }, null, 2)}\n`,
  );
}
