import assert from "node:assert/strict";
import test from "node:test";
import { allowedStimulusTypes, isSafeEducationalText, richStimuliArrayJsonSchema, RICH_CONTENT_LIMITS, validateQuestionStimuli, validateStimulus } from "./rich-content.ts";
import { allowedMarkingModels, validateNumericalMethod, validateRubricCriteria } from "./marking-models.ts";

const passage = { type: "passage", id: "reading-1", content: "A short original passage about responsible water use.", sourceType: "generated" };
const table = { type: "table", id: "table-1", columns: ["Month", "Rainfall (mm)"], rows: [["March", "42"], ["April", "68"]] };
const dataset = { type: "dataset", id: "data-1", labels: ["Trial 1", "Trial 2"], series: [{ name: "Temperature", unit: "°C", values: [22, 24] }] };
const graph = { type: "graph", id: "graph-1", graphType: "line", xAxis: { label: "Time", unit: "min", min: 0, max: 10 }, yAxis: { label: "Temperature", unit: "°C", min: 0, max: 100 }, series: [{ name: "Water", points: [{ x: 0, y: 20 }, { x: 10, y: 80 }] }] };
const diagram = { type: "diagram", id: "diagram-1", width: 200, height: 120, primitives: [{ type: "line", x1: 10, y1: 80, x2: 190, y2: 80, label: "base" }, { type: "label", x: 80, y: 105, text: "Figure A" }] };

test("legacy questions may have no stimulus", () => assert.deepEqual(validateQuestionStimuli(undefined, []), []));
test("valid original passage validates", () => assert.deepEqual(validateStimulus(passage), []));
test("valid bounded table validates", () => assert.deepEqual(validateStimulus(table), []));
test("oversized table fails", () => assert.match(validateStimulus({ ...table, rows: Array.from({ length: RICH_CONTENT_LIMITS.tableRows + 1 }, () => ["a", "b"]) }).join(" "), /rows/));
test("valid labelled dataset with units validates", () => assert.deepEqual(validateStimulus(dataset), []));
test("dataset missing units fails", () => assert.match(validateStimulus({ ...dataset, series: [{ name: "Temperature", unit: "", values: [22, 24] }] }).join(" "), /units/));
test("valid graph specification validates", () => assert.deepEqual(validateStimulus(graph), []));
test("graph point outside declared axes fails", () => assert.match(validateStimulus({ ...graph, series: [{ name: "Water", points: [{ x: 12, y: 20 }] }] }).join(" "), /points/));
test("arbitrary SVG, HTML, script and javascript URLs are rejected", () => {
  for (const content of ["<svg onload=alert(1)>", "<script>alert(1)</script>", "<iframe src=x>", "<object data=x>", "<img src=x onerror=alert(1)>", "<div onclick=alert(1)>x</div>", "javascript:alert(1)", "onload=alert(1)"]) {
    assert.notDeepEqual(validateStimulus({ ...passage, content }), []);
  }
});
test("legitimate inequalities and harmless technical prose remain valid", () => {
  assert.equal(isSafeEducationalText("Solve x < 5 and explain why x > -2.", 200), true);
  assert.equal(isSafeEducationalText("The word onclick names an event handler in web programming.", 200), true);
});
test("valid declarative diagram validates", () => assert.deepEqual(validateStimulus(diagram), []));
test("invalid diagram coordinates and primitives fail", () => {
  assert.match(validateStimulus({ ...diagram, primitives: [{ type: "line", x1: -1, y1: 0, x2: 2, y2: 2 }] }).join(" "), /primitive/);
  assert.match(validateStimulus({ ...diagram, primitives: [{ type: "image", href: "javascript:alert(1)" }] }).join(" "), /primitive/);
});
test("stimulus not permitted by canonical family/profile fails", () => assert.match(validateQuestionStimuli([passage], ["table"]).join(" "), /not permitted/));
test("stimulus count and aggregate serialized size are bounded", () => {
  assert.match(validateQuestionStimuli(Array.from({ length: 4 }, (_, index) => ({ ...passage, id: `p-${index}` })), ["passage"]).join(" "), /count/);
  assert.match(validateQuestionStimuli([{ ...passage, content: "x".repeat(RICH_CONTENT_LIMITS.serializedCharactersPerQuestion) }], ["passage"]).join(" "), /oversized/);
});
test("provider stimulus schema shares canonical discriminators and quantitative limits", () => {
  const serialized = JSON.stringify(richStimuliArrayJsonSchema());
  assert.match(serialized, new RegExp(`"maxItems":${RICH_CONTENT_LIMITS.stimuliPerQuestion}`));
  for (const type of ["passage", "extract", "table", "dataset", "graph", "diagram"]) assert.match(serialized, new RegExp(`"const":"${type}"`));
  for (const limit of [RICH_CONTENT_LIMITS.tableColumns, RICH_CONTENT_LIMITS.tableRows, RICH_CONTENT_LIMITS.datasetSeries, RICH_CONTENT_LIMITS.datasetValuesPerSeries, RICH_CONTENT_LIMITS.graphSeries, RICH_CONTENT_LIMITS.graphPointsPerSeries, RICH_CONTENT_LIMITS.diagramPrimitives]) assert.match(serialized, new RegExp(`"maxItems":${limit}`));
  assert.match(serialized, new RegExp(`"maxLength":${RICH_CONTENT_LIMITS.passageCharacters}`));
  assert.match(serialized, new RegExp(`"maximum":${RICH_CONTENT_LIMITS.coordinateMagnitude}`));
  assert.match(serialized, /"provenance"/);
  assert.doesNotMatch(serialized, /"additionalProperties":true/);
});
test("unsupported and quantitatively oversized stimuli fail canonicalization", () => {
  assert.match(validateQuestionStimuli([{ type: "map", id: "map-1" }], ["graph"]).join(" "), /unsupported|not permitted/);
  assert.match(validateStimulus({ ...passage, content: "x".repeat(RICH_CONTENT_LIMITS.passageCharacters + 1) }).join(" "), /empty, unsafe, or oversized/);
  assert.match(validateStimulus({ ...dataset, labels: Array.from({ length: RICH_CONTENT_LIMITS.datasetValuesPerSeries + 1 }, (_, index) => String(index)) }).join(" "), /labels/);
  assert.match(validateStimulus({ ...graph, series: Array.from({ length: RICH_CONTENT_LIMITS.graphSeries + 1 }, (_, index) => ({ name: String(index), points: [{ x: 0, y: 20 }] })) }).join(" "), /series/);
  assert.match(validateStimulus({ ...diagram, primitives: Array.from({ length: RICH_CONTENT_LIMITS.diagramPrimitives + 1 }, () => ({ type: "label", x: 1, y: 1, text: "x" })) }).join(" "), /primitive count/);
  assert.match(validateStimulus({ ...graph, xAxis: { ...graph.xAxis, max: RICH_CONTENT_LIMITS.coordinateMagnitude + 1 } }).join(" "), /axes/);
});
test("authorized textbook provenance is bounded and identifier-only", () => {
  assert.deepEqual(validateStimulus({ ...passage, sourceType: "authorized_textbook", provenance: { textbookId: "book-1", documentId: "doc-1", chunkIds: ["chunk-1"] } }), []);
  assert.match(validateStimulus({ ...passage, sourceType: "authorized_textbook", provenance: { url: "https://example.test/private.pdf" } }).join(" "), /provenance/);
});
test("profile and family capabilities are intersected", () => {
  assert.deepEqual(allowedStimulusTypes("comprehension", ["passage", "table"]), ["passage"]);
  assert.deepEqual(allowedStimulusTypes("short_response", ["passage", "table"]), []);
});

