-- ============================================================================
-- Add subjects required for Lower Primary (Grade 1-3) and Upper Primary
-- (Grade 4-6) curriculum: Creative Activities and Environmental Activities
-- carry only through Lower Primary; Science and Technology is the core
-- Upper Primary science subject and was missing entirely.
-- NOT YET APPLIED — for review.
-- Re-runnable: every insert is guarded with `where not exists`, so applying
-- this file more than once inserts nothing the second time.
-- ============================================================================

insert into subjects (name)
select v.name
from (values
  ('Creative Activities'),
  ('Environmental Activities'),
  ('Science and Technology')
) as v(name)
where not exists (
  select 1 from subjects s where s.name = v.name
);
