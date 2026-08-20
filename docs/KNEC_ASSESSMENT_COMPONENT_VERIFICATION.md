# KNEC assessment component verification

## Scope

This record supports the **KCSE-style paper/component** selector for exact
8-4-4 Secondary subject matches in these school-use contexts:

- Form 4 Mock: KCSE-style components are directly available.
- Form 4 End Term: the teacher may choose Standard School Exam or KCSE-style Paper.
- Form 3 End Term: the teacher may choose Standard School Exam or KCSE-style Paper.
- Form 3 Revision Test: the teacher may choose Standard Revision Test or KCSE-style Paper.

The component structures are verified KCSE structures. Reusing them for a Form 3
or school End Term examination is a school practice choice; it is not an official
Form 3 KNEC examination and does not mean KNEC administers the generated exam.

Standard mode has no KCSE component requirement. KCSE-style mode controls only
the paper structure. It does not change the selected Grade/Form curriculum,
topics, or sub-topics. Form 3 therefore continues using Form 3 curriculum.

## Primary source

- Issuer: Kenya National Examinations Council (KNEC)
- Title: *2026 KCSE EXAMINATION TIMETABLE, INSTRUCTIONS AND GUIDELINES*
- Reference: `KNEC/TD/SE/KCSE/TT/26/005`
- Published: 19 February 2026
- Curriculum/examination: Kenya Certificate of Secondary Education (KCSE)

Subject-code mapping is consistent with the KCSE subject-code schedule in the Kenya National Examinations Council (Kenya Certificate of Secondary Education) Rules published by Kenya Law.

## Verified component baseline

| App subject | KNEC subject | Code | Component | Duration | Type | Verification |
| --- | --- | ---: | --- | ---: | --- | --- |
| Mathematics | Mathematics Alt. A | 121 | 121/1 — Paper 1 | 150 min | Written | Verified |
| Mathematics | Mathematics Alt. A | 121 | 121/2 — Paper 2 | 150 min | Written | Verified |
| English | English | 101 | 101/1 — Paper 1 — Functional Skills | 120 min | Written | Verified |
| English | English | 101 | 101/2 — Paper 2 — Comprehension, Literary Appreciation & Grammar | 150 min | Written | Verified |
| English | English | 101 | 101/3 — Paper 3 — Creative Composition & Essays based on Set Texts | 150 min | Written | Verified |
| Kiswahili | Kiswahili | 102 | 102/1 — Paper 1 — Insha | 105 min | Written | Verified assessment structure |
| Kiswahili | Kiswahili | 102 | 102/2 — Paper 2 — Lugha | 150 min | Written | Verified assessment structure |
| Kiswahili | Kiswahili | 102 | 102/3 — Paper 3 — Fasihi | 150 min | Written | Verified assessment structure |
| Chemistry | Chemistry | 233 | 233/1 — Paper 1 — Theory | 120 min | Written | Verified |
| Chemistry | Chemistry | 233 | 233/2 — Paper 2 | 120 min | Written | Verified |
| Chemistry | Chemistry | 233 | 233/3 — Paper 3 — Practical | 135 min | Practical | Verified |
| Biology | Biology | 231 | 231/1 — Paper 1 | 120 min | Written | Verified |
| Biology | Biology | 231 | 231/2 — Paper 2 | 120 min | Written | Verified structure |
| Biology | Biology | 231 | 231/3 — Paper 3 — Practical | 105 min | Practical | Verified structure |
| Physics | Physics | 232 | 232/1 — Paper 1 | 120 min | Written | Verified |
| Physics | Physics | 232 | 232/2 — Paper 2 | 120 min | Written | Verified |
| Physics | Physics | 232 | 232/3 — Paper 3 — Practical | 150 min | Practical | Verified |
| Christian Religious Education | Christian Religious Education | 313 | 313/1 — Paper 1 | 150 min | Written | Verified |
| Christian Religious Education | Christian Religious Education | 313 | 313/2 — Paper 2 | 150 min | Written | Verified structure |

Component order follows paper number, not timetable date order.

## Important boundaries

- Generic app subject **Mathematics** maps to **Mathematics Alt. A, code 121 only**. Mathematics Alt. B, code 122, is not introduced.
- Biology uses subject code **231**, not 236.
- No oral, project, school-based assessment, or additional paper has been inferred.
- Grades 1–9 and CBC/CBE records do not receive KCSE components.
- Forms 1–2 do not receive KCSE-style components. Form 3 receives them only when
  the teacher explicitly chooses KCSE-style for End Term or Revision Test.
- A component is accepted only when its Form, subject, and assessment context exactly match the canonical server-side rule.
- Kiswahili's assessment structure verification does not change its curriculum data. Its existing curriculum remains legacy/unverified pending authoritative curriculum replacement or verification.

## Marks and duration

The inspected source supports component identity and duration, but this milestone does **not** assert fixed official KNEC mark totals. Every component therefore stores `officialMarks: null`. Total marks remain teacher-configurable.

Selecting a verified component sets its verified duration as the suggested default. The configured school Mock duration remains separately recorded from the verified duration.
