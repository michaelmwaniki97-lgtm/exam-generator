import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const OFFICIAL_DATA_ROOT = new URL("../curriculum/official/", import.meta.url);

function validateName(value, path, errors) {
  if (typeof value !== "string" || value.length === 0) {
    errors.push(`${path} must be a non-empty string`);
    return;
  }

  if (value !== value.trim()) {
    errors.push(`${path} contains surrounding whitespace`);
  }
}

function validateOrderedItems(items, path, errors) {
  if (!Array.isArray(items) || items.length === 0) {
    errors.push(`${path} must be a non-empty array`);
    return;
  }

  const codes = new Set();
  items.forEach((item, index) => {
    if (item.order !== index + 1) {
      errors.push(`${path}[${index}].order must be ${index + 1}`);
    }
    validateName(item.name, `${path}[${index}].name`, errors);
    validateName(item.code, `${path}[${index}].code`, errors);
    if (typeof item.code === "string" && !/^\d+\.\d+(?:\.\d+)?$/.test(item.code)) {
      errors.push(`${path}[${index}].code must use an official numeric hierarchy code`);
    }
    if (codes.has(item.code)) {
      errors.push(`${path} contains duplicate code: ${item.code}`);
    }
    codes.add(item.code);

    if (item.alternativeNames !== undefined) {
      if (!Array.isArray(item.alternativeNames)) {
        errors.push(`${path}[${index}].alternativeNames must be an array`);
      } else {
        for (const [alternativeIndex, alternativeName] of item.alternativeNames.entries()) {
          validateName(
            alternativeName,
            `${path}[${index}].alternativeNames[${alternativeIndex}]`,
            errors,
          );
        }
      }
    }
  });

}

function validateCbcCurriculumDocument(document) {
  const errors = [];

  if (document.schemaVersion !== 1) {
    errors.push("schemaVersion must be 1");
  }
  if (document.educationSystem !== "CBC") {
    errors.push("educationSystem must be CBC for this source file");
  }
  validateName(document.grade, "grade", errors);
  validateName(document.subject, "subject", errors);

  if (document.verificationStatus !== "hierarchy_verified_not_imported") {
    errors.push(
      "verificationStatus must not claim that this source candidate is active",
    );
  }
  if (document.applicationStatus !== "provisional_seed_preserved") {
    errors.push("applicationStatus must preserve the provisional application data");
  }
  if (document.outcomeStatus !== "source_required") {
    errors.push("outcomeStatus must be source_required until exact outcomes are imported");
  }

  const source = document.source ?? {};
  validateName(source.authority, "source.authority", errors);
  validateName(source.title, "source.title", errors);
  validateName(source.version, "source.version", errors);

  if (
    typeof source.officialLandingPage !== "string" ||
    !source.officialLandingPage.startsWith("https://kicd.ac.ke/")
  ) {
    errors.push("source.officialLandingPage must be an official KICD URL");
  }
  if (
    typeof source.officialDocument !== "string" ||
    !source.officialDocument.startsWith("https://drive.google.com/file/d/")
  ) {
    errors.push("source.officialDocument must be the document embedded by KICD");
  }

  validateOrderedItems(document.strands, "strands", errors);
  for (const [strandIndex, strand] of (document.strands ?? []).entries()) {
    validateOrderedItems(
      strand.subStrands,
      `strands[${strandIndex}].subStrands`,
      errors,
    );
  }

  if (document.learningOutcomes !== undefined) {
    errors.push(
      "learningOutcomes must be omitted while outcomeStatus is source_required",
    );
  }

  return errors;
}

const SUPPORTED_FORMS = new Set(["Form 1", "Form 2", "Form 3", "Form 4"]);
const SUPPORTED_FORM_SUBJECTS = new Set([
  "Biology",
  "Chemistry",
  "Christian Religious Education",
  "English",
  "Kiswahili",
  "Mathematics",
  "Physics",
]);

