type SemanticQuestion = {
  slotId: string;
  text: string;
  marks: number;
  type: string;
  questionFamily: string;
  stimuli?: { type: string }[];
};

type SemanticMarkingEntry = {
  slotId?: string;
  answer?: string;
  marking_notes: string;
  allocations?: { label: string; marks: number }[];
  numericalMethod?: { finalAnswer?: string; methodSteps?: { step: string }[] };
  rubric?: { descriptor: string }[];
};

type SemanticExam = {
  sections: { questions: SemanticQuestion[] }[];
  marking_scheme: SemanticMarkingEntry[];
};

const RESOURCE_NOUN = "(?:graph|chart|diagram|image|picture|photo(?:graph)?|figure|illustration|table|map|passage|source extract|extract|case study|dataset|data|experiment(?:al)? setup)";
const DEPENDENT_RESOURCE_REFERENCE = new RegExp(
  `\\b(?:interpret|study|examine|refer to|use|using|look at|observe|according to|from)\\b[^.!?]{0,100}\\b${RESOURCE_NOUN}\\b|\\b${RESOURCE_NOUN}\\s+(?:below|above|shown|provided|given|illustrated|displayed|showing)\\b`,
  "i"
);
const MARKING_RESOURCE_REFERENCE = new RegExp(
  `\\b(?:from|according to|shown in|seen in|identif(?:y|ies|ying)|read(?:s|ing)? from|award[^.!?]{0,80}for)\\b[^.!?]{0,100}\\b${RESOURCE_NOUN}\\b|\\b${RESOURCE_NOUN}\\s+(?:shows|indicates|illustrates|demonstrates|shown|provided)\\b`,
  "i"
);
const MISSING_INFORMATION_REFERENCE = /\b(?:we|you|the (?:student|learner))\s+(?:need|must have)\s+to\s+know\b|\b(?:cannot|can't|unable to)\s+(?:calculate|determine|answer|solve)\b|\b(?:information|data|values?|details?)\s+(?:is|are)\s+(?:missing|not (?:given|provided|available))\b/i;
const PLACEHOLDER_ANSWER = /\b(?:to (?:calculate|solve|determine|answer) (?:this|the (?:question|problem))|use the (?:formula|equation)|the (?:student|learner) should|award marks? for correct|answer should include|response should include)\b/i;
const PLACEHOLDER_CRITERION = /^(?:correct (?:answer|working|method|response)|show(?:s|ing)? working|use(?:s| of)? (?:the )?(?:correct )?(?:formula|method)|answer|method|working|explanation|calculation|response|any valid answer)$/i;
const PERCENTAGE_COMPOSITION_TEMPLATE = /\b(?:empirical|molecular) formula\b[^.!?]{0,100}\b(?:given|using|from) (?:its|the|a) percentage composition\b/i;
const VAGUE_PROBLEM_TEMPLATE = /\bsolve (?:a|the) problem involving\b/i;
const PERCENTAGE_NITROGEN_TEMPLATE = /\bcalculate (?:the )?percentage of nitrogen\b/i;
const UNRESOLVED_GIVEN_REFERENCE = /\b(?:using|from)\s+(?:the\s+)?(?:data|values?|information|details?|results?|composition)(?=\s*(?:[,.!?]|$))|\bgiven\s+(?:its|the)\s+(?:data|values?|information|details?|results?|composition)\b|\b(?:data|values?|information|details?|results?|composition)\s+(?:given|provided|shown|above|below)\b/i;
const NUMERIC_VALUE = /(?:^|[^A-Za-z])[-+]?\d+(?:\.\d+)?\s*(?:%|°?[CFK]|mol|g|kg|mg|cm3|cm³|dm3|dm³|m3|m³|cm|mm|km|m|L|ml|kPa|Pa|atm|s|min|h)?\b/i;
const CHEMICAL_FORMULA = /\b(?:[A-Z][a-z]?\d+|[A-Z][a-z]?[A-Z][A-Za-z]*(?:\d+|\([A-Z][A-Za-z0-9]*\d)[A-Za-z0-9()]*)\b/;
const SYMBOLIC_GIVEN = /\b(?:in terms of|where\s+[a-z](?:\s*(?:,|and)\s*[a-z])+|variables?\s+[a-z])\b/i;

function hasConcreteGiven(text: string): boolean {
  return NUMERIC_VALUE.test(text) || CHEMICAL_FORMULA.test(text) || /\b(?:equation|formula)\s*[:=]\s*\S+/i.test(text) || SYMBOLIC_GIVEN.test(text);
}

function normalizedWords(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();
}

function isCalculationLike(question: SemanticQuestion): boolean {
  return question.type === "calculation" ||
    question.questionFamily.includes("calculation") ||
    question.questionFamily.includes("computation") ||
    /\b(?:calculate|compute|work out|determine the (?:mass|volume|percentage|concentration|amount|number))\b/i.test(question.text);
}

function hasRequiredStimulus(question: SemanticQuestion, text = question.text): boolean {
  const types = new Set((question.stimuli ?? []).map((stimulus) => stimulus.type));
  if (/\b(?:graph|chart)\b/i.test(text) && !types.has("graph")) return false;
  if (/\btable\b/i.test(text) && !types.has("table")) return false;
  if (/\bdataset\b/i.test(text) && !types.has("dataset")) return false;
  if (/\b(?:passage|source extract|extract)\b/i.test(text) && !types.has("passage") && !types.has("extract")) return false;
  if (/\b(?:diagram|experiment(?:al)? setup)\b/i.test(text) && !types.has("diagram")) return false;
  if (/\b(?:image|picture|photo(?:graph)?|figure|illustration|map)\b/i.test(text)) return false;
  if (/\bdata\b/i.test(text) && !types.has("dataset") && !types.has("table") && !types.has("graph")) return false;
  return types.size > 0;
}

export type SemanticValidationScope = {
  questionSlotIds: ReadonlySet<string>;
  answerSlotIds: ReadonlySet<string>;
  markingNotesSlotIds: ReadonlySet<string>;
  allocationSlotIds: ReadonlySet<string>;
  pairSlotIds: ReadonlySet<string>;
};

export function describeQuestionCompletenessViolations(questions: readonly SemanticQuestion[]): string[] {
  const violations: string[] = [];
  for (const question of questions) {
    const text = question.text.trim();
    const resourceReference = DEPENDENT_RESOURCE_REFERENCE.test(text);
    const inlineNumericData = /\bdata\b/i.test(text) && !/\b(?:graph|chart|diagram|image|figure|table|map|passage|extract|case study|dataset|experiment(?:al)? setup)\b/i.test(text) && hasConcreteGiven(text);
    if (resourceReference && !inlineNumericData && !hasRequiredStimulus(question)) {
      violations.push(`${question.slotId} references a graph, table, passage, data, or other stimulus that the renderer cannot provide because no valid matching stimulus is attached to that question`);
    }
    if (PERCENTAGE_COMPOSITION_TEMPLATE.test(text) && !/%/.test(text)) {
      violations.push(`${question.slotId} asks for an empirical or molecular formula from percentage composition but supplies no percentage values`);
    }
    if (VAGUE_PROBLEM_TEMPLATE.test(text) && !hasConcreteGiven(text)) {
      violations.push(`${question.slotId} describes a problem to solve but contains no actual problem or usable givens`);
    }
    if (PERCENTAGE_NITROGEN_TEMPLATE.test(text) && !hasConcreteGiven(text)) {
      violations.push(`${question.slotId} asks for percentage nitrogen but supplies no usable composition, mass, or chemical formula`);
    }
    if (isCalculationLike(question) && !hasConcreteGiven(text) && !hasRequiredStimulus(question)) {
      violations.push(`${question.slotId} is a calculation question but contains no usable numerical, formula, or symbolic givens`);
    } else if (UNRESOLVED_GIVEN_REFERENCE.test(text) && !hasConcreteGiven(text) && !hasRequiredStimulus(question)) {
      violations.push(`${question.slotId} refers to given, provided, or shown information that is not present in the question`);
    }
    if (question.marks <= 4 && /\ball (?:physical|chemical|possible|common) (?:properties|methods|uses|effects|examples)\b/i.test(text)) {
      violations.push(`${question.slotId} is too broad for its ${question.marks}-mark allocation`);
    }
  }
  return [...new Set(violations)];
}

export function describeSemanticViolations(exam: SemanticExam, scope?: SemanticValidationScope): string[] {
  const violations: string[] = [];
  const questionBySlot = new Map<string, SemanticQuestion>();

  for (const question of exam.sections.flatMap((section) => section.questions)) {
    questionBySlot.set(question.slotId, question);
  }
  violations.push(...describeQuestionCompletenessViolations(exam.sections.flatMap((section) => section.questions).filter((question) => !scope || scope.questionSlotIds.has(question.slotId))));

  for (const entry of exam.marking_scheme) {
    const slotId = entry.slotId ?? "unknown slot";
    const question = entry.slotId ? questionBySlot.get(entry.slotId) : undefined;
    const answer = entry.answer?.trim() ?? entry.numericalMethod?.finalAnswer?.trim() ?? "";
    const notes = entry.marking_notes.trim();
    if (answer && (!scope || scope.answerSlotIds.has(slotId)) && (MISSING_INFORMATION_REFERENCE.test(answer) || PLACEHOLDER_ANSWER.test(answer))) {
      violations.push(`marking entry ${slotId} contains placeholder or missing-information language instead of a substantive model answer`);
    }
    if ((!scope || scope.markingNotesSlotIds.has(slotId)) && (PLACEHOLDER_ANSWER.test(notes) || MISSING_INFORMATION_REFERENCE.test(notes))) {
      violations.push(`marking entry ${slotId} has generic marking notes instead of concrete awardable guidance`);
    }
    if ((!scope || scope.allocationSlotIds.has(slotId)) && entry.allocations?.some((allocation) => PLACEHOLDER_CRITERION.test(allocation.label.trim()))) {
      violations.push(`marking entry ${slotId} contains a generic allocation label instead of a specific awardable criterion`);
    }
    const markingResourceTexts = [
      entry.answer,
      entry.marking_notes,
      ...(entry.allocations ?? []).map((allocation) => allocation.label),
      ...(entry.numericalMethod?.methodSteps ?? []).map((step) => step.step),
      ...(entry.rubric ?? []).map((criterion) => criterion.descriptor),
    ].filter((value): value is string => typeof value === "string");
    if ((!scope || scope.pairSlotIds.has(slotId)) && question && markingResourceTexts.some((text) => MARKING_RESOURCE_REFERENCE.test(text) && !hasRequiredStimulus(question, text))) {
      violations.push(`marking entry ${slotId} references a resource that is not validly attached to the same question`);
    }
    if ((!scope || scope.pairSlotIds.has(slotId)) && question && isCalculationLike(question) && /\d/.test(question.text) && !/\d/.test(answer)) {
      violations.push(`marking entry ${slotId} gives no worked numerical result for a calculation with concrete numerical givens`);
    }
    if (answer && (!scope || scope.pairSlotIds.has(slotId)) && question && normalizedWords(answer) === normalizedWords(question.text)) {
      violations.push(`marking entry ${slotId} merely restates the question instead of answering it`);
    }
  }

  return [...new Set(violations)];
}
