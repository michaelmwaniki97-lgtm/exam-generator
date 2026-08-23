import type { StimulusCapability } from "./profiles.ts";
import type { QuestionFamily } from "../blueprint/types.ts";

export const RICH_CONTENT_LIMITS = {
  stimuliPerQuestion: 3,
  serializedCharactersPerQuestion: 20_000,
  titleCharacters: 160,
  instructionCharacters: 500,
  passageCharacters: 5_000,
  extractCharacters: 1_500,
  tableColumns: 8,
  tableRows: 20,
  tableCellCharacters: 240,
  datasetSeries: 4,
  datasetValuesPerSeries: 40,
  graphSeries: 4,
  graphPointsPerSeries: 40,
  diagramPrimitives: 40,
  labelCharacters: 120,
  coordinateMagnitude: 1_000_000,
} as const;

export type SupportedStimulusType =
  | "passage"
  | "extract"
  | "table"
  | "dataset"
  | "graph"
  | "diagram";

export type StimulusSourceType =
  | "generated"
  | "authorized_textbook"
  | "teacher_supplied"
  | "public_domain"
  | "oer";

type StimulusBase = {
  id: string;
  title?: string;
  instructions?: string;
};

export type TextStimulus = StimulusBase & {
  type: "passage" | "extract";
  content: string;
  sourceType: StimulusSourceType;
  provenance?: {
    textbookId?: string;
    documentId?: string;
    chunkIds?: string[];
    attribution?: string;
  };
};

export type TableStimulus = StimulusBase & {
  type: "table";
  caption?: string;
  columns: string[];
  rows: string[][];
};

export type DatasetStimulus = StimulusBase & {
  type: "dataset";
  labels: string[];
  series: Array<{ name: string; unit: string; values: number[] }>;
};

export type GraphStimulus = StimulusBase & {
  type: "graph";
  graphType: "line" | "bar" | "scatter";
  xAxis: { label: string; unit: string; min: number; max: number };
  yAxis: { label: string; unit: string; min: number; max: number };
  series: Array<{
    name: string;
    points: Array<{ x: number; y: number }>;
  }>;
};

export type DiagramPrimitive =
  | { type: "line" | "arrow"; x1: number; y1: number; x2: number; y2: number; label?: string }
  | { type: "circle"; cx: number; cy: number; r: number; label?: string }
  | { type: "rectangle"; x: number; y: number; width: number; height: number; label?: string }
  | { type: "polygon"; points: Array<{ x: number; y: number }>; label?: string }
  | { type: "label"; x: number; y: number; text: string };

export type DiagramStimulus = StimulusBase & {
  type: "diagram";
  caption?: string;
  width: number;
  height: number;
  primitives: DiagramPrimitive[];
};

export type RichStimulus =
  | TextStimulus
  | TableStimulus
  | DatasetStimulus
  | GraphStimulus
  | DiagramStimulus;

const FAMILY_STIMULI: Partial<Record<QuestionFamily, readonly SupportedStimulusType[]>> = {
  comprehension: ["passage", "extract"],
  literary_appreciation: ["passage", "extract"],
  set_text_response: ["extract"],
  fasihi: ["extract"],
  data_graph_interpretation: ["table", "dataset", "graph"],
  scientific_application: ["table", "dataset", "graph", "diagram"],
  scientific_calculation: ["table", "dataset", "graph"],
  structured_calculation: ["table", "dataset", "graph", "diagram"],
  multi_step_problem_solving: ["table", "dataset", "graph", "diagram"],
  application_context_problem: ["table", "dataset", "graph", "diagram"],
  mathematical_reasoning: ["table", "dataset", "graph", "diagram"],
  interpretation_application: ["passage", "extract", "table"],
  practical_observation: ["table", "dataset", "diagram"],
  practical_measurement: ["table", "dataset", "diagram"],
  practical_recording: ["table", "dataset", "diagram"],
  practical_data_handling: ["table", "dataset", "graph", "diagram"],
  practical_calculation: ["table", "dataset", "graph", "diagram"],
  practical_interpretation: ["table", "dataset", "graph", "diagram"],
  rich_application_task: ["passage", "table", "dataset", "graph", "diagram"],
};