function validateFormOrderedItems(
  items,
  path,
  errors,
  { allowNullCodes = false, requireNullDiscrepancy = false } = {},
) {
  if (!Array.isArray(items) || items.length === 0) {
    errors.push(`${path} must be a non-empty array`);
    return;
  }

  const byCode = new Map();
  items.forEach((item, index) => {
    if (item.order !== index + 1) {
      errors.push(`${path}[${index}].order must be ${index + 1}`);
    }
    validateName(item.name, `${path}[${index}].name`, errors);

    if (
      item.code === null &&
      allowNullCodes &&
      requireNullDiscrepancy &&
      (typeof item.sourceDiscrepancy !== "string" ||
        item.sourceDiscrepancy.trim().length === 0)
    ) {
      errors.push(`${path}[${index}].code requires sourceDiscrepancy when null`);
    }
    if (item.code !== null || !allowNullCodes) {
      validateName(item.code, `${path}[${index}].code`, errors);
      if (
        typeof item.code === "string" &&
        !/^\d+\.\d+(?:\.\d+)?$/.test(item.code)
      ) {
        errors.push(
          `${path}[${index}].code must use an official numeric hierarchy code`,
        );
      }
    }

    if (typeof item.code === "string") {
      const matches = byCode.get(item.code) ?? [];
      matches.push(item);
      byCode.set(item.code, matches);
    }
    if (item.sourceCode !== undefined) {
      validateName(item.sourceCode, `${path}[${index}].sourceCode`, errors);
    }
    if (item.sourceDiscrepancy !== undefined) {
      validateName(
        item.sourceDiscrepancy,
        `${path}[${index}].sourceDiscrepancy`,
        errors,
      );
    }
  });

  for (const [code, matches] of byCode) {
    if (
      matches.length > 1 &&
      matches.some(
        (item) =>
          typeof item.sourceDiscrepancy !== "string" ||
          item.sourceDiscrepancy.trim().length === 0,
      )
    ) {
      errors.push(
        `${path} contains duplicate code: ${code}; every published duplicate requires sourceDiscrepancy`,
      );
    }
  }
}

function validateTopicObjectives(topic, path, errors) {
  if (!["sourced", "source_required"].includes(topic.objectiveStatus)) {
    errors.push(`${path}.objectiveStatus is invalid`);
    return;
  }
  if (topic.objectiveScope !== "official_topic_level") {
    errors.push(`${path}.objectiveScope must be official_topic_level`);
  }

  if (topic.objectiveStatus === "source_required") {
    if (topic.objectives !== undefined && topic.objectives.length > 0) {
      errors.push(`${path}.objectives must be omitted while source_required`);
    }
    validateName(topic.objectiveSourceNote, `${path}.objectiveSourceNote`, errors);
    return;
  }

  if (!Array.isArray(topic.objectives) || topic.objectives.length === 0) {
    errors.push(`${path}.objectives must be a non-empty sourced array`);
    return;
  }
  topic.objectives.forEach((objective, index) => {
    if (objective.order !== index + 1) {
      errors.push(`${path}.objectives[${index}].order must be ${index + 1}`);
    }
    validateName(objective.label, `${path}.objectives[${index}].label`, errors);
    validateName(objective.text, `${path}.objectives[${index}].text`, errors);
    if (
      objective.sourcePages !== undefined &&
      (!Array.isArray(objective.sourcePages) ||
        objective.sourcePages.length === 0 ||
        objective.sourcePages.some(
          (page) => !Number.isInteger(page) || page <= 0,
        ))
    ) {
      errors.push(
        `${path}.objectives[${index}].sourcePages must contain positive page numbers`,
      );
    }
  });
}

