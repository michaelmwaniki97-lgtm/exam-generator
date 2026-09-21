// Provider-neutral JSON Schema. Every object is closed; nullable visual preserves text-only output.
const text = { type: "string" };
const number = { type: "number" };
const object = (properties: Record<string, unknown>) => ({ type: "object", additionalProperties: false, properties, required: Object.keys(properties) });
const array = (items: unknown) => ({ type: "array", items });
const point = object({ x: number, y: number });
const axis = object({ label: text, unit: text, min: number, max: number });
const primitive = { anyOf: [
  object({ type: { enum: ["line", "arrow"], type: "string" }, x1: number, y1: number, x2: number, y2: number }),
  object({ type: { const: "circle", type: "string" }, cx: number, cy: number, r: number }),
  object({ type: { const: "rectangle", type: "string" }, x: number, y: number, width: number, height: number }),
  object({ type: { const: "polygon", type: "string" }, points: array(point) }),
  object({ type: { const: "label", type: "string" }, x: number, y: number, text }),
] };
const variant = (types: string[], specification: unknown) => object({ type: { type: "string", enum: types }, required: { type: "boolean" }, altText: { type: ["string", "null"] }, specification });
// This is the complete application-domain schema. It is intentionally kept out
// of Anthropic's output grammar because it contains nested visual alternatives.
export const FULL_QUESTION_VISUAL_SCHEMA = { anyOf: [
  { type: "null" },
  variant(["graph"], object({ graphType: { type: "string", enum: ["line", "bar", "scatter", "coordinate"] }, xAxis: axis, yAxis: axis, series: array(object({ name: text, points: array(point) })) })),
  variant(["table"], object({ columns: array(text), rows: array(array(text)) })),
  variant(["diagram", "illustration"], object({ width: number, height: number, primitives: array(primitive) })),
  variant(["diagram"], object({ diagramType: { type: "string", const: "number_line" }, min: number, max: number, step: number, points: array(object({ value: number, label: text })) })),
] };

// Finite semantic visual contract for providers. This deliberately contains no
// renderer primitives, canvas geometry, SVG, or arbitrary JSON escape hatch.
const semanticEnvelope = (kind: string, properties: Record<string, unknown>) => object({ kind: { const: kind, type: "string" }, required: { type: "boolean" }, altText: text, ...properties });
const semanticPoint = object({ x: number, y: number });
const semanticMeasurement = object({ edge: { type: "string", enum: ["top", "right", "bottom", "left", "upper_right", "middle", "lower_right", "radius", "diameter", "side_a", "side_b", "side_c"] }, value: number, unit: text });
export const COMPACT_QUESTION_VISUAL_SCHEMA = {
  anyOf: [
    { type: "null" },
    semanticEnvelope("graph", { graphType: { type: "string", enum: ["line", "bar", "scatter"] }, xLabel: text, xUnit: text, yLabel: text, yUnit: text, points: array(semanticPoint) }),
    semanticEnvelope("coordinate_grid", { xLabel: text, yLabel: text }),
    semanticEnvelope("table", { columns: array(text), rows: array(array(text)) }),
    semanticEnvelope("number_line", { points: array(object({ value: number, label: text })) }),
    semanticEnvelope("geometry", { shape: { type: "string", enum: ["triangle", "rectangle", "square", "circle", "l_shape"] }, measurements: array(semanticMeasurement) }),
    semanticEnvelope("simple_diagram", { component: { type: "string", enum: ["beaker", "thermometer", "magnet", "plant", "circuit"] }, labels: array(text) }),
  ],
};