const CAPABILITY_TYPE: Partial<Record<StimulusCapability, SupportedStimulusType>> = {
  passage: "passage",
  extract: "extract",
  table: "table",
  dataset: "dataset",
  graph: "graph",
  diagram: "diagram",
};

export function allowedStimulusTypes(
  family: QuestionFamily,
  capabilities: readonly StimulusCapability[]
): SupportedStimulusType[] {
  const profileAllowed = new Set(
    capabilities.map((capability) => CAPABILITY_TYPE[capability]).filter(Boolean)
  );
  return [...(FAMILY_STIMULI[family] ?? [])].filter((type) =>
    profileAllowed.has(type)
  );
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

const MARKUP_TAG = /<\s*\/?\s*[A-Za-z][A-Za-z0-9:-]*(?:\s[^<>]*|\/?)>/;
const EXECUTABLE_SCHEME = /\bjavascript\s*:/i;
const EVENT_HANDLER_ASSIGNMENT = /\bon[a-z]+\s*=/i;

export function isSafeEducationalText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max &&
    !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value) &&
    !MARKUP_TAG.test(value) && !EXECUTABLE_SCHEME.test(value) &&
    !EVENT_HANDLER_ASSIGNMENT.test(value);
}

function optionalText(value: unknown, max: number): boolean {
  return value === undefined || isSafeEducationalText(value, max);
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) &&
    Math.abs(value) <= RICH_CONTENT_LIMITS.coordinateMagnitude;
}

function validBase(value: Record<string, unknown>): boolean {
  return isSafeEducationalText(value.id, 120) && optionalText(value.title, RICH_CONTENT_LIMITS.titleCharacters) &&
    optionalText(value.instructions, RICH_CONTENT_LIMITS.instructionCharacters);
}

function exactKeys(value: Record<string, unknown>, specific: readonly string[]): boolean {
  const allowed = new Set(["type", "id", "title", "instructions", ...specific]);
  return Object.keys(value).every((key) => allowed.has(key));
}

function onlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const names = new Set(allowed);
  return Object.keys(value).every((key) => names.has(key));
}