export function validateFormCurriculumDocument(document) {
  const errors = [];

  if (document.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (document.educationSystem !== "8-4-4") {
    errors.push("educationSystem must be 8-4-4 for this source file");
  }
  if (!SUPPORTED_FORMS.has(document.form)) {
    errors.push("form must be Form 1, Form 2, Form 3, or Form 4");
  }
  if (!SUPPORTED_FORM_SUBJECTS.has(document.subject)) {
    errors.push("subject is not in the supported Form 1-4 set");
  }
  validateName(document.form, "form", errors);
  validateName(document.subject, "subject", errors);
  validateName(document.objectiveMappingPolicy, "objectiveMappingPolicy", errors);

  const officialStatus = "OFFICIAL_VERIFIED_NOT_IMPORTED";
  const textbookStatus = "TEXTBOOK_VERIFIED_KICD_SOURCE_PENDING_NOT_IMPORTED";
  if (![officialStatus, textbookStatus].includes(document.verificationStatus)) {
    errors.push("verificationStatus must be an approved inactive Form status");
  }
  if (document.applicationStatus !== "provisional_seed_preserved") {
    errors.push("applicationStatus must preserve the provisional application data");
  }
  if (!["sourced", "mixed_source_required"].includes(document.objectiveStatus)) {
    errors.push("objectiveStatus must describe sourced or source-required objectives");
  }

  const source = document.source ?? {};
  for (const field of [
    "authority",
    "title",
    "year",
    "edition",
    "sourceType",
    "accessedOn",
  ]) {
    validateName(source[field], `source.${field}`, errors);
  }
  if (
    typeof source.archiveDocument !== "string" ||
    !source.archiveDocument.startsWith("https://")
  ) {
    errors.push("source.archiveDocument must be an HTTPS source URL");
  }
  if (
    source.bibliographicRecord !== undefined &&
    (typeof source.bibliographicRecord !== "string" ||
      !source.bibliographicRecord.startsWith("https://"))
  ) {
    errors.push("source.bibliographicRecord must be an HTTPS URL");
  }
  if (
    document.verificationStatus === officialStatus &&
    typeof source.sourceType === "string" &&
    source.sourceType.includes("textbook")
  ) {
    errors.push("textbook-only evidence cannot claim OFFICIAL verification");
  }
  if (
    document.verificationStatus === textbookStatus &&
    (typeof source.sourceType !== "string" ||
      !source.sourceType.includes("textbook"))
  ) {
    errors.push("TEXTBOOK verification requires textbook source traceability");
  }

  validateFormOrderedItems(document.topics, "topics", errors, {
    allowNullCodes: document.subject === "English",
    requireNullDiscrepancy: true,
  });
  for (const [topicIndex, topic] of (document.topics ?? []).entries()) {
    const topicPath = `topics[${topicIndex}]`;
    validateTopicObjectives(topic, topicPath, errors);
    validateFormOrderedItems(topic.subTopics, `${topicPath}.subTopics`, errors, {
      allowNullCodes: document.subject === "English",
    });
    for (const [subTopicIndex, subTopic] of (
      topic.subTopics ?? []
    ).entries()) {
      const statusPath =
        `${topicPath}.subTopics[${subTopicIndex}].objectiveStatus`;
      if (
        !["official_topic_objectives_apply", "source_required"].includes(
          subTopic.objectiveStatus,
        )
      ) {
        errors.push(`${statusPath} is invalid`);
      }
      if (
        topic.objectiveStatus === "source_required" &&
        subTopic.objectiveStatus !== "source_required"
      ) {
        errors.push(`${statusPath} cannot claim mapped objectives`);
      }
    }
  }

  return errors;
}

export function validateCurriculumDocument(document) {
  if (document?.educationSystem === "CBC") {
    return validateCbcCurriculumDocument(document);
  }
  if (document?.educationSystem === "8-4-4") {
    return validateFormCurriculumDocument(document);
  }
  return ["educationSystem must be CBC or 8-4-4"];
}

export async function loadOfficialCurriculumDocuments() {
  const entries = await readdir(OFFICIAL_DATA_ROOT, {
    recursive: true,
    withFileTypes: true,
  });
  const officialDataFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => pathToFileURL(join(entry.parentPath, entry.name)))
    .sort((left, right) => left.href.localeCompare(right.href));

  return Promise.all(
    officialDataFiles.map(async (file) => ({
      file: fileURLToPath(file),
      document: JSON.parse(await readFile(file, "utf8")),
    })),
  );
}

export async function validateOfficialCurriculumData() {
  const results = [];

  for (const entry of await loadOfficialCurriculumDocuments()) {
    results.push({
      file: entry.file,
      errors: validateCurriculumDocument(entry.document),
    });
  }

  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const results = await validateOfficialCurriculumData();
  const failed = results.filter((result) => result.errors.length > 0);

  for (const result of results) {
    if (result.errors.length === 0) {
      console.log(`PASS ${result.file}`);
      continue;
    }

    console.error(`FAIL ${result.file}`);
    for (const error of result.errors) console.error(`  - ${error}`);
  }

  if (failed.length > 0) process.exitCode = 1;
}