test("numerical method marks total exactly", () => assert.deepEqual(validateNumericalMethod({ finalAnswer: "12 cm", methodSteps: [{ step: "Substitutes 3 × 4", marks: 1 }], accuracyMarks: 1, units: "cm" }, 2), []));
test("invalid numerical total fails", () => assert.match(validateNumericalMethod({ finalAnswer: "12 cm", methodSteps: [{ step: "Substitutes 3 × 4", marks: 1 }], accuracyMarks: 0 }, 2).join(" "), /total/));
for (const model of ["essay_rubric", "composition_rubric", "practical_rubric"] as const) {
  test(`${model} criteria total exactly`, () => {
    assert.deepEqual(validateRubricCriteria([{ criterion: "Relevance", descriptor: "Develops relevant ideas with supporting detail.", marks: 2 }, { criterion: "Organisation", descriptor: "Sequences ideas coherently and uses effective transitions.", marks: 2 }], 4), []);
    assert.deepEqual(allowedMarkingModels(model === "composition_rubric" ? "creative_composition" : model === "practical_rubric" ? "practical_observation" : "extended_response", "mixed"), [model]);
  });
}
test("empty, generic and duplicate rubric criteria fail", () => {
  assert.match(validateRubricCriteria([{ criterion: "Criterion 1", descriptor: "Answer", marks: 2 }], 2).join(" "), /substantive/);
  assert.match(validateRubricCriteria([{ criterion: "Ideas", descriptor: "Develops relevant ideas.", marks: 1 }, { criterion: "ideas", descriptor: "Adds supporting detail.", marks: 1 }], 2).join(" "), /unique/);
});
test("unsafe markup is rejected in rubric criteria and numerical steps", () => {
  assert.match(validateRubricCriteria([{ criterion: "Ideas", descriptor: "<img src=x onerror=alert(1)>", marks: 2 }], 2).join(" "), /substantive/);
  assert.match(validateNumericalMethod({ finalAnswer: "12 cm", methodSteps: [{ step: "<div onclick=alert(1)>working</div>", marks: 1 }], accuracyMarks: 1 }, 2).join(" "), /substantive/);
});
