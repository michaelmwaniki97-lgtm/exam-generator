# Curriculum import milestone

## 1. Summary

The verified candidate dataset and live Supabase database were audited. A deterministic, additive, transaction-capable import is prepared, but the live import was deliberately not executed because the required schema migration could not be applied through the available connection. The live database remains unchanged.

## 2. Schema findings

- Live tables audited: `subjects`, `grades`, `strands`, `sub_strands`, `learning_outcomes`, `textbooks`, `exams`, `marking_schemes`, `teachers`, and `admins`.
- Live counts before import: 16 subjects, 16 grades, 378 strands, 855 sub-strands, 1,730 learning outcomes, 173 textbooks, 3 exams, and 3 marking schemes.
- Existing curriculum tables had no official-order fields, source/verification fields, active/legacy marker, or parent-context unique constraints.
- All live relational FK checks passed and no duplicate parent/name keys were found in the existing data.
- All 3 exams contain curriculum UUID references: 12 total references to 9 existing sub-strand UUIDs, with no missing referenced UUIDs.
- Deleting candidate-context legacy data would affect 320 strands, 739 sub-strands, 1,498 outcomes, and all 12 historical exam references.

## 3. Import strategy

- Retain every legacy curriculum row and UUID.
- Mark replaced legacy strand/topic roots inactive instead of deleting them.
- Insert official rows with deterministic UUIDs and activate only those rows for new exam selection.
- Reuse exact live grade and existing subject UUIDs; create only the 10 missing official subject names.
- Preserve official order, exact wording, printed codes where present, source references, source pages, and discrepancy notes.
- Use parent plus official order as the sourced-row uniqueness key because the authoritative material legitimately repeats some exact names and printed codes.
- Keep Form objectives at topic level; do not claim a one-to-one mapping to sub-topics.
- Import no CBC Specific Learning Outcomes because they are absent from the verified candidates.
- Run all database changes inside the service-role-only `import_verified_curriculum(jsonb)` function, with live-count drift guards and repeat-run detection by dataset hash.

## 4. Migrations added

- `supabase/migrations/20260816170000_prepare_verified_curriculum_import.sql`
- Adds order, source, verification, active/legacy, and import-audit fields.
- Adds `strand_objectives`, `curriculum_imports`, `curriculum_import_legacy_records`, and `curriculum_source_exceptions`.
- Adds RLS policies, explicit grants, indexes, parent-context uniqueness, collision checks, source-required assertions, legacy snapshots, and the transactional import RPC.
- The migration is prepared but not applied to the live project.

## 5. CBC import result

- Dry-run validated all 117 Grade 1-9 CBC subject contexts.
- Prepared CBC hierarchy is included in the combined totals of 689 strands/topics and 3,893 sub-strands/sub-topics.
- Zero CBC Specific Learning Outcomes are scheduled for import.
- Live CBC import result: not executed; migration access is required first.

## 6. Form import result

- Dry-run validated all 24 official Form subject contexts.
- Prepared totals: 191 topics, 1,101 sub-topics, and 1,287 topic-level objectives.
- Objective scope is preserved as official topic-level rather than duplicated under each sub-topic.
- Live Form import result: not executed; migration access is required first.

## 7. Source-required items

- CBC Specific Learning Outcomes remain source-required and are not fabricated.
- Six Form 3 Christian Religious Education topics remain source-required for objectives.
- Kiswahili Forms 1-4 remain active legacy/unverified data, with four `SOURCE UNAVAILABLE` exception records prepared for import.
- Official English rows whose source omits a printed code retain `null`; no code is invented.

## 8. Admin/Create Exam compatibility

- `/admin/curriculum` is prepared to load active rows in official order, show official codes and verification status, display Form topic-level objectives, and label source-required outcomes.
- Manual edits downgrade affected rows to unverified while retaining a pre-migration fallback.
- Create Exam is prepared to list only active roots after migration, preserve official ordering, and visibly label official, textbook-pending, and unverified topics.
- Server-side generation rejects inactive roots and passes Form objectives as topic-scoped guidance.
- Sub-topic deletion is blocked when a saved exam references its UUID.
- Query fallbacks keep the current pre-migration application functional.

## 9. Verification performed

- Read-only live schema/count/RLS-reference audit.
- Candidate structural validation and locked count assertions.
- Deterministic UUID and dataset-hash verification.
- Duplicate-name and repeated-code source cases tested without rewriting official wording.
- Historical exam UUID preservation impact calculated before any mutation.
- Final dry-run status: `BLOCKED_SCHEMA_MIGRATION_REQUIRED`.
- Dataset hash: `e48a9ea8d57afa46f1a84e0639b7c5861d32ef5504076cc4ecb1bd86aa8a0936`.

## 10. Tests/build

- `npm run test:curriculum`: 16 passed.
- `npm test`: 7 passed.
- `npm run lint`: passed.
- `npx tsc --noEmit`: passed.
- Production build result is recorded in the final task handoff.

## 11. Remaining blockers

- Apply `supabase/migrations/20260816170000_prepare_verified_curriculum_import.sql` using a Supabase migration-capable connection (linked CLI, database connection string, or SQL editor).
- The configured service-role key can call the import RPC after it exists, but cannot perform DDL.
- No linked Supabase CLI/project configuration, database URL/password, or executable SQL RPC is available in this workspace.
- The signed-in browser fallback could not initialize because of the local Windows sandbox.
- After applying the migration, run `npm run curriculum:import`, then rerun `npm run curriculum:audit` and verify `/admin/curriculum` plus the Create Exam selector against the live imported rows.
