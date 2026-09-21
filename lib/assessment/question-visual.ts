import { isSafeEducationalText, validateStimulus, type DiagramStimulus, type GraphStimulus, type RichStimulus, type TableStimulus } from "./rich-content.ts";

type GraphSpecification = Omit<GraphStimulus, "type" | "id" | "title" | "instructions" | "graphType"> & { graphType: "line" | "bar" | "scatter" | "coordinate" };
// Coordinate grids may intentionally have no plotted points.
export type QuestionVisual = { required: boolean; altText?: string | null } & (
  | { type: "graph"; specification: GraphSpecification }
  | { type: "table"; specification: Pick<TableStimulus, "columns" | "rows"> }
  | { type: "diagram" | "illustration"; specification: Pick<DiagramStimulus, "width" | "height" | "primitives"> }
  | { type: "diagram"; specification: { diagramType: "number_line"; min: number; max: number; step: number; points: Array<{ value: number; label: string }> } }
);

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const keys = (v: Record<string, unknown>, names: string[]) => Object.keys(v).every(k => names.includes(k));
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 1_000_000;

export function validateQuestionVisual(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!record(value) || !keys(value, ["type", "required", "altText", "specification"]) || typeof value.required !== "boolean" || (value.altText != null && !isSafeEducationalText(value.altText, 240)) || !record(value.specification)) return ["visual metadata is invalid"];
  const spec = value.specification;
  let serialized: string;
  try { serialized = JSON.stringify(value); } catch { return ["visual is not serializable"]; }
  if (serialized.length > 20_000) return ["visual is oversized"];
  if (value.type === "diagram" && spec.diagramType === "number_line") {
    if (!keys(spec, ["diagramType", "min", "max", "step", "points"]) || !finite(spec.min) || !finite(spec.max) || !finite(spec.step) || spec.min >= spec.max || spec.step <= 0 || (spec.max - spec.min) / spec.step > 20 || !Number.isInteger((spec.max - spec.min) / spec.step) || !Array.isArray(spec.points) || spec.points.length > 10 || !spec.points.every(p => record(p) && keys(p, ["value", "label"]) && finite(p.value) && p.value >= Number(spec.min) && p.value <= Number(spec.max) && isSafeEducationalText(p.label, 16))) return ["number line range, ticks or points are invalid"];
    return [];
  }
  if (value.type === "graph") {
    if (!keys(spec, ["graphType", "xAxis", "yAxis", "series"])) return ["graph specification contains unsupported properties"];
    const coordinate = spec.graphType === "coordinate";
    const candidate = { ...spec, id: "visual", type: "graph", ...(coordinate ? { graphType: "scatter", series: [{ name: "Grid", points: [{ x: record(spec.xAxis) ? spec.xAxis.min : null, y: record(spec.yAxis) ? spec.yAxis.min : null }] }] } : {}) };
    const errors = validateStimulus(candidate);
    if (coordinate && (!Array.isArray(spec.series) || spec.series.length !== 0)) errors.push("empty coordinate grids require series: []");
    if (record(spec.xAxis) && record(spec.yAxis)) {
      for (const axis of [spec.xAxis, spec.yAxis]) if (typeof axis.label === "string" && axis.label.length > 40) errors.push("axis labels must be at most 40 characters");
      const xr = Number(spec.xAxis.max) - Number(spec.xAxis.min), yr = Number(spec.yAxis.max) - Number(spec.yAxis.min);
      if (xr < 0.000001 || yr < 0.000001) errors.push("axis ranges are too small to print clearly");
      if (coordinate && (xr / yr < 0.5 || xr / yr > 2)) errors.push("coordinate grid ranges must have comparable spans for equal-scale printing");
      if (spec.graphType === "bar" && (Number(spec.yAxis.min) > 0 || Number(spec.yAxis.max) < 0)) errors.push("bar graph range must include zero");
    }
    if (Array.isArray(spec.series) && spec.series.length > 1) errors.push("visual graphs support one series; use separate questions for comparisons");
    if (spec.graphType === "bar" && Array.isArray(spec.series) && record(spec.series[0]) && Array.isArray(spec.series[0].points)) {
      const points = spec.series[0].points;
      if (points.length > 12 || new Set(points.map(p => record(p) ? p.x : undefined)).size !== points.length) errors.push("bars need at most 12 distinct x values");
    }
    return errors;
  }
  if (value.type === "table") {
    if (!keys(spec, ["columns", "rows"])) return ["table specification contains unsupported properties"];
    return validateStimulus({ ...spec, id: "visual", type: "table" });
  }
  if (value.type === "diagram" || value.type === "illustration") {
    if (!keys(spec, ["width", "height", "primitives"])) return ["diagram specification contains unsupported properties"];
    const errors = validateStimulus({ ...spec, id: "visual", type: "diagram" });
    if (Number(spec.width) < 200 || Number(spec.width) > 600 || Number(spec.height) < 80 || Number(spec.height) > 360) errors.push("diagram canvas must be 200–600 wide and 80–360 high for readable printing");
    if (Array.isArray(spec.primitives) && spec.primitives.some(p => record(p) && p.type === "label" && typeof p.text === "string" && (p.text.length > 40 || Number(p.x) + p.text.length * 6 > Number(spec.width) || Number(p.y) < 12))) errors.push("diagram labels need room within the canvas");
    return errors;
  }
  return ["visual type is unsupported"];
}

export function visualStimulus(visual: QuestionVisual): RichStimulus {
  const problems = validateQuestionVisual(visual);
  if (problems.length) throw new Error(problems.join("; "));
  const spec = visual.specification;
  if (visual.type === "diagram" && "diagramType" in spec) {
    const x = (v: number) => 35 + (v - spec.min) / (spec.max - spec.min) * 470;
    const primitives: DiagramStimulus["primitives"] = [{ type: "arrow", x1: 20, y1: 55, x2: 520, y2: 55 }];
    for (let i = 0; i <= (spec.max - spec.min) / spec.step; i++) {
      const value = spec.min + i * spec.step;
      primitives.push({ type: "line", x1: x(value), y1: 50, x2: x(value), y2: 60 }, { type: "label", x: x(value) - 5, y: 80, text: String(Number(value.toPrecision(8))) });
    }
    for (const point of spec.points) primitives.push({ type: "circle", cx: x(point.value), cy: 55, r: 3 }, { type: "label", x: x(point.value) - 5, y: 32, text: point.label });
    return { id: "question-visual", type: "diagram", width: 540, height: 100, primitives };
  }
  return { ...spec, id: "question-visual", type: visual.type === "illustration" ? "diagram" : visual.type } as RichStimulus;
}

export const VISUAL_GUIDANCE = `Use a visual only when it is needed for assessment. The response schema permits only graph data, coordinate grids, tables, number lines, and finite geometry shapes. Supply semantic values and labels only. Never author drawing primitives, coordinates, canvas dimensions, SVG, HTML, markup, URLs, gradients, colours, or arbitrary JSON. If the visual cannot be expressed by the schema, return null and write a self-contained text question. The server creates the printable black-and-white renderer data.`;
