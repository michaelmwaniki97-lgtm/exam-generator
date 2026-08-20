import "server-only";
import { aiClient } from "./client";
import { AI_CONFIG } from "./config";

export type ExamQuestion = {
  number: number;
  topic: string;
  text: string;
  marks: number;
  type: "short_answer" | "structured" | "multiple_choice" | "essay";
  options?: string[];
};

export type ExamSection = {
  title: string;
  questions: ExamQuestion[];
};

export type MarkingSchemeEntry = {
  number: number;
  answer: string;
  marking_notes: string;
};

export type GeneratedExam = {
  instructions: string;
  sections: ExamSection[];
  marking_scheme: MarkingSchemeEntry[];
};

export type TopicInput = {
  strandName: string;
  subStrandName: string;
  outcomes: string[];
  outcomeScope: "sub_strand" | "strand";
};

export type GenerateExamParams = {
  subjectName: string;
  gradeName: string;
  level: string;
  examType: string;
  difficulty: "easy" | "medium" | "hard";
  marks: number;
  duration: number;
  topics: TopicInput[];
  textbookName?: string;
};

function buildPrompt(params: GenerateExamParams): string {
  const topicList = params.topics
    .map((t) => {
      const outcomeLabel =
        t.outcomeScope === "strand"
          ? "Official topic-level objectives (not mapped one-to-one to this sub-topic)"
          : "Specific learning outcomes";
      const outcomes = t.outcomes.length
        ? `\n    ${outcomeLabel}: ${t.outcomes.join("; ")}`
        : "";
      return `- ${t.strandName} > ${t.subStrandName}${outcomes}`;
    })
    .join("\n");

  const shortMin = Math.round(params.marks * 0.4);
  const shortMax = Math.round(params.marks * 0.5);
  const structuredMin = Math.round(params.marks * 0.3);
  const structuredMax = Math.round(params.marks * 0.4);
  const essayMin = Math.round(params.marks * 0.15);
  const essayMax = Math.round(params.marks * 0.25);
  const includeEssay = essayMax >= 10;

  const essayGuidance = includeEssay
    ? `- Essay / extended-response questions: approximately ${essayMin}-${essayMax} marks total. The essay section's total marks must NEVER exceed the combined marks of all other sections.`
    : `- Do NOT include an essay/extended-response section. A ${params.marks}-mark paper is too small for one (essay questions need at least 10 marks each to be meaningful) - cover this content with short-answer and structured questions instead.`;

  const curriculumLabel =
    params.level === "Secondary"
      ? "Kenyan 8-4-4 syllabus"
      : "Kenyan Competency Based Curriculum (CBC)";

  return `Set a ${params.difficulty}-difficulty ${params.examType} exam for ${params.gradeName} (${params.level}) ${params.subjectName}, aligned to the ${curriculumLabel}.

Total marks: ${params.marks} (CRITICAL: the sum of every question's marks across all sections must equal EXACTLY ${params.marks}. Not more, not less.)
Duration: ${params.duration} minutes
${params.textbookName ? `Style reference (do not copy content from it): ${params.textbookName}\n` : ""}
Cover only these official sub-strands/sub-topics. Use listed outcomes/objectives where available; where none are listed, do not invent official outcomes/objectives:
${topicList}

SECTION WEIGHTING (realistic Kenyan exam proportions for this ${params.marks}-mark paper):
- Short-answer / objective questions: approximately ${shortMin}-${shortMax} marks total
- Structured / application questions: approximately ${structuredMin}-${structuredMax} marks total
${essayGuidance}

PER-QUESTION MARK LIMITS (never exceed these, regardless of section):
- "short_answer": 2-5 marks
- "multiple_choice": 1-3 marks
- "structured": 5-10 marks
- "essay": 10-20 marks
No single question may be worth more than 20 marks under any circumstances.

ONE TOPIC PER QUESTION: each question must test exactly ONE sub-strand from the list above. Never combine two different sub-strands into a single question (for example, do not ask a student to both distinguish elements/compounds/mixtures AND represent compounds with chemical symbols in the same question - split these into two separate questions).

COMMAND WORDS: match the command word to the marks awarded, per CBC convention:
- 1-2 marks: state, list, name, define
- 3-5 marks: describe, explain, calculate, distinguish
- 6-10 marks: explain in detail, describe fully, calculate and justify, compare
- 10+ marks (essay only): discuss, evaluate, explain in detail with examples

COGNITIVE DEMAND: do not default to recall. A paper made mostly of "state/list/name/define" questions is not acceptable, even at easy difficulty. Spread questions across three levels of demand, and let the command word signal the level:
- Remember (state, list, name, define) - about 30% of the total marks. Retrieving a taught fact.
- Understand (describe, explain, distinguish, compare, summarise) - about 40% of the total marks. Putting an idea in the learner's own words, or relating two ideas to each other.
- Apply (calculate, work out, solve, use, demonstrate, discuss, evaluate) - about 30% of the total marks. Using the outcome in a new or real-life situation, not a repeat of a worked example.
Within each section, order questions so demand rises: opening questions may be Remember, but later questions in the same section must reach Understand and Apply. At least one question on the paper must set the content in an unfamiliar, real-life Kenyan context the learner has to reason through rather than recall.

MULTIPLE-CHOICE RULES (every "multiple_choice" question must satisfy all of these):
- Exactly 4 options, with exactly one defensibly correct answer.
- Every distractor must be plausible to a learner who has not yet mastered the outcome, and must correspond to a real, predictable mistake - a common misconception, a skipped step, a reversed operation, a unit or place-value slip. Never use filler, joke, or obviously absurd options.
- No trick questions. Do not rely on double negatives, deliberately misleading wording, or obscure edge cases. Test the learning outcome, not the learner's reading of the question.
- No answer patterns. The correct option must not be systematically the longest or most detailed, and correct answers must be spread across the four positions rather than clustered on one.
- Options must be mutually exclusive, grammatically consistent with the stem, and similar in length and structure.
- Never use "All of the above" or "None of the above".

Requirements:
- Organize questions into one or more sections with clear titles (e.g. "Section A: Short Answer").
- Question "type" must be one of: "short_answer", "structured", "multiple_choice", "essay". Include "options" (array of 4 strings) only for "multiple_choice" questions.
- Number questions sequentially starting at 1 across the whole exam.
- Each question's "topic" must be one of the sub-strand names listed above (the text after ">"), copied exactly, character for character. Do not invent, abbreviate, reword, or merge topic names.
- Each question's "marks" must be a positive integer, and must respect both the per-question mark limits and the section weighting above.
- Difficulty, phrasing, and depth must suit ${params.gradeName} students and be answerable within ${params.duration} minutes.
- Provide a short "instructions" string for students (e.g. "Answer all questions.").
- Provide a "marking_scheme" array with one entry per question number containing the expected "answer" and brief "marking_notes" describing how marks are awarded.

BEFORE YOU RESPOND: add up every question's "marks" value across every section. If the sum is not EXACTLY ${params.marks}, adjust question marks (not question count) until it is exactly ${params.marks}. Do not submit a response where the total is wrong.

Respond with ONLY raw JSON (no markdown fences, no commentary) matching exactly this shape:
{
  "instructions": string,
  "sections": [ { "title": string, "questions": [ { "number": number, "topic": string, "text": string, "marks": number, "type": "short_answer" | "structured" | "multiple_choice" | "essay", "options"?: string[] } ] } ],
  "marking_scheme": [ { "number": number, "answer": string, "marking_notes": string } ]
}`;
}

