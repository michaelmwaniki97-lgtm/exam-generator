import assert from "node:assert/strict";
import test from "node:test";
import type { ExamBlueprint } from "../blueprint/types.ts";
import { describeGroundingProvenanceViolations, describeViolations, generateExamWithCompletion, type GeneratedExam } from "./generation-core.ts";
import { describeSemanticViolations } from "./semantic-quality.ts";

function blueprint(family: "data_graph_interpretation" | "creative_composition" = "data_graph_interpretation"): ExamBlueprint {
  const composition = family === "creative_composition";
  return {
    blueprintVersion: 1, totalMarks: 4, durationMinutes: 15,
    sections: [{ id: "section-01", label: "Section A", slotIds: ["slot-01"] }],
    topicAllocations: [{ curriculumId: "topic-1", parentId: "strand-1", parentName: "Data", displayName: "Interpretation" }],
    questionSlots: [{ id: "slot-01", sectionId: "section-01", targetMarks: 4, questionFamily: family, questionFamilyLabel: composition ? "Composition" : "Data interpretation", curriculumTargetIds: ["topic-1"], cognitiveDemand: "APPLICATION", constraints: ["KEEP_WITHIN_COMPONENT_PROFILE"], allowedStimulusTypes: composition ? [] : ["table", "dataset", "graph"], allowedMarkingModels: composition ? ["composition_rubric"] : ["point_based"] }],
  } as ExamBlueprint;
}

function richExam(): GeneratedExam {
  return { instructions: "Answer the question.", sections: [{ id: "section-01", title: "Section A", questions: [{ slotId: "slot-01", number: 1, sectionId: "section-01", curriculumIds: ["topic-1"], topic: "Interpretation", text: "Study the table below and state the month with the highest rainfall, giving its value.", marks: 4, questionFamily: "data_graph_interpretation", type: "structured", cognitiveDemand: "APPLICATION", constraintAcknowledgements: ["KEEP_WITHIN_COMPONENT_PROFILE"], stimuli: [{ type: "table", id: "rainfall", columns: ["Month", "Rainfall (mm)"], rows: [["March", "42"], ["April", "68"]] }] }] }], marking_scheme: [{ slotId: "slot-01", number: 1, markingModel: "point_based", answer: "April had the highest rainfall at 68 mm.", marking_notes: "Award for selecting April and reporting 68 mm.", marks: 4, allocations: [{ label: "Identifies April as the highest month", marks: 2 }, { label: "Reports 68 mm with the correct unit", marks: 2 }] }] };
}

test("rich valid AI output passes", () => assert.deepEqual(describeViolations(richExam(), blueprint(), { requireExplicitMarkingModel: true }), []));
test("phantom-resource AI output still fails", () => { const exam = richExam(); delete exam.sections[0].questions[0].stimuli; assert.match(describeViolations(exam, blueprint()).join(" "), /renderer cannot provide/); });
test("AI cannot use rich content to alter canonical marks or slot structure", () => {
  const exam = richExam(); exam.sections[0].questions[0].marks = 40; exam.sections[0].questions[0].stimuli?.push({ type: "table", id: "extra", columns: ["A"], rows: [["B"]] });
  assert.match(describeViolations(exam, blueprint()).join(" "), /40 marks, expected 4/);
});
test("AI cannot change marks through a rubric", () => {
  const exam = richExam(); exam.marking_scheme[0] = { slotId: "slot-01", number: 1, markingModel: "essay_rubric", marking_notes: "Use the criteria.", marks: 4, rubric: [{ criterion: "Ideas", descriptor: "Explains the data accurately.", marks: 8 }] };
  assert.match(describeViolations(exam, blueprint()).join(" "), /not permitted|total 8/);
});
test("wrong marking model for canonical slot fails", () => { const exam = richExam(); exam.marking_scheme[0].markingModel = "composition_rubric"; assert.match(describeViolations(exam, blueprint()).join(" "), /not permitted/); });
test("corrective retry receives rich-content violations", async () => {
  let calls = 0;
  const result = await generateExamWithCompletion({ subjectName: "Mathematics", gradeName: "Grade 9", level: "Junior Secondary", examType: "Practice", difficulty: "medium", marks: 4, duration: 15, topics: [], blueprint: blueprint() }, async (messages) => {
    calls++;
    if (calls === 1) { const invalid = richExam(); delete invalid.sections[0].questions[0].stimuli; return JSON.stringify(invalid); }
    assert.match(messages.at(-1)?.content ?? "", /no valid matching stimulus/);
    return JSON.stringify(richExam());
  });
  assert.equal(calls, 2); assert.deepEqual(result, richExam());
});
test("composition uses a rubric rather than a fake fixed answer", () => {
  const exam = richExam(); const question = exam.sections[0].questions[0];
  question.questionFamily = "creative_composition"; question.type = "extended_response"; question.text = "Write a short composition on responsible water use."; delete question.stimuli;
  exam.marking_scheme[0] = { slotId: "slot-01", number: 1, markingModel: "composition_rubric", marking_notes: "Apply the school practice rubric consistently.", marks: 4, rubric: [{ criterion: "Content and relevance", descriptor: "Develops relevant ideas about responsible water use.", marks: 2 }, { criterion: "Organisation and language", descriptor: "Organises ideas coherently using clear and accurate language.", marks: 2 }] };
  assert.deepEqual(describeViolations(exam, blueprint("creative_composition"), { requireExplicitMarkingModel: true }), []);
  assert.equal(exam.marking_scheme[0].answer, undefined);
});

