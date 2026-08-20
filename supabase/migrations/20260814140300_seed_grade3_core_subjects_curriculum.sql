-- ============================================================================
-- AI-generated curriculum structure (strands/sub_strands/learning_outcomes)
-- for Grade 3 (Lower Primary) core subjects — approximate content for MVP,
-- to be refined against official KICD sources later. Subject set matches
-- Grade 1-2 Lower Primary (Creative Activities and Environmental Activities
-- do not carry beyond Grade 3).
-- NOT YET APPLIED — for review.
-- Re-runnable: every insert is guarded with `where not exists`, so applying
-- this file more than once inserts nothing the second time.
-- ============================================================================

-- ---- English / Grade 3 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Listening and Speaking'),
  ('Reading'),
  ('Writing'),
  ('Grammar in Use')
) as v(name)
join subjects s on s.name = 'English'
join grades g on g.name = 'Grade 3'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Listening and Speaking', 'Pronunciation and Listening'),
  ('Listening and Speaking', 'Conversation and Polite Language'),
  ('Reading', 'Word Recognition and Fluency'),
  ('Reading', 'Reading Comprehension'),
  ('Writing', 'Handwriting and Spelling'),
  ('Writing', 'Guided Sentence and Paragraph Writing'),
  ('Grammar in Use', 'Nouns, Pronouns and Articles'),
  ('Grammar in Use', 'Verbs and Simple Tenses')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'English')
  and st.grade_id = (select id from grades where name = 'Grade 3')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Listening and Speaking', 'Pronunciation and Listening', 'The learner should be able to pronounce familiar English words clearly'),
  ('Listening and Speaking', 'Pronunciation and Listening', 'The learner should be able to listen to a short story and answer simple questions'),
  ('Listening and Speaking', 'Conversation and Polite Language', 'The learner should be able to hold a simple conversation with a peer'),
  ('Listening and Speaking', 'Conversation and Polite Language', 'The learner should be able to use polite expressions such as please and thank you'),
  ('Reading', 'Word Recognition and Fluency', 'The learner should be able to read common sight words accurately'),
  ('Reading', 'Word Recognition and Fluency', 'The learner should be able to read a short passage fluently'),
  ('Reading', 'Reading Comprehension', 'The learner should be able to read a short text and answer comprehension questions'),
  ('Reading', 'Reading Comprehension', 'The learner should be able to retell the main events of a story read'),
  ('Writing', 'Handwriting and Spelling', 'The learner should be able to write letters and words in neat, legible handwriting'),
  ('Writing', 'Handwriting and Spelling', 'The learner should be able to spell common everyday words correctly'),
  ('Writing', 'Guided Sentence and Paragraph Writing', 'The learner should be able to write complete sentences about a given picture'),
  ('Writing', 'Guided Sentence and Paragraph Writing', 'The learner should be able to write a short guided paragraph on a familiar topic'),
  ('Grammar in Use', 'Nouns, Pronouns and Articles', 'The learner should be able to identify and use singular and plural nouns correctly'),
  ('Grammar in Use', 'Nouns, Pronouns and Articles', 'The learner should be able to use articles a, an and the appropriately'),
  ('Grammar in Use', 'Verbs and Simple Tenses', 'The learner should be able to identify action words in a sentence'),
  ('Grammar in Use', 'Verbs and Simple Tenses', 'The learner should be able to use the simple present and past tense correctly')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'English')
  and st.grade_id = (select id from grades where name = 'Grade 3')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Kiswahili / Grade 3 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Kusikiliza na Kuzungumza'),
  ('Kusoma'),
  ('Kuandika'),
  ('Sarufi')
) as v(name)
join subjects s on s.name = 'Kiswahili'
join grades g on g.name = 'Grade 3'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Kusikiliza na Kuzungumza', 'Matamshi na Msamiati'),
  ('Kusikiliza na Kuzungumza', 'Hadithi na Maagizo'),
  ('Kusoma', 'Kusoma kwa Ufasaha'),
  ('Kusoma', 'Kusoma kwa Ufahamu'),
  ('Kuandika', 'Uandishi wa Vifungu'),
  ('Kuandika', 'Tahajia na Uakifishaji'),
  ('Sarufi', 'Aina za Maneno'),
  ('Sarufi', 'Umoja na Wingi')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Kiswahili')
  and st.grade_id = (select id from grades where name = 'Grade 3')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Kusikiliza na Kuzungumza', 'Matamshi na Msamiati', 'The learner should be able to tamka maneno ya Kiswahili kwa usahihi na ufasaha'),
  ('Kusikiliza na Kuzungumza', 'Matamshi na Msamiati', 'The learner should be able to tumia msamiati mpya katika mazungumzo'),
  ('Kusikiliza na Kuzungumza', 'Hadithi na Maagizo', 'The learner should be able to sikiliza hadithi na kutaja mafunzo yake'),
  ('Kusikiliza na Kuzungumza', 'Hadithi na Maagizo', 'The learner should be able to fuata maagizo ya hatua kadhaa kwa usahihi'),
  ('Kusoma', 'Kusoma kwa Ufasaha', 'The learner should be able to soma vifungu virefu kwa ufasaha na kasi ifaayo'),
  ('Kusoma', 'Kusoma kwa Ufasaha', 'The learner should be able to soma kwa kuzingatia alama za uakifishaji'),
  ('Kusoma', 'Kusoma kwa Ufahamu', 'The learner should be able to soma kifungu na kujibu maswali ya ufahamu'),
  ('Kusoma', 'Kusoma kwa Ufahamu', 'The learner should be able to tambua wazo kuu la kifungu alichosoma'),
  ('Kuandika', 'Uandishi wa Vifungu', 'The learner should be able to andika kifungu kifupi chenye mshikamano'),
  ('Kuandika', 'Uandishi wa Vifungu', 'The learner should be able to panga mawazo yake kwa mpangilio unaofaa'),
  ('Kuandika', 'Tahajia na Uakifishaji', 'The learner should be able to tahajia maneno ya kila siku kwa usahihi'),
  ('Kuandika', 'Tahajia na Uakifishaji', 'The learner should be able to tumia alama za uakifishaji ipasavyo'),
  ('Sarufi', 'Aina za Maneno', 'The learner should be able to tambua nomino, vitenzi na vivumishi katika sentensi'),
  ('Sarufi', 'Aina za Maneno', 'The learner should be able to tumia aina mbalimbali za maneno kwa usahihi'),
  ('Sarufi', 'Umoja na Wingi', 'The learner should be able to badilisha sentensi kutoka umoja kwenda wingi'),
  ('Sarufi', 'Umoja na Wingi', 'The learner should be able to onyesha upatanisho wa kisarufi katika sentensi')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Kiswahili')
  and st.grade_id = (select id from grades where name = 'Grade 3')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Mathematics / Grade 3 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Numbers'),
  ('Measurements'),
  ('Geometry')
) as v(name)
join subjects s on s.name = 'Mathematics'
join grades g on g.name = 'Grade 3'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Numbers', 'Whole Numbers'),
  ('Numbers', 'Addition and Subtraction'),
  ('Numbers', 'Multiplication and Division'),
  ('Numbers', 'Fractions'),
  ('Measurements', 'Length, Mass and Capacity'),
  ('Measurements', 'Time and Money'),
  ('Geometry', 'Lines and Angles'),
  ('Geometry', 'Shapes and Symmetry')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Mathematics')
  and st.grade_id = (select id from grades where name = 'Grade 3')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Numbers', 'Whole Numbers', 'The learner should be able to read, write and order numbers up to 1000'),
  ('Numbers', 'Whole Numbers', 'The learner should be able to identify place value of digits in a three-digit number'),
  ('Numbers', 'Addition and Subtraction', 'The learner should be able to add and subtract three-digit numbers with regrouping'),
  ('Numbers', 'Addition and Subtraction', 'The learner should be able to solve real-life problems involving addition and subtraction'),
  ('Numbers', 'Multiplication and Division', 'The learner should be able to recall multiplication facts up to 10 times table'),
  ('Numbers', 'Multiplication and Division', 'The learner should be able to divide numbers with and without remainders'),
  ('Numbers', 'Fractions', 'The learner should be able to identify and compare simple fractions'),
  ('Numbers', 'Fractions', 'The learner should be able to add and subtract fractions with the same denominator'),
  ('Measurements', 'Length, Mass and Capacity', 'The learner should be able to measure and convert length, mass and capacity in standard units'),
  ('Measurements', 'Length, Mass and Capacity', 'The learner should be able to solve real-life problems involving measurement'),
  ('Measurements', 'Time and Money', 'The learner should be able to tell time to the nearest five minutes'),
  ('Measurements', 'Time and Money', 'The learner should be able to solve problems involving buying, selling and change'),
  ('Geometry', 'Lines and Angles', 'The learner should be able to identify parallel and perpendicular lines'),
  ('Geometry', 'Lines and Angles', 'The learner should be able to identify right angles in the environment'),
  ('Geometry', 'Shapes and Symmetry', 'The learner should be able to identify and describe two-dimensional and three-dimensional shapes'),
  ('Geometry', 'Shapes and Symmetry', 'The learner should be able to identify lines of symmetry in simple shapes')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Mathematics')
  and st.grade_id = (select id from grades where name = 'Grade 3')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Creative Activities / Grade 3 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Creating and Execution'),
  ('Performing and Display'),
  ('Appreciation')
) as v(name)
join subjects s on s.name = 'Creative Activities'
join grades g on g.name = 'Grade 3'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Creating and Execution', 'Skipping and Jumping'),
  ('Creating and Execution', 'Drawing and Painting'),
  ('Creating and Execution', 'Rhythm and Melody'),
  ('Creating and Execution', 'Pattern and Texture'),
  ('Performing and Display', 'Ball Games Skills'),
  ('Performing and Display', 'Craft and Weaving'),
  ('Performing and Display', 'Gymnastics: Rolls and Balances'),
  ('Performing and Display', 'Musical Instruments'),
  ('Appreciation', 'Appreciating Own and Others'' Work'),
  ('Appreciation', 'Safety in Play and Water')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Creative Activities')
  and st.grade_id = (select id from grades where name = 'Grade 3')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Creating and Execution', 'Skipping and Jumping', 'The learner should be able to skip using a rope with correct rhythm'),
  ('Creating and Execution', 'Skipping and Jumping', 'The learner should be able to perform a running jump with a safe landing'),
  ('Creating and Execution', 'Drawing and Painting', 'The learner should be able to draw a picture showing foreground and background'),
  ('Creating and Execution', 'Drawing and Painting', 'The learner should be able to apply colour to create mood in a painting'),
  ('Creating and Execution', 'Rhythm and Melody', 'The learner should be able to create and perform a simple rhythmic pattern'),
  ('Creating and Execution', 'Rhythm and Melody', 'The learner should be able to sing a melody in tune with correct phrasing'),
  ('Creating and Execution', 'Pattern and Texture', 'The learner should be able to create patterns using different textures'),
  ('Creating and Execution', 'Pattern and Texture', 'The learner should be able to identify textures in natural and manufactured objects'),
  ('Performing and Display', 'Ball Games Skills', 'The learner should be able to throw, catch and kick a ball with control'),
  ('Performing and Display', 'Ball Games Skills', 'The learner should be able to participate in simple team ball games observing rules'),
  ('Performing and Display', 'Craft and Weaving', 'The learner should be able to weave simple items using locally available materials'),
  ('Performing and Display', 'Craft and Weaving', 'The learner should be able to describe the process used to make a woven item'),
  ('Performing and Display', 'Gymnastics: Rolls and Balances', 'The learner should be able to perform forward and backward rolls safely'),
  ('Performing and Display', 'Gymnastics: Rolls and Balances', 'The learner should be able to hold different balance positions with control'),
  ('Performing and Display', 'Musical Instruments', 'The learner should be able to classify musical instruments as percussion, wind or string'),
  ('Performing and Display', 'Musical Instruments', 'The learner should be able to play a simple tune on a chosen instrument'),
  ('Appreciation', 'Appreciating Own and Others'' Work', 'The learner should be able to talk about what they like in their own creative work'),
  ('Appreciation', 'Appreciating Own and Others'' Work', 'The learner should be able to appreciate the creative work of their peers respectfully'),
  ('Appreciation', 'Safety in Play and Water', 'The learner should be able to observe safety rules during play activities'),
  ('Appreciation', 'Safety in Play and Water', 'The learner should be able to explain safety precautions to take around water')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Creative Activities')
  and st.grade_id = (select id from grades where name = 'Grade 3')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Environmental Activities / Grade 3 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Social Environment'),
  ('Natural Environment'),
  ('Resources in Our Environment')
) as v(name)
join subjects s on s.name = 'Environmental Activities'
join grades g on g.name = 'Grade 3'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Social Environment', 'Our Community'),
  ('Social Environment', 'Our County and Country'),
  ('Social Environment', 'Health and Hygiene'),
  ('Natural Environment', 'Weather and Seasons'),
  ('Natural Environment', 'Soil and Water'),
  ('Natural Environment', 'Light, Sound and Heat'),
  ('Resources in Our Environment', 'Plants and Animals'),
  ('Resources in Our Environment', 'Caring for the Environment')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Environmental Activities')
  and st.grade_id = (select id from grades where name = 'Grade 3')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Social Environment', 'Our Community', 'The learner should be able to identify people who provide services in the community'),
  ('Social Environment', 'Our Community', 'The learner should be able to explain the importance of living harmoniously in a community'),
  ('Social Environment', 'Our County and Country', 'The learner should be able to name their county and its major features'),
  ('Social Environment', 'Our County and Country', 'The learner should be able to identify national symbols of Kenya'),
  ('Social Environment', 'Health and Hygiene', 'The learner should be able to describe practices that promote good health'),
  ('Social Environment', 'Health and Hygiene', 'The learner should be able to explain how to prevent common illnesses'),
  ('Natural Environment', 'Weather and Seasons', 'The learner should be able to describe the different seasons and their characteristics'),
  ('Natural Environment', 'Weather and Seasons', 'The learner should be able to explain how seasons affect farming activities'),
  ('Natural Environment', 'Soil and Water', 'The learner should be able to describe how soil and water support plant growth'),
  ('Natural Environment', 'Soil and Water', 'The learner should be able to explain ways of conserving soil and water'),
  ('Natural Environment', 'Light, Sound and Heat', 'The learner should be able to identify sources of light, sound and heat'),
  ('Natural Environment', 'Light, Sound and Heat', 'The learner should be able to explain the uses of light, sound and heat in daily life'),
  ('Resources in Our Environment', 'Plants and Animals', 'The learner should be able to classify plants and animals based on observable features'),
  ('Resources in Our Environment', 'Plants and Animals', 'The learner should be able to explain the interdependence of plants and animals'),
  ('Resources in Our Environment', 'Caring for the Environment', 'The learner should be able to identify activities that pollute the environment'),
  ('Resources in Our Environment', 'Caring for the Environment', 'The learner should be able to practise simple ways of conserving the environment')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Environmental Activities')
  and st.grade_id = (select id from grades where name = 'Grade 3')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);