function computeTotalMarks(exam: GeneratedExam): number {
  return exam.sections.flatMap((section) => section.questions).reduce((sum, q) => sum + q.marks, 0);
}

const TYPE_MARK_CAPS: Record<string, [number, number]> = {
  short_answer: [2, 5],
  multiple_choice: [1, 3],
  structured: [5, 10],
  essay: [10, 20],
};

// The prompt asks the model to hit the exact total, and a corrective retry closes most of
// the gap, but neither is a guarantee. This is the deterministic backstop: nudge individual
// question marks by 1 at a time, spread round-robin across questions (never dumping the whole
// gap on one question) and never past a type's realistic cap, until the total is exact. Note
// this can leave a marking scheme's internal mark breakdown ("award 2 for X, 3 for Y") slightly
// stale for whichever question got adjusted - a minor cosmetic cost for a guaranteed-correct total.
function rebalanceMarks(exam: GeneratedExam, target: number): GeneratedExam {
  const questions = exam.sections.flatMap((section) => section.questions);
  if (questions.length === 0) return exam;

  let diff = target - computeTotalMarks(exam);
  const step = diff > 0 ? 1 : -1;
  let index = 0;
  let stalled = 0;

  while (diff !== 0 && stalled < questions.length * 2) {
    const question = questions[index % questions.length];
    const [min, max] = TYPE_MARK_CAPS[question.type] ?? [1, 20];
    const hasHeadroom = step > 0 ? question.marks < max : question.marks > min;

    if (hasHeadroom) {
      question.marks += step;
      diff -= step;
      stalled = 0;
    } else {
      stalled++;
    }
    index++;
  }

  return exam;
}