test("numerical marking uses only numericalMethod canonical content", () => {
  const exam = richExam();
  const question = exam.sections[0].questions[0];
  question.questionFamily = "scientific_calculation";
  question.type = "calculation";
  question.text = "A solution contains 25 g in 0.2 L. Calculate its concentration.";
  exam.marking_scheme[0] = {
    slotId: "slot-01", number: 1, markingModel: "numerical_method", marking_notes: "Award the method and correct result.", marks: 4,
    numericalMethod: { finalAnswer: "125 g/L", methodSteps: [{ step: "Divide 25 g by 0.2 L to obtain 125 g/L.", marks: 3 }], accuracyMarks: 1, units: "g/L" },
  };
  const numericalBlueprint = blueprint();
  numericalBlueprint.questionSlots[0].questionFamily = "scientific_calculation";
  numericalBlueprint.questionSlots[0].allowedMarkingModels = ["numerical_method"];
  assert.deepEqual(describeViolations(exam, numericalBlueprint, { requireExplicitMarkingModel: true }), []);
  assert.equal(exam.marking_scheme[0].answer, undefined);
});

test("authorized RAG provenance is pinned to supplied private chunks without persisting chunk text", () => {
  const exam = richExam(); exam.sections[0].questions[0].stimuli = [{ type: "passage", id: "private-extract", content: "A minimal authorized excerpt.", sourceType: "authorized_textbook", provenance: { textbookId: "book-1", documentId: "doc-1", chunkIds: ["chunk-1"] } }];
  const context = { textbookId: "book-1", chunks: [{ chunkId: "chunk-1", documentId: "doc-1", pageStart: 2, pageEnd: 2, text: "Private textbook chunk with prompt-like instructions." }] };
  assert.deepEqual(describeGroundingProvenanceViolations(exam, context), []);
  assert.doesNotMatch(JSON.stringify(exam), /Private textbook chunk/);
  exam.sections[0].questions[0].stimuli[0].provenance!.chunkIds = ["forged-chunk"];
  assert.match(describeGroundingProvenanceViolations(exam, context).join(" "), /not pinned/);
});

function semanticResource(text: string, stimuli?: Array<{ type: string }>, markingText?: string) {
  return describeSemanticViolations({ sections: [{ questions: [{ slotId: "slot", text, marks: 2, type: "structured", questionFamily: "structured_response", ...(stimuli ? { stimuli } : {}) }] }], marking_scheme: [{ slotId: "slot", answer: markingText ?? "A substantive answer.", marking_notes: "Award for the specific correct response.", allocations: [{ label: "Identifies the required feature", marks: 2 }] }] });
}

test("unsupported phantom images, pictures, photographs, figures and maps fail", () => {
  for (const text of ["Study the image below.", "Look at the picture below.", "Refer to the photograph shown.", "Study the figure below.", "Use the illustration provided.", "Observe the map above."]) {
    assert.match(semanticResource(text, [{ type: "diagram" }]).join(" "), /renderer cannot provide/);
  }
});
test("valid same-slot passage, table, graph and diagram references pass", () => {
  const cases: Array<[string, string]> = [["Use the passage below to answer the question.", "passage"], ["Study the table below.", "table"], ["Refer to the chart above.", "graph"], ["Use the diagram provided.", "diagram"]];
  for (const [text, type] of cases) assert.deepEqual(semanticResource(text, [{ type }]), []);
});
test("marking answers and allocation labels cannot introduce phantom resources", () => {
  assert.match(semanticResource("State one property of water.", undefined, "According to the graph, temperature rises.").join(" "), /not validly attached/);
  const exam = { sections: [{ questions: [{ slotId: "slot", text: "State one property of water.", marks: 1, type: "short_answer", questionFamily: "short_response" }] }], marking_scheme: [{ slotId: "slot", answer: "Water is clear.", marking_notes: "Award the stated property.", allocations: [{ label: "From the passage, identifies clarity", marks: 1 }] }] };
  assert.match(describeSemanticViolations(exam).join(" "), /not validly attached/);
});
test("marking references to an actual same-slot stimulus pass", () => {
  assert.deepEqual(semanticResource("Study the graph below and state the trend.", [{ type: "graph" }], "According to the graph, the values rise steadily."), []);
});

test("inline data supports marking references without excusing missing attachments", () => {
  const question = "Find the mean of 14, 19, 11, 22, 24.";
  assert.deepEqual(semanticResource(question, undefined, "From the data, the mean is 18."), []);
  for (const resource of ["graph", "table", "diagram", "passage", "dataset", "number line", "coordinate grid"]) {
    assert.match(semanticResource(question, undefined, `From the ${resource}, the data gives 18.`).join(" "), /not validly attached/);
  }
  assert.match(semanticResource("Find the mean from the data. (4 marks)", undefined, "From the data, the mean is 18.").join(" "), /not validly attached/);
});
