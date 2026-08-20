import { mkdir, writeFile } from "node:fs/promises";

import { loadOfficialCurriculumDocuments } from "./validate-curriculum-data.mjs";

const ROOT = new URL("../", import.meta.url);
const DATE = "2026-08-16";
const FORMS = ["Form 1", "Form 2", "Form 3", "Form 4"];
const SUBJECTS = [
  "Biology",
  "Chemistry",
  "Christian Religious Education",
  "English",
  "Kiswahili",
  "Mathematics",
  "Physics",
];
const REFERENCES = [
  {
    authority: "Kenya Institute of Education (KIE)",
    title: "Secondary Education Syllabus Volume Two",
    url: "https://kcpe-kcse.com/wp-content/uploads/2018/02/SYLLABUS-ORIGINAL-FOR-MATH-PHYSICS-CHEMISTRY-BIOLOGY-AGRICULTURE-HOME-SCIENCE.pdf",
    use: "Official 2002 source for Mathematics, Physics, Chemistry and Biology.",
  },
  {
    authority: "St. Paul's University Library",
    title: "Volume Two bibliographic record",
    url: "https://library.spu.ac.ke/bib/46784",
    use: "Bibliographic confirmation of the KIE 2002 publication.",
  },
  {
    authority: "Kenya Institute of Education (KIE)",
    title: "Secondary Education Syllabus Volume Three",
    url: "https://www.scribd.com/document/867743223/Kicd-Syllabus-2002-Vol-3-1",
    use: "Official 2002 source scan for Christian Religious Education.",
  },
  {
    authority: "Kenya Institute of Education (KIE)",
    title: "Secondary Education Syllabus Volume One - English extract",
    url: "https://drive.google.com/open?id=1ckKAELak19L3x9FvgCyV9H485KsqtUu4",
    use: "Archived Form-by-Form English hierarchy and objectives.",
  },
  {
    authority: "Kenya National Examinations Council / KIE",
    title: "English course syllabus",
    url: "https://drive.google.com/open?id=1j4AsRQqDIFGZMGfJEp1kp7kEalmeirjV",
    use: "Official English content-area wording cross-check.",
  },
  {
    authority: "Pwani University Library",
    title: "Volume One bibliographic record",
    url: "https://maktaba.pu.ac.ke/cgi-bin/koha/opac-detail.pl?biblionumber=12647",
    use: "Bibliographic confirmation of KIE Volume One.",
  },
  {
    authority: "Kenya National Examinations Council / KIE",
    title: "Kiswahili course syllabus",
    url: "https://drive.google.com/open?id=187f5kVph_nTAjU3yGt4Y_yMNI_WG1kcZ",
    use: "Course-level evidence without a reliable complete Form hierarchy.",
  },
  {
    authority: "Kenya Institute of Curriculum Development (KICD)",
    title: "Orange Book Secondary 2017",
    url: "https://kicd.ac.ke/wp-content/uploads/2025/07/Orange-book-secondary-2017.pdf",
    use: "Official curriculum and approved-material context only.",
  },
];