// Human-readable list of every hard-rule violation in the generated exam, used both to decide
// whether a corrective retry is needed and to tell the model exactly what to fix.
function describeViolations(
  exam: GeneratedExam,
  target: number,
  allowedTopics: string[]
): string[] {
  const violations: string[] = [];
  const questions = exam.sections.flatMap((section) => section.questions);

  const total = questions.reduce((sum, q) => sum + q.marks, 0);
  if (total !== target) {
    violations.push(`the total is ${total} marks instead of exactly ${target}`);
  }

  for (const q of questions) {
    const cap = TYPE_MARK_CAPS[q.type];
    if (cap && (q.marks < cap[0] || q.marks > cap[1])) {
      violations.push(
        `question ${q.number} ("${q.type}") is ${q.marks} marks, outside the allowed ${cap[0]}-${cap[1]} range`
      );
    }
  }

  const essayTotal = questions.filter((q) => q.type === "essay").reduce((sum, q) => sum + q.marks, 0);
  const otherTotal = total - essayTotal;
  if (essayTotal > 0 && essayTotal > otherTotal) {
    violations.push(
      `the essay section (${essayTotal} marks) is larger than all other sections combined (${otherTotal} marks)`
    );
  }

  const allowed = new Set(allowedTopics.map(normaliseTopic));
  for (const q of questions) {
    if (!allowed.has(normaliseTopic(q.topic))) {
      violations.push(
        `question ${q.number} is labelled topic "${q.topic}", which is not one of the selected sub-strands`
      );
    }
  }

  return violations;
}

// Deterministic backstop for per-question mark caps: the model sometimes drifts outside them
// even when the total is correct (e.g. a 9-mark essay when the floor is 10). Clamps each
// question into range; net drift gets restored by rebalanceMarks() afterward.
function clampQuestionCaps(exam: GeneratedExam): void {
  for (const question of exam.sections.flatMap((section) => section.questions)) {
    const cap = TYPE_MARK_CAPS[question.type];
    if (!cap) continue;
    question.marks = Math.min(cap[1], Math.max(cap[0], question.marks));
  }
}

// Deterministic backstop for "essay section must never outweigh the rest combined": transfers
// marks 1 at a time from essay questions (down to their floor) to non-essay questions (up to
// their ceiling), so the exam's total is unchanged throughout - only the split shifts.
function enforceEssayCeiling(exam: GeneratedExam): void {
  const questions = exam.sections.flatMap((section) => section.questions);
  const essayQs = questions.filter((q) => q.type === "essay");
  const otherQs = questions.filter((q) => q.type !== "essay");
  if (essayQs.length === 0 || otherQs.length === 0) return;

  let essayTotal = essayQs.reduce((sum, q) => sum + q.marks, 0);
  let otherTotal = otherQs.reduce((sum, q) => sum + q.marks, 0);

  let e = 0;
  let o = 0;
  let stalled = 0;
  const maxStall = (essayQs.length + otherQs.length) * 2;

  while (essayTotal > otherTotal && stalled < maxStall) {
    const eq = essayQs[e % essayQs.length];
    const oq = otherQs[o % otherQs.length];
    const [eMin] = TYPE_MARK_CAPS.essay;
    const [, oMax] = TYPE_MARK_CAPS[oq.type] ?? [1, 20];

    if (eq.marks > eMin && oq.marks < oMax) {
      eq.marks -= 1;
      oq.marks += 1;
      essayTotal -= 1;
      otherTotal += 1;
      stalled = 0;
    } else {
      stalled++;
    }
    e++;
    o++;
  }
}

