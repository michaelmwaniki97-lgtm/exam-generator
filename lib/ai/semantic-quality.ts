type SemanticQuestion = {
  slotId: string;
  text: string;
  marks: number;
  type: string;
  questionFamily: string;
};

type SemanticMarkingEntry = {
  slotId?: string;
  answer: string;
  marking_notes: string;
  allocations?: { label: string; marks: number }[];
};

type SemanticExam = {
  sections: { questions: SemanticQuestion[] }[];
  marking_scheme: SemanticMarkingEntry[];
};

const RESOURCE_NOUN = "(?:graph|chart|diagram|image|figure|table|map|passage|source extract|case study|dataset|data|experiment(?:al)? setup)";
const DEPENDENT_RESOURCE_REFERENCE = new RegExp(
  `\\b(?:interpret|study|examine|refer to|use|using|from)\\b[^.!?]{0,100}\\b${RESOURCE_NOUN}\\b|\\b${RESOURCE_NOUN}\\s+(?:below|above|shown|provided|given|illustrated|displayed|showing)\\b`,
  "i"
);
const MISSING_INFORMATION_REFERENCE = /\b(?:we|you|the (?:student|learner))\s+(?:need|must have)\s+to\s+know\b|\b(?:cannot|can't|unable to)\s+(?:calculate|determine|answer|solve)\b|\b(?:information|data|values?|details?)\s+(?:is|are)\s+(?:missing|not (?:given|provided|available))\b/i;
const PLACEHOLDER_ANSWER = /\b(?:to (?:calculate|solve|determine|answer) (?:this|the (?:question|problem))|use the (?:formula|equation)|the (?:student|learner) should|award marks? for correct|answer should include|response should include)\b/i;
const PLACEHOLDER_CRITERION = /^(?:correct (?:answer|working|method|response)|show(?:s|ing)? working|use(?:s| of)? (?:the )?(?:correct )?(?:formula|method)|answer|method|working|explanation|calculation|response|any valid answer)$/i;
const PERCENTAGE_COMPOSITION_TEMPLATE = /\b(?:empirical|molecular) formula\b[^.!?]{0,100}\b(?:given|using|from) (?:its|the|a) percentage composition\b/i;
const VAGUE_PROBLEM_TEMPLATE = /\bsolve (?:a|the) problem involving\b/i;
const PERCENTAGE_NITROGEN_TEMPLATE = /\bcalculate (?:the )?percentage of nitrogen\b/i;
const NUMERIC_VALUE = /(?:^|[^A-Za-z])[-+]?\d+(?:\.\d+)?\s*(?:%|°?[CFK]|mol|g|kg|mg|cm3|cm³|dm3|dm³|m3|m³|cm|mm|km|m|L|ml|kPa|Pa|atm|s|min|h)?\b/i;
const CHEMICAL_FORMULA = /\b(?:[A-Z][a-z]?\d+|[A-Z][a-z]?[A-Z][A-Za-z]*(?:\d+|\([A-Z][A-Za-z0-9]*\d)[A-Za-z0-9()]*)\b/;

function hasConcreteGiven(text: string): boolean {
  return NUMERIC_VALUE.test(text) || CHEMICAL_FORMULA.test(text) || /\b(?:equation|formula)\s*[:=]\s*\S+/i.test(text);
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

export type SemanticValidationScope = {
  questionSlotIds: ReadonlySet<string>;
  answerSlotIds: ReadonlySet<string>;
  markingNotesSlotIds: ReadonlySet<string>;
  allocationSlotIds: ReadonlySet<string>;
  pairSlotIds: ReadonlySet<string>;
};

export function describeSemanticViolations(exam: SemanticExam, scope?: SemanticValidationScope): string[] {
  const violations: string[] = [];
  const questionBySlot = new Map<string, SemanticQuestion>();

  for (const question of exam.sections.flatMap((section) => section.questions)) {
    questionBySlot.set(question.slotId, question);
    if (scope && !scope.questionSlotIds.has(question.slotId)) continue;
    const text = question.text.trim();
    const resourceReference = DEPENDENT_RESOURCE_REFERENCE.test(text);
    const inlineNumericData = /\bdata\b/i.test(text) && !/\b(?:graph|chart|diagram|image|figure|table|map|passage|extract|case study|dataset|experiment(?:al)? setup)\b/i.test(text) && hasConcreteGiven(text);
    if (resourceReference && !inlineNumericData) {
      violations.push(`${question.slotId} references a graph, table, data, or other stimulus that the renderer cannot provide; put all necessary information directly in the question text`);
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
    if (isCalculationLike(question) && /\b(?:given|using) (?:the )?(?:data|values?|information|percentage composition)\b/i.test(text) && !hasConcreteGiven(text)) {
      violations.push(`${question.slotId} is a calculation question but contains no usable numerical, formula, or symbolic givens`);
    }
    if (question.marks <= 4 && /\ball (?:physical|chemical|possible|common) (?:properties|methods|uses|effects|examples)\b/i.test(text)) {
      violations.push(`${question.slotId} is too broad for its ${question.marks}-mark allocation`);
    }
  }

  for (const entry of exam.marking_scheme) {
    const slotId = entry.slotId ?? "unknown slot";
    const question = entry.slotId ? questionBySlot.get(entry.slotId) : undefined;
    const answer = entry.answer.trim();
    const notes = entry.marking_notes.trim();
    if ((!scope || scope.answerSlotIds.has(slotId)) && (MISSING_INFORMATION_REFERENCE.test(answer) || PLACEHOLDER_ANSWER.test(answer))) {
      violations.push(`marking entry ${slotId} contains placeholder or missing-information language instead of a substantive model answer`);
    }
    if ((!scope || scope.markingNotesSlotIds.has(slotId)) && (PLACEHOLDER_ANSWER.test(notes) || MISSING_INFORMATION_REFERENCE.test(notes))) {
      violations.push(`marking entry ${slotId} has generic marking notes instead of concrete awardable guidance`);
    }
    if ((!scope || scope.allocationSlotIds.has(slotId)) && entry.allocations?.some((allocation) => PLACEHOLDER_CRITERION.test(allocation.label.trim()))) {
      violations.push(`marking entry ${slotId} contains a generic allocation label instead of a specific awardable criterion`);
    }
    if ((!scope || scope.pairSlotIds.has(slotId)) && question && isCalculationLike(question) && /\d/.test(question.text) && !/\d/.test(answer)) {
      violations.push(`marking entry ${slotId} gives no worked numerical result for a calculation with concrete numerical givens`);
    }
    if ((!scope || scope.pairSlotIds.has(slotId)) && question && !DEPENDENT_RESOURCE_REFERENCE.test(question.text) && /\b(?:the )?(?:graph|chart|table|diagram|figure) (?:shows|indicates|illustrates|demonstrates)\b/i.test(answer)) {
      violations.push(`marking entry ${slotId} invents facts about a graph, table, or figure absent from the question`);
    }
    if ((!scope || scope.pairSlotIds.has(slotId)) && question && normalizedWords(answer) === normalizedWords(question.text)) {
      violations.push(`marking entry ${slotId} merely restates the question instead of answering it`);
    }
  }

  return [...new Set(violations)];
}
