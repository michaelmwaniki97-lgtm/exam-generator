import type { ExamDocument, ExamDocumentInput } from "./model.ts";
import type { ExamQuestion, MarkingSchemeEntry } from "../ai/generation-core.ts";

export const richQuestion: ExamQuestion = {
  slotId:"slot-1",number:1,sectionId:"section-a",curriculumIds:["topic-1"],topic:"Data",text:"Study the resources and answer the question.",marks:10,questionFamily:"rich_application_task",type:"problem_solving",cognitiveDemand:"APPLICATION",constraintAcknowledgements:[],
  stimuli:[
    {type:"passage",id:"passage-1",title:"Reading passage",content:"A learner recorded observations carefully.\nThe results are shown below.",sourceType:"generated"},
    {type:"table",id:"table-1",caption:"Recorded values",columns:["Time (s)","Value"],rows:[["0","2"],["1","4"]]},
    {type:"graph",id:"graph-1",title:"Value against time",graphType:"line",xAxis:{label:"Time",unit:"s",min:0,max:2},yAxis:{label:"Value",unit:"units",min:0,max:6},series:[{name:"Observation",points:[{x:0,y:2},{x:1,y:4},{x:2,y:5}]}]},
  ]
};
export const secondQuestion: ExamQuestion = {slotId:"slot-2",number:2,sectionId:"section-b",curriculumIds:["topic-2"],topic:"Measurement",text:"Use the dataset and diagram to explain the result.",marks:20,questionFamily:"practical_interpretation",type:"practical_task",cognitiveDemand:"REASONING",constraintAcknowledgements:[],stimuli:[
  {type:"dataset",id:"dataset-1",title:"Measurements",labels:["A","B"],series:[{name:"Length",unit:"cm",values:[2,4]}]},
  {type:"diagram",id:"diagram-1",title:"Simple apparatus",caption:"A labelled arrangement",width:200,height:100,primitives:[{type:"rectangle",x:20,y:20,width:70,height:50,label:"Container"},{type:"arrow",x1:100,y1:45,x2:160,y2:45,label:"Flow"},{type:"label",x:25,y:15,text:"A"}]}
]};
export const markingEntries: MarkingSchemeEntry[] = [
  {slotId:"slot-1",number:1,markingModel:"numerical_method",marking_notes:"Award marks for a valid method.",marks:10,numericalMethod:{finalAnswer:"5",methodSteps:[{step:"Reads the supplied values correctly",marks:4},{step:"Uses the stated relationship",marks:4}],accuracyMarks:2,units:"units",tolerance:"Exact"}},
  {slotId:"slot-2",number:2,markingModel:"practical_rubric",marking_notes:"Accept equivalent scientific wording.",marks:20,rubric:[{criterion:"Observation",descriptor:"Records the supplied measurements accurately.",marks:8},{criterion:"Interpretation",descriptor:"Explains the pattern using the presented resource.",marks:12}]}
];

export function modernInput(overrides:Partial<ExamDocumentInput>={}):ExamDocumentInput {
  const profile={profileId:"kjsea-905-2",ruleStatus:"OFFICIAL_VERIFIED",paper:{paperCode:"905/2",totalMarks:30,durationMinutes:60},sections:[{id:"section-a",marks:null},{id:"section-b",marks:null}]};
  const blueprint={durationMinutes:60,totalMarks:30,assessmentType:{id:"kjsea_practice",label:"KJSEA Practice"},examStructure:{structureOrigin:"KJSEA_STYLE_PRACTICE"},component:{paperCode:"905/2",displayName:"Integrated Science Paper 2"},assessmentProfile:profile,sections:[{id:"section-a",instructions:["Answer this question."],markAuthority:"GENERATION_FLEXIBLE",targetMarks:10},{id:"section-b",instructions:[],markAuthority:"GENERATION_FLEXIBLE",targetMarks:20}],questionSlots:[]};
  return {id:"11111111-1111-4111-8111-111111111111",examType:"KJSEA Practice",marks:30,duration:60,term:"Term 1",year:2026,school:"Example School",content:{instructions:"Answer all questions.\nShow your working.",sections:[{id:"section-a",title:"Chemistry Practical Skills",questions:[structuredClone(richQuestion)]},{id:"section-b",title:"Biology and Physics Practical Skills",questions:[structuredClone(secondQuestion)]}],meta:{level:"Junior School",subjectName:"Integrated Science",gradeName:"Grade 9",blueprint}},markingContent:{entries:structuredClone(markingEntries)},...overrides};
}
export function richDocument(kind:"student"|"marking"="student"):ExamDocument { return {id:"fixture",kind,school:"Example School",title:"KJSEA Practice — 905/2",assessmentLabel:"KJSEA Practice",subject:"Integrated Science",grade:"Grade 9",level:"Junior School",term:"Term 1",year:2026,durationMinutes:60,totalMarks:30,component:"Integrated Science Paper 2",paperCode:"905/2",instructions:["Answer all questions.","Show your working."],compactCandidateFields:false,authorityNotice:"School-generated KJSEA-style practice material. This paper is not issued or endorsed by KNEC.",sections:[{id:"section-a",title:"Chemistry Practical Skills",instructions:["Answer this question."],questions:[richQuestion],marks:10,markAuthority:"GENERATION_FLEXIBLE",displaySectionMarks:false},{id:"section-b",title:"Biology and Physics Practical Skills",instructions:[],questions:[secondQuestion],marks:20,markAuthority:"GENERATION_FLEXIBLE",displaySectionMarks:false}],markingEntries}; }
