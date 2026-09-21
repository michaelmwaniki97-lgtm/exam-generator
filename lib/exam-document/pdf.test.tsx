import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ExamDocumentView } from "../../components/exam-document/exam-document.tsx";
import { MarkingDocumentView } from "../../components/exam-document/marking-document.tsx";
import { renderExamPdf } from "./pdf.tsx";
import { richDocument, modernInput } from "./fixtures.ts";
import { buildExamDocument } from "./model.ts";
import { createOfflineProductionExam, offlineMarkingDocument, offlineStudentDocument } from "../ai/offline-production-pipeline.fixture.ts";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

async function pdfPageTexts(buffer:Buffer):Promise<string[]> { const pdf=await getDocument({data:new Uint8Array(buffer),standardFontDataUrl:`${process.cwd()}/node_modules/pdfjs-dist/standard_fonts/`}).promise;const pages:string[]=[];for(let number=1;number<=pdf.numPages;number++){const page=await pdf.getPage(number);const content=await page.getTextContent();pages.push(content.items.map(item=>"str" in item?item.str:"").join(" ").replace(/\s+/g," "))}return pages; }

test("saved inline-data failure renders student and marking PDFs with the real answer", async () => {
  const { documentInput } = await createOfflineProductionExam(true);
  for (const mode of ["student", "marking"] as const) {
    const pdf = await renderExamPdf(buildExamDocument(documentInput, mode));
    assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
    const text = (await pdfPageTexts(pdf)).join(" ");
    assert.match(text, mode === "student" ? /14, 19, 11, 22, 24/ : /18 pawpaws per day/);
  }
});
async function renderWithoutPaginationWarnings(document:ReturnType<typeof richDocument>|ReturnType<typeof buildExamDocument>){const messages:string[]=[];const warn=console.warn;const error=console.error;console.warn=(...values:unknown[])=>messages.push(values.join(" "));console.error=(...values:unknown[])=>messages.push(values.join(" "));try{const pdf=await renderExamPdf(document);return {pdf,messages}}finally{console.warn=warn;console.error=error}}
function maximumRubricDocument(){const input=modernInput();const marks=[3,3,3,3,2,2,2,2];(input.markingContent as {entries:Array<Record<string,unknown>>}).entries[1]={slotId:"slot-2",number:2,markingModel:"practical_rubric",marking_notes:"Accept equivalent evidence.",marks:20,rubric:marks.map((mark,index)=>({criterion:`Criterion ${index+1} substantive`,descriptor:(`Descriptor ${index+1} explains detailed observable evidence expected from the learner. `).repeat(12).slice(0,790),marks:mark}))};return buildExamDocument(input,"marking")}

