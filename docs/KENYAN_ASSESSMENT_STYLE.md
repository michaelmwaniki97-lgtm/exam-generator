# Kenyan assessment style system

## Purpose and boundary

The generator uses Kenyan assessment papers as development-only style evidence. They inform presentation, question construction and marking conventions; they are never a question bank, curriculum source or runtime dependency. Textbook retrieval and selected curriculum targets define what may be assessed. The style profile defines how an original assessment is structured and worded.

The archives are extracted only into ignored `tmp/kenyan-reference/`. Production modules do not read an archive, PDF, manifest or extracted text. The app never sends reference papers to a model, persists them, exposes them to users or bundles them into client output.

## Corpus inspected

The development evaluator scanned 129 PDF/DOCX files and found 82 distinct document fingerprints. It covered Grade 6, Grade 7, Grade 8 and Grade 9/KJSEA samples plus KCSE and KCSE-style papers and schemes from 2022, 2024 and 2025.

Subjects represented in the scan include Mathematics, English, Kiswahili, Biology, Chemistry, Physics, Geography, Agriculture, Business Studies, Computer Studies, Integrated Science, Pre-Technical Studies, Social Studies, CRE and Creative Arts. The scan aggregates only general structural terms; it neither saves nor reports reference question text.

Visual review covered representative Grade 8 Mathematics scoring guidance, Grade 8 Integrated Science paper, Grade 9 Mathematical Activities practice paper, 2024 KCSE Mathematics and 2024 KCSE Biology marking material. The samples confirm strong headers, candidate fields, instructions, sectioning, marks, progressively more demanding tasks, tables/diagrams and synchronized marking practices. Official seals, logos, serial numbers and official wording are deliberately excluded from generated documents.

## Generalized conventions encoded

Shared rules require direct command verbs, consistent numbering, marks at the end of each question/subpart, answerable supplied information, locally plausible contexts where appropriate, metric units and teacher-generated status.

Level rules keep Grade 6 language short and accessible; treat Grades 7–9 as competency-oriented with interpretation and investigation; and use KCSE-style school-paper clarity for secondary theory/practical contexts. Subject rules cover calculation working and visual use in Mathematics; evidence/data/safety in sciences; language-paper separation and rubrics in English; idiomatic Kiswahili categories; and context-specific conventions for Geography, Agriculture, Business Studies, Computer Studies and Pre-Technical Studies.

The profile also directs marking to mirror question/subpart numbering, allocate concrete marks, record alternatives, method/accuracy marks and units, and use analytic rubrics for extended writing. It preserves the existing visual contract: visuals are black-and-white, validated, answer-independent and included only when pedagogically necessary.

## Selection and runtime composition

`lib/assessment-style/profiles.ts` composes a compact profile from:

1. shared Kenyan assessment rules;
2. Grade 6, junior-school or secondary rules;
3. the normalized subject name; and
4. the teacher-selected assessment type.

Generation and question regeneration add this composed profile to the existing prompt. Staged marking generation receives the matching profile as well. Blueprint construction remains server-owned and continues to allocate sections, question families, cognitive demand and exact marks before content is generated. Textbook chunks remain separately bounded as untrusted curriculum-grounding material.

## Originality and evaluation

Run the aggregate development scan after extracting references:

```powershell
node scripts/evaluate-kenyan-reference-style.mjs tmp/kenyan-reference
```

For a generated exam JSON, run the development-only seven-word-shingle check:

```powershell
node scripts/check-reference-originality.mjs tmp/kenyan-reference path\to\generated-exam.json
```

The check exits with code 2 when 30% or more of a generated question's shingles appear in the corpus. It reports only generated slot IDs and counts, never matching source text. It is an evaluation warning, not a production feature or a legal originality determination.

## Extension and limitations

Add a subject rule only when a broad sample supports it; keep it short and generalized. Add a level rule when it belongs to an assessment band rather than a subject. Add an exam-type rule when the teacher-selected purpose changes scope or paper shape. Do not encode exact source questions, source answers or proprietary passages.

The corpus includes third-party copies and school/mock papers, so it is evidence of recurring conventions rather than authority for national rules. KJSEA component facts already come from the application’s verified profile system. Existing topic and textbook validation prevents style guidance from expanding the permitted knowledge scope. Human teacher review remains needed for factual accuracy, curriculum coverage and suitability.
