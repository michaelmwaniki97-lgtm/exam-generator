/** Compact, generalized conventions distilled from development-only Kenyan papers.
 * No reference-paper text, files, paths, or retrieval is included at runtime. */
export type KenyanAssessmentStyle = {
  id: string;
  shared: readonly string[];
  level: readonly string[];
  subject: readonly string[];
  examType: readonly string[];
  marking: readonly string[];
  visual: readonly string[];
  progression: readonly string[];
};

const shared = [
  "Write an original teacher-generated Kenyan assessment; never present it as official KNEC material.",
  "Use direct command verbs and British English where English is used. Show marks at the end of each question or subpart.",
  "Use consistent hierarchical numbering only when a question genuinely needs parts: 1., (a), (i). Do not create artificial subparts.",
  "Keep questions answerable from selected curriculum and supplied context. Use Kenyan settings, KSh and metric units only where relevant.",
] as const;

const levels = {
  grade6: ["Use short, accessible instructions and familiar contexts. Prioritize one clear task at a time and age-appropriate reading load."],
  junior: ["Use competency-oriented application, interpretation, investigation and explanation where curriculum supports it. Increase demand within a structured question."],
  secondary: ["Use clear KCSE-style school-paper structure appropriate to the selected component. Separate theory, practical and alternative-to-practical tasks when the blueprint does."],
} as const;

const subjects: Record<string, readonly string[]> = {
  mathematics: ["Require necessary working for calculations. Use exact, realistic numbers and units. Prefer calculations, geometry, coordinate grids, tables and graphs only where they assess the selected skill."],
  "integrated science": ["Use observation, variables, data, graphs, inference, calculation and safety where relevant. State all apparatus, results and units needed to answer."],
  biology: ["Progress from knowledge and observation to interpretation, diagrams, data and explanation. Use scientifically valid results and only supplied apparatus."],
  chemistry: ["State conditions, quantities, formulae and units needed for calculations. Use valid laboratory contexts and safety-aware questions."],
  physics: ["Use measurements, diagrams, data, calculations and explanation with coherent SI units and supplied information."],
  english: ["Match the selected paper with reading, grammar/language, functional writing, composition or literature. Supply original passages and use a rubric for extended writing."],
  kiswahili: ["Use idiomatic standard Kiswahili. Match lugha, ufahamu, fasihi and insha tasks to the selected component; do not translate English phrasing literally."],
  geography: ["Use structured explanations, data, maps or diagrams only when complete scale, key, north direction or data is supplied as needed."],
  agriculture: ["Use practical farm contexts, production, husbandry, soils, crops, economics and safety. Make seasonal or farm assumptions explicit."],
  "business studies": ["Use concise, realistic Kenyan enterprise, records, transaction and calculation contexts with dates and KSh amounts when relevant."],
  "computer studies": ["Use concepts, scenarios, algorithms, systems and data tasks. Practical work may only name files or resources actually supplied in the question."],
  "pre-technical studies": ["Use safe, practical contexts, labelled system representations and stepwise application questions only where resources are fully described."],
};

const examTypes: Record<string, readonly string[]> = {
  quiz: ["Keep scope narrow and avoid long sections or extended writing unless the teacher explicitly requested it."],
  cat: ["Use a compact, focused paper with proportional marks and a balanced but limited range of item types."],
  midterm: ["Cover taught selected content with a clear progression from routine to application."],
  end_term: ["Sample selected strands broadly and progress from routine recall toward application and reasoning."],
  revision_test: ["Use varied selected content without reproducing or paraphrasing source-paper questions."],
  mock: ["Use a coherent full-paper practice structure while retaining teacher-generated identity and selected-topic scope."],
  kjsea_practice: ["Follow the application-defined verified component structure exactly; do not add unofficial KNEC claims or branding."],
};

export function normalizeStyleSubject(subjectName: string): string {
  return subjectName.trim().toLowerCase().replace(/\s+/g, " ");
}

export function composeKenyanAssessmentStyle(input: { gradeName: string; level: string; subjectName: string; examType: string }): KenyanAssessmentStyle {
  const grade = input.gradeName.toLowerCase();
  const level = grade.includes("grade 6") ? levels.grade6 : grade.includes("grade") || input.level.toLowerCase().includes("junior") ? levels.junior : levels.secondary;
  const subjectKey = normalizeStyleSubject(input.subjectName);
  const subject = subjects[subjectKey] ?? ["Use the question families and command verbs appropriate to the selected subject and curriculum."];
  const type = examTypes[input.examType.toLowerCase().replace(/\s+/g, "_")] ?? ["Use the teacher-selected scope, marks and duration; do not imply an official examination format."];
  return {
    id: `${grade.includes("grade 6") ? "grade6" : grade.includes("grade") ? "junior" : "secondary"}-${subjectKey.replace(/[^a-z0-9]+/g, "-")}-${input.examType.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    shared, level, subject, examType: type,
    marking: ["Mirror question and subpart numbering. Allocate every mark to a concrete answer point; accept valid alternatives. Give method and accuracy marks for calculations, units where relevant, and analytic rubrics for extended writing."],
    visual: ["Add a visual only when it is required or materially helps the task. It must use the validated data/specification contract, be black-and-white and fully answerable; labels must not reveal the answer."],
    progression: ["Across a section, use the blueprint cognitive demand to move from routine recall toward application and reasoning without making early questions depend on later questions."],
  };
}

export function stylePrompt(style: KenyanAssessmentStyle): string {
  const rules = [...style.shared, ...style.level, ...style.subject, ...style.examType, ...style.marking, ...style.visual, ...style.progression];
  return `KENYAN_ASSESSMENT_STYLE_PROFILE=${style.id}\nSTYLE_RULES=${JSON.stringify(rules)}`;
}