function slug(value) {
  return value
    .normalize("NFKD")
    .replace(/[’']/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

const entries = await loadOfficialCurriculumDocuments();
const candidates = entries
  .map(({ document }) => document)
  .filter((document) => document.educationSystem === "8-4-4");
if (candidates.length !== 24) {
  throw new Error(`Expected 24 official Form candidates, found ${candidates.length}`);
}
const candidateByKey = new Map(
  candidates.map((document) => [
    `${document.form}|${document.subject}`,
    document,
  ]),
);

const unavailableRecords = FORMS.map((form) => ({
  educationSystem: "8-4-4",
  form,
  subject: "Kiswahili",
  status: "SOURCE UNAVAILABLE",
  searchedOn: DATE,
  officialSourceStatus:
    "Official course-level material was found, but no reliable complete official Form-by-Form hierarchy was available.",
  textbookStatus: "NOT USED FOR VERIFICATION",
  reason:
    "The archived Form extract is incomplete and contains transcription/OCR defects, especially for Forms 3-4. Partial or inferred wording was not promoted.",
  sources: REFERENCES.filter((source) =>
    [
      "Kiswahili course syllabus",
      "Volume One bibliographic record",
      "Orange Book Secondary 2017",
    ].includes(source.title),
  ).map(({ title, url }) => ({ title, url })),
}));

const unavailableDirectory = new URL("curriculum/source-unavailable/", ROOT);
await mkdir(unavailableDirectory, { recursive: true });
await writeFile(
  new URL("forms-1-4.json", unavailableDirectory),
  `${JSON.stringify(
    {
      schemaVersion: 1,
      generatedOn: DATE,
      policy:
        "SOURCE UNAVAILABLE means the exact hierarchy could not be verified from a sufficiently complete authoritative source. No hierarchy was invented.",
      records: unavailableRecords,
      references: REFERENCES,
    },
    null,
    2,
  )}\n`,
);

const objectiveCount = candidates.reduce(
  (total, document) =>
    total +
    document.topics.reduce(
      (topicTotal, topic) => topicTotal + (topic.objectives?.length ?? 0),
      0,
    ),
  0,
);
const sourceRequiredTopicCount = candidates.reduce(
  (total, document) =>
    total +
    document.topics.filter(
      (topic) => topic.objectiveStatus === "source_required",
    ).length,
  0,
);

const report = [
  "# Curriculum verification progress — Forms 1-4",
  "",
  `Generated: ${DATE}`,
  "",
  "## Status",
  "",
  "- Forms 1-4: 28 of 28 processed; 24 OFFICIAL VERIFIED; 4 SOURCE UNAVAILABLE; 0 pending.",
  "- TEXTBOOK VERIFIED / KICD SOURCE PENDING: 0.",
  "- CBC Grades 1-9 were not reprocessed or modified in this milestone.",
  "- Database rows changed: 0. Existing provisional application seeds remain unchanged.",
  "",
  "## Scope and controls",
  "",
  "- Scope is limited to Forms 1-4 and the seven requested subjects.",
  "- Official KIE/KICD wording, numbering and order are preserved.",
  "- Textbooks remain secondary evidence and never override an official source.",
  "- No hierarchy or objective was generated from model memory.",
  "- Candidate data is inactive and was not imported into the database.",
  "",
  "## Forms 1-4 coverage matrix",
  "",
];

for (const form of FORMS) {
  const formNumber = form.split(" ")[1];
  report.push(`### ${form}`, "");
  for (const subject of SUBJECTS) {
    const candidate = candidateByKey.get(`${form}|${subject}`);
    if (!candidate) {
      if (subject !== "Kiswahili") {
        throw new Error(`Missing candidate for ${form} ${subject}`);
      }
      report.push(
        "- SOURCE UNAVAILABLE — Kiswahili: the archived Form hierarchy is incomplete/corrupt; exact names and order were not inferred.",
      );
      continue;
    }
    const subTopics = candidate.topics.reduce(
      (total, topic) => total + topic.subTopics.length,
      0,
    );
    const objectives = candidate.topics.reduce(
      (total, topic) => total + (topic.objectives?.length ?? 0),
      0,
    );
    const sourceRequired = candidate.topics.filter(
      (topic) => topic.objectiveStatus === "source_required",
    ).length;
    const objectiveNote =
      sourceRequired === 0
        ? `${objectives} sourced objectives`
        : `${objectives} sourced objectives; ${sourceRequired} topics source-required`;
    report.push(
      `- OFFICIAL VERIFIED — ${subject}: ${candidate.topics.length} topics, ${subTopics} sub-topics, ${objectiveNote}; [candidate](../curriculum/official/form-${formNumber}/${slug(subject)}.json); [source](${candidate.source.archiveDocument}).`,
    );
  }
  report.push("");
}

report.push(
  "## Specific objectives",
  "",
  `- Sourced objective records: ${objectiveCount}.`,
  `- Topics still marked source-required: ${sourceRequiredTopicCount} (CRE Form 3 only).`,
  "- CRE Form 3 objective text was not guessed because the two-column scan extraction interleaves columns.",
  "- Official topic-level objectives remain topic-level and are not falsely mapped one-to-one to sub-topics.",
  "",
  "## Source traceability",
  "",
);
for (const source of REFERENCES) {
  report.push(
    `- [${source.title}](${source.url}) — ${source.authority}. ${source.use}`,
  );
}

report.push(
  "",
  "## Exact wording and source anomalies",
  "",
  "- Topic and sub-topic names are source-derived; printed wording is not replaced with AI wording.",
  "- Repeated official codes are retained only when every occurrence has a sourceDiscrepancy note.",
  "- Documented anomalies cover repeated Mathematics, Physics and CRE codes, one truncated CRE DOCX code cross-checked against the Volume Three scan, and inconsistent printed section labels.",
  "- English Form headings come from the archived Form extract and were cross-checked against the official course syllabus.",
  "- Kiswahili remains SOURCE UNAVAILABLE pending a complete authoritative Form source.",
  "",
  "## Data safety",
  "",
  "- Database changes: none.",
  "- CBC candidate files changed: none.",
  "- Existing provisional curriculum seed rows were preserved.",
  "- Form candidate files: 24 official JSON documents.",
  "- Form source-unavailable records: 4 Kiswahili documents.",
  "",
  "## Next curriculum-data milestone",
  "",
  "1. Obtain a complete authoritative KICD/KIE Kiswahili Form hierarchy.",
  "2. Manually transcribe CRE Form 3 objectives from the page images.",
  "3. Review each documented printed-code anomaly against its cited scan.",
  "4. Prepare a separate dry-run import only after explicit approval.",
  "",
);

await writeFile(
  new URL("docs/curriculum-verification-progress.md", ROOT),
  `${report.join("\n")}\n`,
);

console.log(
  `WROTE Form progress: official=${candidates.length}, unavailable=${unavailableRecords.length}, pending=0`,
);
