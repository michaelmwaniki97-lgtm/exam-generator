import { mkdir, readFile, writeFile } from "node:fs/promises";

const INVENTORY_ROOT = new URL("../tmp/kicd-source-inventory/", import.meta.url);
const OUTPUT_ROOT = new URL("../curriculum/official/", import.meta.url);
const WRITE = process.argv.includes("--write");
const RETRIEVED_ON = "2026-08-16";

const LOWER_SUBJECTS = [
  "Creative Activities",
  "Christian Religious Education",
  "English Activities",
  "Environmental Activities",
  "Hindu Religious Education",
  "Islamic Religious Education",
  "Kiswahili",
  "Mathematics",
];
const UPPER_PRIMARY_SUBJECTS = [
  "Agriculture",
  "Arabic",
  "Creative Arts",
  "Christian Religious Education",
  "English",
  "French",
  "German",
  "Hindu Religious Education",
  "Indigenous Language",
  "Islamic Religious Education",
  "Kiswahili",
  "Mandarin",
  "Mathematics",
  "Science and Technology",
  "Social Studies",
];
const JUNIOR_SCHOOL_SUBJECTS = [
  "Agriculture",
  "Arabic",
  "Creative Arts",
  "Christian Religious Education",
  "English",
  "French",
  "German",
  "Hindu Religious Education",
  "Indigenous Language",
  "Integrated Science",
  "Islamic Religious Education",
  "Kiswahili",
  "Mandarin",
  "Mathematics",
  "Pre-Technical Studies",
  "Social Studies",
];