test("professional web preview renders rich content and exact marks",()=>{const html=renderToStaticMarkup(<ExamDocumentView document={richDocument()}/>);for(const text of ["Reading passage","Recorded values","Value against time","Measurements","Simple apparatus","[10 marks]","END"])assert.match(html,new RegExp(text));assert.doesNotMatch(html,/private-chunk|textbookId|documentId/)});
test("student documents identify themselves as teacher-generated even without a KJSEA notice",()=>{const document=richDocument();document.authorityNotice=null;const html=renderToStaticMarkup(<ExamDocumentView document={document}/>);assert.match(html,/Teacher-generated assessment/);});
test("marking preview renders numerical and practical marking models",()=>{const html=renderToStaticMarkup(<MarkingDocumentView document={richDocument("marking")}/>);for(const text of ["numerical method","Expected answer","practical rubric","Observation","Interpretation"])assert.match(html,new RegExp(text,"i"))});
test("student PDF output is non-empty and valid",async()=>{const pdf=await renderExamPdf(richDocument());assert.ok(pdf.length>1_000);assert.equal(pdf.subarray(0,4).toString(),"%PDF")});
test("marking PDF is non-empty, valid, and distinct",async()=>{const student=await renderExamPdf(richDocument());const marking=await renderExamPdf(richDocument("marking"));assert.equal(marking.subarray(0,4).toString(),"%PDF");assert.notDeepEqual(marking,student)});
test("maximum valid rubric flows across pages without overflow warnings or data loss",async()=>{const {pdf,messages}=await renderWithoutPaginationWarnings(maximumRubricDocument());assert.equal(pdf.subarray(0,4).toString(),"%PDF");assert.doesNotMatch(messages.join("\n"),/can't wrap|bigger than available page height/i);const pages=await pdfPageTexts(pdf);assert.ok(pages.length>1);const text=pages.join(" ");for(let index=1;index<=8;index++){assert.match(text,new RegExp(`Criterion ${index} substantive`));assert.match(text,new RegExp(`Descriptor ${index} explains`))}});
test("section heading stays with the meaningful beginning of its first question",async()=>{const pages=await pdfPageTexts(await renderExamPdf(richDocument()));const page=pages.find(text=>text.includes("BIOLOGY AND PHYSICS PRACTICAL SKILLS"));assert.ok(page);assert.match(page,/Use the dataset and diagram to explain the result/)});
test("long passage remains flowing and complete",async()=>{const document=structuredClone(richDocument());const passage=document.sections[0].questions[0].stimuli?.find(item=>item.type==="passage");if(!passage||passage.type!=="passage")assert.fail("passage fixture missing");passage.content=`${"A complete educational paragraph for page flow. ".repeat(100)} FINALPASSAGEEND`;const {pdf,messages}=await renderWithoutPaginationWarnings(document);assert.doesNotMatch(messages.join("\n"),/can't wrap|bigger than available page height/i);const pages=await pdfPageTexts(pdf);assert.ok(pages.length>1);assert.match(pages.join(" "),/FINALPASSAGEEND/)});
test("ordinary short marking entries remain compact",async()=>{const {pdf,messages}=await renderWithoutPaginationWarnings(richDocument("marking"));assert.doesNotMatch(messages.join("\n"),/can't wrap|bigger than available page height/i);assert.ok((await pdfPageTexts(pdf)).length<=2)});


test("new question visuals appear in browser and PDF beside their question", async () => {
  const document = structuredClone(richDocument());
  const q = document.sections[0].questions[0];
  q.stimuli = [];
  q.text = "Use the number line to identify point A.";
  q.visual = { type: "diagram", required: true, altText: "Number line with point A", specification: { diagramType: "number_line", min: -5, max: 5, step: 1, points: [{ value: 2, label: "A" }] } };
  const html = renderToStaticMarkup(<ExamDocumentView document={document}/>);
  assert.match(html, /Number line with point A/);
  assert.match(html, /<polygon/);
  assert.doesNotMatch(html, /#1d4ed8|#b91c1c|linearGradient/);
  const { pdf, messages } = await renderWithoutPaginationWarnings(document);
  assert.doesNotMatch(messages.join(" "), /can't wrap|bigger than available page height/i);
  const pages = await pdfPageTexts(pdf);
  const page = pages.find(text => text.includes("identify point A"));
  assert.ok(page);
  assert.match(page, /-5/);
});


test("short visual questions and their labels stay together across page boundaries", async () => {
  const document = structuredClone(richDocument());
  const original = document.sections[0].questions[0];
  document.sections = [{ ...document.sections[0], questions: Array.from({ length: 5 }, (_, i) => ({ ...original, slotId: `visual-${i}`, number: i+1, text: `Read the chart for experiment ${i+1}.`, stimuli: [], visual: { type: "graph" as const, required: true, specification: { graphType: "line" as const, xAxis: { label: `Time${i+1}`, unit: "s", min: 0, max: 10 }, yAxis: { label: "Distance", unit: "m", min: 0, max: 10 }, series: [{ name: "Motion", points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] }] } } })) }];
  const { pdf, messages } = await renderWithoutPaginationWarnings(document);
  assert.equal(messages.length, 0, messages.join(" "));
  const pages = await pdfPageTexts(pdf);
  for (let i=1;i<=5;i++) assert.ok(pages.some(p => p.includes(`experiment ${i}`) && p.includes(`Time${i}`)));
});


test("offline Grade 8 production fixture renders validated student and marking PDFs", async () => {
  const student = await renderExamPdf(await offlineStudentDocument());
  const marking = await renderExamPdf(await offlineMarkingDocument());
  assert.equal(student.subarray(0, 4).toString(), "%PDF");
  assert.equal(marking.subarray(0, 4).toString(), "%PDF");
  assert.notDeepEqual(student, marking);
});