function validProvenance(value: unknown): boolean {
  if (!record(value)) return false;
  const allowed = new Set(["textbookId", "documentId", "chunkIds", "attribution"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) return false;
  return optionalText(value.textbookId, 120) && optionalText(value.documentId, 120) &&
    optionalText(value.attribution, 240) &&
    (value.chunkIds === undefined || (Array.isArray(value.chunkIds) && value.chunkIds.length <= 12 && value.chunkIds.every((id) => isSafeEducationalText(id, 120))));
}

export function validateStimulus(value: unknown): string[] {
  if (!record(value) || !validBase(value)) return ["stimulus has invalid identity or text metadata"];
  if (value.type === "passage" || value.type === "extract") {
    if (!exactKeys(value, ["content", "sourceType", "provenance"])) return [`${value.type} contains unsupported properties`];
    const max = value.type === "passage" ? RICH_CONTENT_LIMITS.passageCharacters : RICH_CONTENT_LIMITS.extractCharacters;
    if (!isSafeEducationalText(value.content, max)) return [`${value.type} content is empty, unsafe, or oversized`];
    if (!["generated", "authorized_textbook", "teacher_supplied", "public_domain", "oer"].includes(String(value.sourceType))) return [`${value.type} source type is invalid`];
    if (value.provenance !== undefined && !validProvenance(value.provenance)) return [`${value.type} provenance is invalid`];
    if (value.sourceType === "authorized_textbook" && (!record(value.provenance) || !isSafeEducationalText(value.provenance.textbookId, 120) || !isSafeEducationalText(value.provenance.documentId, 120))) return [`${value.type} authorized textbook provenance is incomplete`];
    if (value.sourceType !== "authorized_textbook" && record(value.provenance) && (value.provenance.textbookId !== undefined || value.provenance.documentId !== undefined || value.provenance.chunkIds !== undefined)) return [`${value.type} non-textbook provenance cannot claim private textbook identifiers`];
    return [];
  }
  if (value.type === "table") {
    if (!exactKeys(value, ["caption", "columns", "rows"]) || !optionalText(value.caption, RICH_CONTENT_LIMITS.titleCharacters)) return ["table contains unsupported or invalid metadata"];
    if (!Array.isArray(value.columns) || value.columns.length < 1 || value.columns.length > RICH_CONTENT_LIMITS.tableColumns ||
      !value.columns.every((cell) => isSafeEducationalText(cell, RICH_CONTENT_LIMITS.tableCellCharacters))) return ["table columns are invalid or oversized"];
    const columnCount = value.columns.length;
    if (!Array.isArray(value.rows) || value.rows.length < 1 || value.rows.length > RICH_CONTENT_LIMITS.tableRows ||
      !value.rows.every((row) => Array.isArray(row) && row.length === columnCount && row.every((cell) => isSafeEducationalText(cell, RICH_CONTENT_LIMITS.tableCellCharacters)))) return ["table rows are invalid or oversized"];
    return [];
  }
  if (value.type === "dataset") {
    if (!exactKeys(value, ["labels", "series"])) return ["dataset contains unsupported properties"];
    if (!Array.isArray(value.labels) || value.labels.length < 1 || value.labels.length > RICH_CONTENT_LIMITS.datasetValuesPerSeries || !value.labels.every((label) => isSafeEducationalText(label, RICH_CONTENT_LIMITS.labelCharacters))) return ["dataset labels are missing or invalid"];
    const labelCount = value.labels.length;
    if (!Array.isArray(value.series) || value.series.length < 1 || value.series.length > RICH_CONTENT_LIMITS.datasetSeries || !value.series.every((series) => record(series) && onlyKeys(series, ["name", "unit", "values"]) && isSafeEducationalText(series.name, RICH_CONTENT_LIMITS.labelCharacters) && isSafeEducationalText(series.unit, 40) && Array.isArray(series.values) && series.values.length === labelCount && series.values.every(finite))) return ["dataset series, units, or values are invalid"];
    return [];
  }
  if (value.type === "graph") {
    if (!exactKeys(value, ["graphType", "xAxis", "yAxis", "series"])) return ["graph contains unsupported properties"];
    if (!["line", "bar", "scatter"].includes(String(value.graphType))) return ["graph type is unsupported"];
    const axis = (candidate: unknown) => record(candidate) && onlyKeys(candidate, ["label", "unit", "min", "max"]) && isSafeEducationalText(candidate.label, RICH_CONTENT_LIMITS.labelCharacters) && isSafeEducationalText(candidate.unit, 40) && finite(candidate.min) && finite(candidate.max) && candidate.min < candidate.max;
    if (!axis(value.xAxis) || !axis(value.yAxis)) return ["graph axes, units, or ranges are invalid"];
    const xAxis = value.xAxis as Record<string, number>;
    const yAxis = value.yAxis as Record<string, number>;
    if (!Array.isArray(value.series) || value.series.length < 1 || value.series.length > RICH_CONTENT_LIMITS.graphSeries || !value.series.every((series) => record(series) && onlyKeys(series, ["name", "points"]) && isSafeEducationalText(series.name, RICH_CONTENT_LIMITS.labelCharacters) && Array.isArray(series.points) && series.points.length > 0 && series.points.length <= RICH_CONTENT_LIMITS.graphPointsPerSeries && series.points.every((point) => record(point) && onlyKeys(point, ["x", "y"]) && finite(point.x) && finite(point.y) && point.x >= xAxis.min && point.x <= xAxis.max && point.y >= yAxis.min && point.y <= yAxis.max))) return ["graph series or points are invalid"];
    return [];
  }
  if (value.type === "diagram") {
    if (!exactKeys(value, ["caption", "width", "height", "primitives"]) || !optionalText(value.caption, RICH_CONTENT_LIMITS.titleCharacters)) return ["diagram contains unsupported or invalid metadata"];
    if (!finite(value.width) || !finite(value.height) || value.width <= 0 || value.height <= 0 || !Array.isArray(value.primitives) || value.primitives.length < 1 || value.primitives.length > RICH_CONTENT_LIMITS.diagramPrimitives) return ["diagram dimensions or primitive count are invalid"];
    const x = (candidate: unknown) => finite(candidate) && candidate >= 0 && candidate <= Number(value.width);
    const y = (candidate: unknown) => finite(candidate) && candidate >= 0 && candidate <= Number(value.height);
    const primitiveValid = (primitive: unknown): boolean => {
      if (!record(primitive)) return false;
      if (primitive.type === "line" || primitive.type === "arrow") return onlyKeys(primitive, ["type", "x1", "y1", "x2", "y2", "label"]) && x(primitive.x1) && y(primitive.y1) && x(primitive.x2) && y(primitive.y2) && optionalText(primitive.label, RICH_CONTENT_LIMITS.labelCharacters);
      if (primitive.type === "circle") return onlyKeys(primitive, ["type", "cx", "cy", "r", "label"]) && x(primitive.cx) && y(primitive.cy) && finite(primitive.r) && primitive.r > 0 && Number(primitive.cx) - primitive.r >= 0 && Number(primitive.cx) + primitive.r <= Number(value.width) && Number(primitive.cy) - primitive.r >= 0 && Number(primitive.cy) + primitive.r <= Number(value.height) && optionalText(primitive.label, RICH_CONTENT_LIMITS.labelCharacters);
      if (primitive.type === "rectangle") return onlyKeys(primitive, ["type", "x", "y", "width", "height", "label"]) && x(primitive.x) && y(primitive.y) && finite(primitive.width) && primitive.width > 0 && finite(primitive.height) && primitive.height > 0 && Number(primitive.x) + primitive.width <= Number(value.width) && Number(primitive.y) + primitive.height <= Number(value.height) && optionalText(primitive.label, RICH_CONTENT_LIMITS.labelCharacters);
      if (primitive.type === "polygon") return onlyKeys(primitive, ["type", "points", "label"]) && Array.isArray(primitive.points) && primitive.points.length >= 3 && primitive.points.length <= 12 && primitive.points.every((point) => record(point) && onlyKeys(point, ["x", "y"]) && x(point.x) && y(point.y)) && optionalText(primitive.label, RICH_CONTENT_LIMITS.labelCharacters);
      return primitive.type === "label" && onlyKeys(primitive, ["type", "x", "y", "text"]) && x(primitive.x) && y(primitive.y) && isSafeEducationalText(primitive.text, RICH_CONTENT_LIMITS.labelCharacters);
    };
    return value.primitives.every(primitiveValid) ? [] : ["diagram contains an invalid or unsafe primitive"];
  }
  return ["stimulus type is unsupported"];
}

export function validateQuestionStimuli(
  stimuli: unknown,
  allowed: readonly SupportedStimulusType[]
): string[] {
  if (stimuli === undefined) return [];
  if (!Array.isArray(stimuli) || stimuli.length > RICH_CONTENT_LIMITS.stimuliPerQuestion) return ["stimulus count is invalid or excessive"];
  let serialized: string;
  try { serialized = JSON.stringify(stimuli); } catch { return ["stimulus content is not serializable"]; }
  if (serialized.length > RICH_CONTENT_LIMITS.serializedCharactersPerQuestion) return ["stimulus content is oversized"];
  const ids = new Set<string>();
  const problems: string[] = [];
  for (const stimulus of stimuli) {
    problems.push(...validateStimulus(stimulus));
    if (record(stimulus)) {
      if (!allowed.includes(stimulus.type as SupportedStimulusType)) problems.push(`${String(stimulus.type)} stimulus is not permitted for this slot`);
      if (typeof stimulus.id === "string" && ids.has(stimulus.id)) problems.push("stimulus IDs must be unique within a question");
      if (typeof stimulus.id === "string") ids.add(stimulus.id);
    }
  }
  return [...new Set(problems)];
}
