import test from "node:test";
import assert from "node:assert/strict";
import { validateQuestionVisual, visualStimulus, type QuestionVisual } from "./question-visual.ts";
import { graphLayout, arrowHead } from "./visual-layout.ts";
import type { GraphStimulus } from "./rich-content.ts";

export const graphVisual: QuestionVisual = { type: "graph", required: true, altText: "Temperature against time", specification: { graphType: "line", xAxis: { label: "Time", unit: "min", min: 0, max: 20 }, yAxis: { label: "Temperature", unit: "C", min: 0, max: 100 }, series: [{ name: "Water", points: [{ x: 0, y: 20 }, { x: 5, y: 35 }, { x: 10, y: 55 }, { x: 15, y: 70 }, { x: 20, y: 70 }] }] } };
test("visuals are optional and reject unsafe, unknown and oversized specifications", () => {
  assert.deepEqual(validateQuestionVisual(undefined), []);
  assert.deepEqual(validateQuestionVisual(null), []);
  assert.deepEqual(validateQuestionVisual(graphVisual), []);
  for (const value of [{ ...graphVisual, svg: "<svg/>" }, { ...graphVisual, altText: "<script>alert(1)</script>" }, { ...graphVisual, required: "true" }, { type: "image", required: true, specification: { url: "https://example.com" } }, { ...graphVisual, specification: { ...graphVisual.specification, onload: "evil()" } }]) assert.ok(validateQuestionVisual(value).length);
});
test("graph validation catches degenerate ranges, out-of-range points and nonfinite values", () => {
  if (graphVisual.type !== "graph") return;
  for (const specification of [{ ...graphVisual.specification, xAxis: { ...graphVisual.specification.xAxis, max: 0 } }, { ...graphVisual.specification, series: [{ name: "Bad", points: [{ x: 21, y: 30 }] }] }, { ...graphVisual.specification, series: [{ name: "Bad", points: [{ x: 0, y: Infinity }] }] }]) assert.ok(validateQuestionVisual({ ...graphVisual, specification }).length);
});
test("coordinate grids are blank; scatter has no connecting segments; bars support negative values", () => {
  if (graphVisual.type !== "graph") return;
  const grid = { ...graphVisual, specification: { ...graphVisual.specification, graphType: "coordinate", yAxis: { label: "y", unit: "1", min: 0, max: 20 }, series: [] } } as QuestionVisual;
  assert.deepEqual(validateQuestionVisual(grid), []);
  assert.equal(graphLayout(visualStimulus(grid) as GraphStimulus).primitives.filter(p => p.type === "circle").length, 0);
  const line = graphLayout(visualStimulus(graphVisual) as GraphStimulus);
  const scatter = graphLayout({ ...visualStimulus(graphVisual), graphType: "scatter" } as GraphStimulus);
  assert.equal(line.primitives.length - scatter.primitives.length, 4);
  const bars: QuestionVisual = { ...graphVisual, specification: { ...graphVisual.specification, graphType: "bar", yAxis: { ...graphVisual.specification.yAxis, min: -10, max: 10 }, series: [{ name: "Change", points: [{ x: 5, y: -5 }, { x: 10, y: 5 }] }] } };
  assert.deepEqual(validateQuestionVisual(bars), []);
  const rectangles = graphLayout(visualStimulus(bars) as GraphStimulus).primitives.filter(p => p.type === "rectangle");
  assert.equal(rectangles.length, 2);
  assert.ok(rectangles.every(p => p.height > 0));
});
test("number lines have bounded ticks and preserve point positions", () => {
  const visual: QuestionVisual = { type: "diagram", required: true, specification: { diagramType: "number_line", min: -5, max: 5, step: 1, points: [{ value: 0, label: "A" }] } };
  assert.deepEqual(validateQuestionVisual(visual), []);
  const stimulus = visualStimulus(visual);
  assert.ok(stimulus.type === "diagram");
  assert.ok(stimulus.primitives.some(p => p.type === "circle" && p.cx === 270));
  assert.ok(validateQuestionVisual({ ...visual, specification: { ...visual.specification, step: 0 } }).length);
  assert.ok(validateQuestionVisual({ ...visual, specification: { ...visual.specification, step: 0.01 } }).length);
});
test("tables, labelled and unlabelled diagrams and contextual illustrations validate", () => {
  assert.deepEqual(validateQuestionVisual({ type: "table", required: true, specification: { columns: ["Item", "Count"], rows: [["Seeds", "5"]] } }), []);
  for (const type of ["diagram", "illustration"]) assert.deepEqual(validateQuestionVisual({ type, required: true, specification: { width: 300, height: 150, primitives: [{ type: "circle", cx: 70, cy: 70, r: 30 }, { type: "label", x: 130, y: 70, text: "A" }] } }), []);
  assert.deepEqual(arrowHead(0, 0, 10, 0)[0], { x: 10, y: 0 });
});
