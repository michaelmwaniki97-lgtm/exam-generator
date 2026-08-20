# Kenyan Exam Blueprint Engine

## Purpose and architecture

The version 1 blueprint is the deterministic planning layer between the teacher's configuration and question generation:

`Grade/Form → Subject → Assessment → Structure → Component → Curriculum → Marks → Duration → Difficulty → Blueprint`

`buildExamBlueprint()` is ordinary TypeScript. It does not call an LLM and does not create question text or marking-scheme answers. Given the same canonical input it returns the same plan. An optional explicit seed can produce a repeatable variation in planning order. Every saved blueprint includes `blueprintVersion: 1` so future code can interpret old plans without assuming the latest schema.

The output contains the canonical education, subject, assessment and optional component context; curriculum scope; section/group targets; topic allocations; question-family targets; positive-mark question slots; difficulty/cognitive targets; an estimated completion time; structured validation; evidence metadata; and `teacherReviewRequired: true`.

## Evidence boundaries

The engine uses three evidence states:

- `OFFICIAL_CONSTRAINT`: canonical curriculum hierarchy that is already officially verified, and the existing verified KCSE component identity, paper code, component type and duration.
- `APPLICATION_HEURISTIC`: assessment breadth, section/group design, mark distribution, question families, slot count and sizes, cognitive percentages, time estimates and warning thresholds.
- `SOURCE_REQUIRED`: missing/unverified curriculum sources and unavailable learning outcomes/objectives. These values are never invented or promoted to official status.

Application heuristics are not official KNEC examination specifications. In particular, the engine does not claim official KCSE question counts, section counts, section marks, fixed total marks, compulsory/optional patterns, topic-by-paper splits, minutes per mark, or cognitive percentage distributions.

## Curriculum grounding

### CBC / CBE

Grades 1–9 always use Standard School Exam planning and the teacher-selected active Grade/subject curriculum. Where authoritative learning outcomes are available, the blueprint records that grounding. Otherwise it records `STRAND_SUB_STRAND_ONLY` with `SOURCE_REQUIRED`; it does not fabricate Specific Learning Outcomes.

Lower Primary profiles restrict planning to concise, age-appropriate tasks and add an explicit age constraint to every slot. Upper Primary and Junior School retain level-appropriate application tasks without importing KCSE components or assumptions.

### Forms 1–4

Forms use only selected Form-specific topics and sub-topics. Topic objectives are used when canonical records indicate that they are available; otherwise the plan records `TOPIC_SUB_TOPIC_ONLY` and a source requirement. Form 3 KCSE-style assessments retain Form 3 curriculum: the verified component provides style/profile guidance only and the structure origin is `KCSE_STYLE_PRACTICE`.

Provisional, textbook-supported and legacy curriculum keeps its stored verification status. In particular, verified Kiswahili assessment components do not change legacy/unverified Kiswahili curriculum into official curriculum.

## KCSE-style and practical behavior

KCSE-style planning reuses the component objects in `lib/assessment/rules.ts`; it does not duplicate paper codes or durations. Component identity/type/duration is an official constraint, while the generated plan remains a school application heuristic (`KCSE_STYLE_SCHOOL`, `KCSE_STYLE_MOCK` or `KCSE_STYLE_PRACTICE`), never an `OFFICIAL_KCSE_PAPER`.

The component-aware profiles are:

- Mathematics 121/1 and 121/2: selected curriculum with computation, calculation, application, multi-step problem solving and reasoning; no invented official topic split.
- English 101/1: functional communication only. 101/2: comprehension, literary appreciation and grammar/language use. 101/3: creative composition and set-text extended response.
- Kiswahili 102/1: Insha. 102/2: Lugha. 102/3: Fasihi.
- Biology, Chemistry and Physics written components: short/structured response, explanation, subject-appropriate calculation, data/graph interpretation and application.
- CRE: knowledge, structured explanation, interpretation/application and extended response.
- Biology 231/3, Physics 232/3 and Chemistry 233/3: practical-oriented observation, measurement, recording, data handling, calculation, interpretation and conclusion slots.

Practical slots contain no procedures. They carry `NO_DANGEROUS_OR_UNSUPPORTED_PROCEDURE` and `PRACTICAL_SAFETY_REVIEW_REQUIRED`. Actual practical question generation and safety treatment remain Phase 6 work.

## Exact mark reconciliation

The allocator uses integer floors plus deterministic largest-remainder distribution with stable index tie-breaking. It is used independently for section marks, slot marks, topic allocations and cognitive target marks.

The validator requires:

- section marks equal requested total marks;
- slots within each section equal that section's marks;
- all slot marks equal requested total marks;
- all topic allocation marks equal requested total marks;
- every section and slot has positive marks.

When selected sub-topics outnumber marks, every selected record remains visible in the scope and allocation list; some receive a zero planning allocation rather than forcing an unrealistic positive-mark question for every sub-topic.

## Difficulty and cognitive targets

Teacher difficulty is translated into configurable `FOUNDATIONAL`, `APPLICATION` and `REASONING` targets:

- Easy: 55 / 35 / 10 percent.
- Medium: 35 / 45 / 20 percent.
- Hard: 20 / 45 / 35 percent.

These percentages are application heuristics, not KNEC or KICD distributions. They always total 100, and integer target marks reconcile to the requested total. The teacher's difficulty selection is never silently replaced.

## Time estimation

Each broad question family has a configurable application estimate for minutes per mark. Slot estimates roll up to section and paper estimates. The selected duration is not mutated. The time-fit result is one of:

- `OK`;
- `WARNING_TIME_PRESSURE` when the estimate is more than 115% of selected duration;
- `WARNING_TOO_LIGHT` when it is less than 55% of selected duration.

These are application estimates, not a universal official minutes-per-mark rule. Verified component duration remains separately identifiable as an official component constraint.

## Validation and duplicate-risk checks

Input validation rejects invalid marks/duration, unsupported structures, missing or fake components, an education-system/Grade mismatch, duplicate curriculum IDs, inactive curriculum, and curriculum from another Grade/Form or subject.

Output validation checks non-empty sections and slots, all mark reconciliation layers, 100% cognitive targets, positive time estimates, practical-vs-written family separation, English/Kiswahili component-family isolation, canonical component identity and exact selected curriculum scope. It returns structured `errors`, `warnings` and reconciliation totals. Repeated curriculum/family/demand intents produce `DUPLICATE_COVERAGE_RISK`; implausible marks for a family produce `MARK_SIZE_MISMATCH` for teacher review.

## Server trust and persistence

The browser builds a preview from currently loaded curriculum for teacher review. It does not submit a blueprint field. On submission, the server re-authenticates the teacher, reloads the canonical Grade/Form, subject and selected curriculum, validates active ownership/context, resolves the canonical assessment/component, and rebuilds the blueprint. Extra client-created blueprint JSON has no effect, and fake components or foreign curriculum cannot enter the saved plan.

The canonical blueprint is saved in `exams.content.meta.blueprint`. No database migration is required. Existing exams without that optional metadata remain compatible and are not assigned retroactive fabricated blueprints.

## Teacher review

The Review step shows a compact summary of groups, exact group marks, question-slot count, curriculum breadth, question families, cognitive targets, selected duration, estimated completion time and warnings. `View exam plan` expands read-only section slots and curriculum allocations. Estimates are labelled as application planning, and teacher review remains mandatory before use.

Phase 5 does not change AI prompts, require AI to obey the blueprint, generate items, redesign marking schemes, add regeneration, build an editor, change PDFs, or add textbook RAG.
