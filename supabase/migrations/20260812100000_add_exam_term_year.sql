-- ============================================================================
-- Add term/year to exams (needed for the exam-creation wizard's
-- Class Details step: Level/Grade/Term required, Year optional).
-- NOT YET APPLIED — for review.
-- ============================================================================

alter table exams
  add column term text not null check (term in ('Term 1', 'Term 2', 'Term 3')),
  add column year integer;
