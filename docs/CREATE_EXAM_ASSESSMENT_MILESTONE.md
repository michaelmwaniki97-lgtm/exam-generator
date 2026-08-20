# Create Exam curriculum and assessment wiring

## Scope

New exam creation is limited to active curriculum for CBC/CBE Grades 1–9 and
8-4-4 Forms 1–4. Historical exams retain their stored curriculum UUIDs and are
not migrated or filtered through the new-exam policy.

School/application assessment types are intentionally distinct from official
national paper or component rules. The editable marks and duration values are
application defaults, not KICD or KNEC requirements.

## Official component source status

The repository contains no authoritative KNEC paper/component regulation that
was inspected for this milestone. Therefore no Paper 1, Paper 2, Paper 3,
practical, oral, project, or SBA option is configured as `VERIFIED`.

Form mock contexts resolve to `SOURCE_REQUIRED`, expose no official component,
and remain teacher-configurable. A future rule may be added to
`lib/assessment/rules.ts` only after recording the inspected authoritative
source alongside the exact Grade/Form and subject mapping.

## Manual acceptance checks

1. Sign in as a teacher and open `/teacher/exams/new`.
2. Select CBC / CBE → Lower Primary → Grade 3 → Mathematics. Confirm only
   active Grade 3 Mathematics curriculum appears, school assessment formats are
   offered, and no KCSE paper selector appears.
3. Select CBC / CBE → Junior School → Grade 7 → Integrated Science. Confirm the
   official hierarchy is grouped and ordered by source order.
4. Select CBC / CBE → Junior School → Grade 9 → Mathematics. Confirm no inactive
   provisional duplicates appear.
5. Select 8-4-4 → Secondary → Form 1 → Biology. Confirm active verified topics
   and school assessment types appear.
6. Select 8-4-4 → Secondary → Form 4 → Physics → Mock. Confirm a
   `SOURCE_REQUIRED` notice appears and no official component is invented.
7. Select 8-4-4 → Secondary → Form 4 → Kiswahili if available. Confirm its
   legacy/unverified status is visible and it is not labelled official.
8. Change Grade/Form after making downstream selections. Confirm subject,
   assessment type, component, and curriculum reset.
9. Change subject after selecting curriculum. Confirm textbook, curriculum, and
   component reset, and an assessment type remains only when still allowed.
10. Open an exam saved before this milestone from `/teacher/exams`. Confirm the
    paper and marking scheme still render.

No database schema changes were required. The assessment and curriculum
verification snapshot is stored additively in `exams.content.meta` for new rows.