function slug(value) {
  return value
    .normalize("NFKD")
    .replace(/[’']/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function cleanCode(value) {
  return value.replace(/\s/g, "");
}

function cleanName(value) {
  return value
    .replace(/^[•:;,\-–—.\s]+/, "")
    .replace(/[•:;,\-–—.\s]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function trimScopeAndLessons(value) {
  return cleanName(
    value
      .replace(
        /\s+(?:By the end|Kufikia mwisho|The learner|Mwanafunzi)[\s\S]*$/i,
        "",
      )
      .replace(
        /\s+\(?\d+\s*(?:lessons?|sessions?|vipindi|leçons?|séances?)[\s\S]*$/i,
        "",
      )
      .replace(/\s+\d+\.\d+(?:\.\d+)+\s+[\s\S]*$/, "")
      .replace(/\s+(?:a\)|Oral questions|Written tests?|Observation)\s+[\s\S]*$/i, "")
      .replace(/\s+•[\s\S]*$/, "")
      .replace(/\s+(?:Traditional|Modern) forms?:[\s\S]*$/i, "")
      .replace(/\s+\d+\s*$/, ""),
  );
}

function numericCodeParts(code) {
  return code.split(".").map((part) => Number.parseInt(part, 10));
}

function compareCodes(left, right) {
  const leftParts = numericCodeParts(left);
  const rightParts = numericCodeParts(right);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function afterTableHeader(text) {
  const markers = [
    /Suggested Key Inquiry Question\s*\(s\)/i,
    /Suggested Key Inquiry Questions?/i,
    /Swali Dadisi Lililopendekezwa/i,
    /Maswali Dadisi Yaliyopendekezwa/i,
    /Question\s*\(s\)/i,
  ];
  let best = -1;
  for (const marker of markers) {
    const match = marker.exec(text);
    if (match) best = Math.max(best, match.index + match[0].length);
  }
  return best >= 0 ? text.slice(best) : text;
}

function extractDetailedPairs(pages) {
  const pairs = [];
  const lessonWord = "(?:lessons?|sessions?|vipindi|leçons?|séances?)";
  const twoLevel = new RegExp(
    "(\\d+\\s*\\.\\s*0)\\s+(.+?)\\s+" +
      "(\\d+\\s*\\.\\s*\\d+(?:\\s*\\.\\s*\\d+)?)\\s+(.+?)" +
      "(?=\\s+(?:\\([^)]*?" + lessonWord + "[^)]*\\)|\\d+\\s+" + lessonWord + "))",
    "gi",
  );
  const threeLevel = new RegExp(
    "(\\d+\\s*\\.\\s*\\d+)\\s+(.+?)\\s+" +
      "(\\d+\\s*\\.\\s*\\d+\\s*\\.\\s*\\d+)\\s+(.+?)" +
      "(?=\\s+(?:\\([^)]*?" + lessonWord + "[^)]*\\)|\\d+\\s+" + lessonWord + "))",
    "gi",
  );

  for (const page of pages) {
    const body = afterTableHeader(page.text);
    for (const match of body.matchAll(twoLevel)) {
      const strandCode = cleanCode(match[1]);
      const strandName = cleanName(match[2]);
      const subCode = cleanCode(match[3]);
      const subName = trimScopeAndLessons(match[4]);
      if (
        strandCode === subCode ||
        subCode.split(".")[0] !== strandCode.split(".")[0] ||
        /Strand|Sub[- ]?Strand|Mada Ndogo/i.test(strandName) ||
        /\d+\.\d+/.test(strandName) ||
        !strandName ||
        !subName
      ) {
        continue;
      }
      pairs.push({ strandCode, strandName, subCode, subName, page: page.page });
    }

    for (const match of body.matchAll(threeLevel)) {
      const strandCode = cleanCode(match[1]);
      const strandName = cleanName(match[2]);
      const subCode = cleanCode(match[3]);
      const subName = trimScopeAndLessons(match[4]);
      if (
        /Strand|Sub[- ]?Strand|Mada Ndogo/i.test(strandName) ||
        /\d+\.\d+/.test(strandName) ||
        !strandName ||
        !subName
      ) {
        continue;
      }
      pairs.push({
        strandCode,
        strandName,
        subCode,
        subName,
        page: page.page,
        themedLayout: true,
      });
    }
  }

  const strandNamesByCode = new Map(
    pairs
      .filter((pair) => !pair.themedLayout)
      .map((pair) => [pair.strandCode, pair.strandName]),
  );
  const knownPairs = new Set(
    pairs.map((pair) => `${pair.strandCode}|${pair.subCode}|${pair.subName}`),
  );
  for (const page of pages) {
    const body = afterTableHeader(page.text);
    const codes = [
      ...body.matchAll(/\b(\d+)\s*\.\s*(\d+)(?:\s*\.\s*(\d+))?\b/g),
    ];
    for (const [codeIndex, codeMatch] of codes.entries()) {
      if (codeMatch[2] === "0" && !codeMatch[3]) continue;
      const subCode = cleanCode(codeMatch[0]);
      const strandCode = `${codeMatch[1]}.0`;
      const strandName = strandNamesByCode.get(strandCode);
      if (!strandName) continue;
      const segmentEnd = codes[codeIndex + 1]?.index ?? body.length;
      const subName = trimScopeAndLessons(
        body.slice(codeMatch.index + codeMatch[0].length, segmentEnd),
      );
      const key = `${strandCode}|${subCode}|${subName}`;
      if (
        !subName ||
        /Specific Learning|Suggested Learning|Strand|Sub[- ]?Strand|Mada Ndogo/i.test(
          subName,
        ) ||
        knownPairs.has(key)
      ) {
        continue;
      }
      pairs.push({
        strandCode,
        strandName,
        subCode,
        subName,
        page: page.page,
      });
      knownPairs.add(key);
    }
  }
  return pairs;
}

function extractNumberedSummaryPairs(pages) {
  const pairs = [];
  for (const page of pages.filter(({ text }) => /SUMMARY OF STRANDS?/i.test(text))) {
    const summaryStart = page.text.search(/SUMMARY OF STRANDS?/i);
    const text = page.text.slice(summaryStart);
    const codes = [...text.matchAll(/\b(\d+)\s*\.\s*(\d+)(?:\s*\.\s*(\d+))?\b/g)];
    let currentStrand;
    for (let index = 0; index < codes.length; index += 1) {
      const codeMatch = codes[index];
      const code = cleanCode(codeMatch[0]);
      const segmentEnd = codes[index + 1]?.index ?? text.length;
      const rawName = text.slice(codeMatch.index + codeMatch[0].length, segmentEnd);
      const name = trimScopeAndLessons(rawName.split(/\bTotal(?: Number)?\b/i)[0]);
      const isStrand = codeMatch[2] === "0" && !codeMatch[3];
      if (isStrand) {
        if (name && !/Suggested|Number of|Lessons|S\/N/i.test(name)) {
          currentStrand = { code, name };
        }
        continue;
      }
      if (!currentStrand || !name || /Suggested|Number of Lessons/i.test(name)) continue;
      pairs.push({
        strandCode: currentStrand.code,
        strandName: currentStrand.name,
        subCode: code,
        subName: name,
        page: page.page,
        summary: true,
      });
    }
  }
  return pairs;
}

function preferredPairs(pages, subject) {
  const detailed = extractDetailedPairs(pages);
  const themedSubjects = new Set([
    "English",
    "English Activities",
    "Indigenous Language",
    "Kiswahili",
  ]);
  const themed = detailed.filter((pair) => pair.themedLayout);
  if (themedSubjects.has(subject) && themed.length > 0) return themed;
  const selectedDetailed = detailed.filter((pair) => !pair.themedLayout);
  const summary = extractNumberedSummaryPairs(pages);
  const detailedByCode = new Map(
    selectedDetailed.map((pair) => [pair.subCode, pair]),
  );
  const merged = [...selectedDetailed];
  for (const pair of summary) {
    if (!detailedByCode.has(pair.subCode)) merged.push(pair);
  }
  return merged;
}

function hierarchyFromPairs(pairs) {
  const strandsByKey = new Map();
  for (const pair of pairs) {
    const themed = pair.themedLayout;
    const strandKey = themed
      ? `themed:${pair.strandCode.split(".").at(-1)}`
      : pair.strandCode;
    let strand = strandsByKey.get(strandKey);
    if (!strand) {
      strand = {
        code: pair.strandCode,
        name: pair.strandName,
        occurrenceCodes: new Set(),
        sourcePages: new Set(),
        subStrands: new Map(),
      };
      strandsByKey.set(strandKey, strand);
    }
    strand.occurrenceCodes.add(pair.strandCode);
    strand.sourcePages.add(pair.page);
    const existingSubStrand = strand.subStrands.get(pair.subCode);
    if (!existingSubStrand) {
      strand.subStrands.set(pair.subCode, {
        code: pair.subCode,
        name: pair.subName,
        sourcePage: pair.page,
        alternativeNames: new Set(),
      });
    } else if (
      pair.subName.toLocaleLowerCase("en-KE") !==
      existingSubStrand.name.toLocaleLowerCase("en-KE")
    ) {
      existingSubStrand.alternativeNames.add(pair.subName);
      if (
        pair.subName.length > existingSubStrand.name.length &&
        pair.subName.length < 120
      ) {
        existingSubStrand.alternativeNames.add(existingSubStrand.name);
        existingSubStrand.name = pair.subName;
        existingSubStrand.sourcePage = pair.page;
      }
    }
  }

  return [...strandsByKey.values()]
    .sort((left, right) => compareCodes(left.code, right.code))
    .map((strand, strandIndex) => ({
      order: strandIndex + 1,
      code: strand.code,
      name: strand.name,
      ...(strand.occurrenceCodes.size > 1
        ? { occurrenceCodes: [...strand.occurrenceCodes].sort(compareCodes) }
        : {}),
      sourcePages: [...strand.sourcePages].sort((left, right) => left - right),
      subStrands: [...strand.subStrands.values()]
        .sort((left, right) => compareCodes(left.code, right.code))
        .map((subStrand, subIndex) => ({
          order: subIndex + 1,
          code: subStrand.code,
          name: subStrand.name,
          ...(subStrand.alternativeNames.size > 0
            ? {
                alternativeNames: [...subStrand.alternativeNames]
                  .filter((name) => name !== subStrand.name)
                  .sort((left, right) => left.localeCompare(right, "en-KE")),
              }
            : {}),
          sourcePage: subStrand.sourcePage,
        })),
    }));
}

function lowerRanges(document, documentIndex) {
  const summaryPages = document.relevantPages
    .filter(({ text }) => /SUMMARY OF STRANDS?/i.test(text))
    .map(({ page }) => page)
    .filter((page, index, values) => values.indexOf(page) === index);
  let anchors = summaryPages.slice(0, 3);
  if (anchors.length < 3) {
    anchors = [];
    for (const page of document.relevantPages) {
      const prefix = page.text.slice(0, 180);
      if (!/\b1\s*\.\s*0\b/.test(prefix) || !/\b1\s*\.\s*1\b/.test(page.text)) {
        continue;
      }
      if (anchors.length === 0 || page.page - anchors.at(-1) > 35) anchors.push(page.page);
      if (anchors.length === 3) break;
    }
  }
  if (anchors.length !== 3) {
    throw new Error(`Could not determine Grade 1-3 ranges for ${document.title}`);
  }
  const finalEnd = documentIndex === 0 ? summaryPages[3] ?? document.pageCount + 1 : document.pageCount + 1;
  return anchors.map((start, index) => ({
    start,
    end: anchors[index + 1] ?? finalEnd,
  }));
}

function sourceVersion(title) {
  const match = title.match(/(?:July|April|August|September|October|Oct|Sept)\s+2024/i);
  return match?.[0] ?? (title.match(/Revised(?:\s+(?:Oct|Sept))?/i)?.[0] ?? "Published KICD design");
}

function buildCandidate({ grade, subject, document, landingPage, pages }) {
  const strands = hierarchyFromPairs(preferredPairs(pages, subject));
  return {
    schemaVersion: 1,
    educationSystem: "CBC",
    grade,
    subject,
    verificationStatus: "hierarchy_verified_not_imported",
    applicationStatus: "provisional_seed_preserved",
    outcomeStatus: "source_required",
    source: {
      authority: "Kenya Institute of Curriculum Development (KICD)",
      title: document.title.replace(/ - Google Drive$/, ""),
      version: sourceVersion(document.title),
      officialLandingPage: landingPage,
      officialDocument: document.previewUrl,
      retrievedOn: RETRIEVED_ON,
      hierarchyPages: [...new Set(strands.flatMap((strand) => strand.sourcePages))].sort(
        (left, right) => left - right,
      ),
    },
    notes: [
      "Hierarchy was mechanically transcribed from the official KICD summary and detailed table headings, with source page numbers retained for review.",
      "Specific Learning Outcomes are intentionally omitted until a separate exact-outcome transcription pass.",
      "Existing application curriculum data is preserved; this candidate is not active database content.",
    ],
    strands,
  };
}

async function readInventory(key) {
  return JSON.parse(await readFile(new URL(`${key}.json`, INVENTORY_ROOT), "utf8"));
}

async function saveCandidate(candidate) {
  const directory = new URL(`${slug(candidate.grade)}/`, OUTPUT_ROOT);
  await mkdir(directory, { recursive: true });
  await writeFile(
    new URL(`${slug(candidate.subject)}.json`, directory),
    `${JSON.stringify(candidate, null, 2)}\n`,
  );
}

const candidates = [];
const lower = await readInventory("lower-primary");
for (const [documentIndex, document] of lower.documents.entries()) {
  const ranges = lowerRanges(document, documentIndex);
  for (const [gradeIndex, range] of ranges.entries()) {
    candidates.push(
      buildCandidate({
        grade: `Grade ${gradeIndex + 1}`,
        subject: LOWER_SUBJECTS[documentIndex],
        document,
        landingPage: lower.url,
        pages: document.relevantPages.filter(
          ({ page }) => page >= range.start && page < range.end,
        ),
      }),
    );
  }
}

for (const grade of [4, 5, 6, 7, 8, 9]) {
  const inventory = await readInventory(`grade-${grade}`);
  const subjects = grade <= 6 ? UPPER_PRIMARY_SUBJECTS : JUNIOR_SCHOOL_SUBJECTS;
  for (const [documentIndex, document] of inventory.documents.entries()) {
    candidates.push(
      buildCandidate({
        grade: `Grade ${grade}`,
        subject: subjects[documentIndex],
        document,
        landingPage: inventory.url,
        pages: document.relevantPages,
      }),
    );
  }
}

for (const candidate of candidates) {
  const subStrandCount = candidate.strands.reduce(
    (total, strand) => total + strand.subStrands.length,
    0,
  );
  console.log(
    `${candidate.grade} | ${candidate.subject} | strands=${candidate.strands.length} | subStrands=${subStrandCount}`,
  );
  if (WRITE) await saveCandidate(candidate);
}

const incomplete = candidates.filter(
  (candidate) =>
    candidate.strands.length === 0 ||
    candidate.strands.some((strand) => strand.subStrands.length === 0),
);
console.log(`TOTAL ${candidates.length}; INCOMPLETE ${incomplete.length}`);
if (incomplete.length > 0) {
  for (const candidate of incomplete) {
    console.error(`INCOMPLETE ${candidate.grade} | ${candidate.subject}`);
  }
  process.exitCode = 1;
}