// Topic comparison is done on a punctuation- and case-insensitive form, so that a question
// labelled "water and its uses" still matches the sub-strand "Water and Its Uses". Real drift
// (a topic the teacher never selected) survives this normalisation and gets rejected.
function normaliseTopic(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Deterministic backstop for topic drift. Rewrites each question's "topic" to the exact
// sub-strand name it refers to (fixing casing/punctuation differences in place), and returns
// the questions whose topic matches no selected sub-strand at all. Touches only the topic
// field - mark values are left exactly as the mark backstops set them.
function reconcileTopics(exam: GeneratedExam, allowedTopics: string[]): ExamQuestion[] {
  const canonical = new Map(allowedTopics.map((topic) => [normaliseTopic(topic), topic]));
  const drifted: ExamQuestion[] = [];

  for (const question of exam.sections.flatMap((section) => section.questions)) {
    const match = canonical.get(normaliseTopic(question.topic));
    if (match) {
      question.topic = match;
    } else {
      drifted.push(question);
    }
  }

  return drifted;
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("AI response did not contain JSON.");
    }
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

function isValidGeneratedExam(value: unknown): value is GeneratedExam {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.instructions !== "string") return false;
  if (!Array.isArray(v.sections) || v.sections.length === 0) return false;
  if (!Array.isArray(v.marking_scheme) || v.marking_scheme.length === 0) return false;

  return v.sections.every((section) => {
    if (!section || typeof section !== "object") return false;
    const s = section as Record<string, unknown>;
    if (typeof s.title !== "string") return false;
    if (!Array.isArray(s.questions) || s.questions.length === 0) return false;
    return s.questions.every((q) => {
      if (!q || typeof q !== "object") return false;
      const question = q as Record<string, unknown>;
      return (
        typeof question.number === "number" &&
        typeof question.topic === "string" &&
        typeof question.text === "string" &&
        typeof question.marks === "number" &&
        typeof question.type === "string"
      );
    });
  });
}

const SYSTEM_PROMPT =
  "You are an experienced Kenyan curriculum exam setter. You always respond with a single valid JSON object and nothing else.";

export async function generateExam(params: GenerateExamParams): Promise<GeneratedExam> {
  if (!AI_CONFIG.apiKey) {
    throw new Error("NVIDIA_API_KEY is not set. Add it to .env.local to enable exam generation.");
  }

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildPrompt(params) },
  ];

  const allowedTopics = params.topics.map((topic) => topic.subStrandName);

  let generated: GeneratedExam | undefined;

  // The prompt asks for an exact total, capped per-question marks, and an essay section that
  // never outweighs the rest - hard constraints the model doesn't reliably hit on the first
  // try. One corrective follow-up turn (naming every specific violation) closes most of the
  // gap. Whatever's left after that goes to the deterministic backstops below.
  for (let attempt = 0; attempt < 2; attempt++) {
    const completion = await aiClient.chat.completions.create({
      model: AI_CONFIG.model,
      temperature: 0.5,
      max_tokens: 4096,
      messages,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      throw new Error("The AI returned an empty response. Please try again.");
    }

    const parsed = extractJson(raw);
    if (!isValidGeneratedExam(parsed)) {
      throw new Error("The AI returned an unexpected format. Please try again.");
    }

    generated = parsed;
    const violations = describeViolations(parsed, params.marks, allowedTopics);
    if (violations.length === 0) break;

    if (attempt === 0) {
      messages.push({ role: "assistant", content: raw });
      messages.push({
        role: "user",
        content: `That response has these problems: ${violations.join("; ")}. Return the corrected JSON, keeping the same number of questions: fix mark problems by adjusting question marks only, and fix any off-topic question by rewriting it to test one of the listed sub-strands and setting its "topic" to that sub-strand's exact name. The total must be exactly ${params.marks}. Respond with ONLY the corrected JSON, no commentary.`,
      });
    }
  }

  if (!generated) {
    throw new Error("Exam generation failed. Please try again.");
  }

  // Deterministic backstops: clamp per-question caps, restore the exact total (clamping can
  // shift it), then rebalance the essay/rest split. Order matters - each stage assumes the
  // previous one already holds.
  clampQuestionCaps(generated);
  generated = rebalanceMarks(generated, params.marks);
  enforceEssayCeiling(generated);

  const finalTotal = computeTotalMarks(generated);
  if (finalTotal !== params.marks) {
    throw new Error(
      `The AI generated ${finalTotal} marks instead of the requested ${params.marks}. Please try generating again.`
    );
  }

  // Topic drift is checked last, after marks are settled, because it can only be resolved by
  // rewriting a question - there is no safe deterministic fix. Casing/punctuation differences
  // are absorbed here; a question on a sub-strand the teacher never selected is rejected.
  const drifted = reconcileTopics(generated, allowedTopics);
  if (drifted.length > 0) {
    const labels = drifted.map((q) => `Q${q.number} ("${q.topic}")`).join(", ");
    throw new Error(
      `The AI generated questions outside the selected topics: ${labels}. Please try generating again.`
    );
  }

  return generated;
}
