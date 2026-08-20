-- ============================================================================
-- Checkpoint: AI-generated curriculum structure (strands/sub_strands/
-- learning_outcomes) for Form 3 core subjects — approximate content
-- for MVP, to be refined against official KICD sources later.
-- NOT YET APPLIED — for review.
-- Re-runnable: every insert is guarded with `where not exists`, so applying
-- this file more than once inserts nothing the second time.
-- ============================================================================

-- ---- English / Form 3 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Listening and Speaking'),
  ('Reading'),
  ('Writing'),
  ('Grammar in Use'),
  ('Literature in English')
) as v(name)
join subjects s on s.name = 'English'
join grades g on g.name = 'Form 3'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Listening and Speaking', 'Debate and Public Speaking'),
  ('Listening and Speaking', 'Listening for Note-Taking'),
  ('Reading', 'Critical Reading and Inference'),
  ('Reading', 'Novel Study'),
  ('Writing', 'Argumentative and Discursive Essays'),
  ('Writing', 'Report Writing'),
  ('Grammar in Use', 'Complex Sentences and Clauses'),
  ('Grammar in Use', 'Figures of Speech'),
  ('Literature in English', 'The Novel'),
  ('Literature in English', 'Drama and Play Study')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'English')
  and st.grade_id = (select id from grades where name = 'Form 3')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Listening and Speaking', 'Debate and Public Speaking', 'The learner should be able to present a persuasive argument on a given motion'),
  ('Listening and Speaking', 'Debate and Public Speaking', 'The learner should be able to listen attentively and respond appropriately during a debate'),
  ('Listening and Speaking', 'Listening for Note-Taking', 'The learner should be able to take accurate notes while listening to a talk or lecture'),
  ('Listening and Speaking', 'Listening for Note-Taking', 'The learner should be able to organise notes taken from an oral presentation logically'),
  ('Reading', 'Critical Reading and Inference', 'The learner should be able to evaluate the writer''s purpose and viewpoint in a text'),
  ('Reading', 'Critical Reading and Inference', 'The learner should be able to draw logical conclusions from a given passage'),
  ('Reading', 'Novel Study', 'The learner should be able to analyse the plot, characters and themes of a novel'),
  ('Reading', 'Novel Study', 'The learner should be able to discuss the relevance of a novel''s themes to society today'),
  ('Writing', 'Argumentative and Discursive Essays', 'The learner should be able to write a well-structured argumentative essay defending a position'),
  ('Writing', 'Argumentative and Discursive Essays', 'The learner should be able to present balanced arguments in a discursive essay'),
  ('Writing', 'Report Writing', 'The learner should be able to write a factual report following the correct structure'),
  ('Writing', 'Report Writing', 'The learner should be able to present information in a report clearly and objectively'),
  ('Grammar in Use', 'Complex Sentences and Clauses', 'The learner should be able to construct complex sentences using subordinate clauses'),
  ('Grammar in Use', 'Complex Sentences and Clauses', 'The learner should be able to identify and correct sentence fragments and run-on sentences'),
  ('Grammar in Use', 'Figures of Speech', 'The learner should be able to identify figures of speech such as simile, metaphor and personification'),
  ('Grammar in Use', 'Figures of Speech', 'The learner should be able to use figurative language appropriately in own writing'),
  ('Literature in English', 'The Novel', 'The learner should be able to evaluate the author''s style and its effect on the reader'),
  ('Literature in English', 'The Novel', 'The learner should be able to compare themes across two different literary texts'),
  ('Literature in English', 'Drama and Play Study', 'The learner should be able to analyse the characters and conflict in a play'),
  ('Literature in English', 'Drama and Play Study', 'The learner should be able to perform a scripted scene with appropriate expression')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'English')
  and st.grade_id = (select id from grades where name = 'Form 3')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Kiswahili / Form 3 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Kusikiliza na Kuzungumza'),
  ('Kusoma'),
  ('Kuandika'),
  ('Sarufi na Matumizi ya Lugha'),
  ('Fasihi')
) as v(name)
join subjects s on s.name = 'Kiswahili'
join grades g on g.name = 'Form 3'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Kusikiliza na Kuzungumza', 'Hotuba'),
  ('Kusikiliza na Kuzungumza', 'Majadiliano ya Kikundi'),
  ('Kusoma', 'Ufahamu wa Uchambuzi'),
  ('Kusoma', 'Tamthilia Teule'),
  ('Kuandika', 'Insha za Hoja'),
  ('Kuandika', 'Ripoti'),
  ('Sarufi na Matumizi ya Lugha', 'Vishazi na Sentensi Changamano'),
  ('Sarufi na Matumizi ya Lugha', 'Tamathali za Semi'),
  ('Fasihi', 'Tamthilia'),
  ('Fasihi', 'Riwaya Teule (Uchambuzi wa Kina)')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Kiswahili')
  and st.grade_id = (select id from grades where name = 'Form 3')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Kusikiliza na Kuzungumza', 'Hotuba', 'The learner should be able to toa hoja za kuridhisha kuhusu mada aliyopewa'),
  ('Kusikiliza na Kuzungumza', 'Hotuba', 'The learner should be able to sikiliza kwa makini na kujibu maswali baada ya hotuba'),
  ('Kusikiliza na Kuzungumza', 'Majadiliano ya Kikundi', 'The learner should be able to changia kwa ufanisi katika majadiliano ya kikundi'),
  ('Kusikiliza na Kuzungumza', 'Majadiliano ya Kikundi', 'The learner should be able to fupisha matokeo ya majadiliano ya kikundi'),
  ('Kusoma', 'Ufahamu wa Uchambuzi', 'The learner should be able to tathmini lengo na mtazamo wa mwandishi katika kifungu'),
  ('Kusoma', 'Ufahamu wa Uchambuzi', 'The learner should be able to toa hitimisho la kimantiki kutokana na kifungu'),
  ('Kusoma', 'Tamthilia Teule', 'The learner should be able to changanua wahusika na mgogoro katika tamthilia teule'),
  ('Kusoma', 'Tamthilia Teule', 'The learner should be able to husisha maudhui ya tamthilia na maisha ya sasa'),
  ('Kuandika', 'Insha za Hoja', 'The learner should be able to andika insha ya kuhoji akitetea msimamo wake kwa mantiki'),
  ('Kuandika', 'Insha za Hoja', 'The learner should be able to andika insha ya maelezo kwa kutumia lugha ya taswira'),
  ('Kuandika', 'Ripoti', 'The learner should be able to andika ripoti sahihi kwa kufuata muundo unaofaa'),
  ('Kuandika', 'Ripoti', 'The learner should be able to wasilisha habari katika ripoti kwa uwazi na uhalisia'),
  ('Sarufi na Matumizi ya Lugha', 'Vishazi na Sentensi Changamano', 'The learner should be able to tunga sentensi changamano kwa kutumia vishazi tegemezi'),
  ('Sarufi na Matumizi ya Lugha', 'Vishazi na Sentensi Changamano', 'The learner should be able to tambua na kurekebisha sentensi butu'),
  ('Sarufi na Matumizi ya Lugha', 'Tamathali za Semi', 'The learner should be able to tambua tamathali za semi kama sitiari na tashbihi'),
  ('Sarufi na Matumizi ya Lugha', 'Tamathali za Semi', 'The learner should be able to tumia tamathali za semi ipasavyo katika uandishi'),
  ('Fasihi', 'Tamthilia', 'The learner should be able to changanua muundo na mtindo wa tamthilia teule'),
  ('Fasihi', 'Tamthilia', 'The learner should be able to igiza tukio la tamthilia kwa hisia zinazofaa'),
  ('Fasihi', 'Riwaya Teule (Uchambuzi wa Kina)', 'The learner should be able to tathmini mtindo wa mwandishi na athari yake kwa msomaji'),
  ('Fasihi', 'Riwaya Teule (Uchambuzi wa Kina)', 'The learner should be able to linganisha maudhui ya riwaya na hali halisi ya jamii')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Kiswahili')
  and st.grade_id = (select id from grades where name = 'Form 3')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Mathematics / Form 3 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Numbers'),
  ('Algebra'),
  ('Measurement'),
  ('Geometry'),
  ('Data Handling and Probability')
) as v(name)
join subjects s on s.name = 'Mathematics'
join grades g on g.name = 'Form 3'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Numbers', 'Surds and Further Indices'),
  ('Numbers', 'Approximation and Errors'),
  ('Algebra', 'Matrices and Simultaneous Equations'),
  ('Algebra', 'Sequences and Series'),
  ('Measurement', 'Compound Proportions, Rates of Work and Mixtures'),
  ('Measurement', 'Longitude and Latitude'),
  ('Geometry', 'Circles: Chords and Tangents'),
  ('Geometry', 'Vectors in Three Dimensions'),
  ('Data Handling and Probability', 'Probability of Combined Events'),
  ('Data Handling and Probability', 'Trigonometric Identities and Graphs')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Mathematics')
  and st.grade_id = (select id from grades where name = 'Form 3')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Numbers', 'Surds and Further Indices', 'The learner should be able to simplify expressions involving surds'),
  ('Numbers', 'Surds and Further Indices', 'The learner should be able to rationalise the denominator of an expression containing a surd'),
  ('Numbers', 'Approximation and Errors', 'The learner should be able to determine absolute, relative and percentage error in a measurement'),
  ('Numbers', 'Approximation and Errors', 'The learner should be able to apply approximation and error analysis to real-life computations'),
  ('Algebra', 'Matrices and Simultaneous Equations', 'The learner should be able to perform operations on matrices up to order 3 by 3'),
  ('Algebra', 'Matrices and Simultaneous Equations', 'The learner should be able to use matrices to solve simultaneous linear equations'),
  ('Algebra', 'Sequences and Series', 'The learner should be able to identify the pattern and general term of a given sequence'),
  ('Algebra', 'Sequences and Series', 'The learner should be able to calculate the sum of arithmetic and geometric series'),
  ('Measurement', 'Compound Proportions, Rates of Work and Mixtures', 'The learner should be able to solve problems involving compound proportions'),
  ('Measurement', 'Compound Proportions, Rates of Work and Mixtures', 'The learner should be able to solve problems involving rates of work and mixtures'),
  ('Measurement', 'Longitude and Latitude', 'The learner should be able to locate positions on the earth''s surface using longitude and latitude'),
  ('Measurement', 'Longitude and Latitude', 'The learner should be able to calculate distances between two points along a great circle and a parallel of latitude'),
  ('Geometry', 'Circles: Chords and Tangents', 'The learner should be able to state and apply properties of chords of a circle'),
  ('Geometry', 'Circles: Chords and Tangents', 'The learner should be able to construct tangents to a circle from a given external point'),
  ('Geometry', 'Vectors in Three Dimensions', 'The learner should be able to represent and perform operations on vectors in three dimensions'),
  ('Geometry', 'Vectors in Three Dimensions', 'The learner should be able to apply vectors to determine position and ratio of division of a line'),
  ('Data Handling and Probability', 'Probability of Combined Events', 'The learner should be able to calculate the probability of independent and mutually exclusive events'),
  ('Data Handling and Probability', 'Probability of Combined Events', 'The learner should be able to use tree diagrams to determine probabilities of combined events'),
  ('Data Handling and Probability', 'Trigonometric Identities and Graphs', 'The learner should be able to derive and apply basic trigonometric identities'),
  ('Data Handling and Probability', 'Trigonometric Identities and Graphs', 'The learner should be able to draw and interpret graphs of trigonometric functions')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Mathematics')
  and st.grade_id = (select id from grades where name = 'Form 3')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Chemistry / Form 3 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Introduction to Chemistry and Matter'),
  ('Structure of Matter and Bonding'),
  ('Acids, Bases and Salts'),
  ('Chemical Reactions and Energetics'),
  ('Chemistry of Elements and Compounds')
) as v(name)
join subjects s on s.name = 'Chemistry'
join grades g on g.name = 'Form 3'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Introduction to Chemistry and Matter', 'Organic Chemistry I: Introduction'),
  ('Introduction to Chemistry and Matter', 'The Mole Concept'),
  ('Structure of Matter and Bonding', 'Chemical Bonding: Advanced'),
  ('Structure of Matter and Bonding', 'Electrolysis'),
  ('Acids, Bases and Salts', 'Acid-Base Titrations'),
  ('Acids, Bases and Salts', 'Salts Solubility'),
  ('Chemical Reactions and Energetics', 'Energy Changes in Chemical Reactions'),
  ('Chemical Reactions and Energetics', 'Rates of Reaction'),
  ('Chemistry of Elements and Compounds', 'Sulphur and its Compounds'),
  ('Chemistry of Elements and Compounds', 'Nitrogen and its Compounds')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Chemistry')
  and st.grade_id = (select id from grades where name = 'Form 3')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Introduction to Chemistry and Matter', 'Organic Chemistry I: Introduction', 'The learner should be able to distinguish between organic and inorganic compounds'),
  ('Introduction to Chemistry and Matter', 'Organic Chemistry I: Introduction', 'The learner should be able to name simple hydrocarbons using IUPAC nomenclature'),
  ('Introduction to Chemistry and Matter', 'The Mole Concept', 'The learner should be able to define the mole and relate it to Avogadro''s number'),
  ('Introduction to Chemistry and Matter', 'The Mole Concept', 'The learner should be able to perform calculations involving moles, mass and volume'),
  ('Structure of Matter and Bonding', 'Chemical Bonding: Advanced', 'The learner should be able to explain the properties of substances in terms of their bond type'),
  ('Structure of Matter and Bonding', 'Chemical Bonding: Advanced', 'The learner should be able to relate structure and bonding to the physical properties of substances'),
  ('Structure of Matter and Bonding', 'Electrolysis', 'The learner should be able to describe the process of electrolysis of selected electrolytes'),
  ('Structure of Matter and Bonding', 'Electrolysis', 'The learner should be able to state the industrial applications of electrolysis'),
  ('Acids, Bases and Salts', 'Acid-Base Titrations', 'The learner should be able to carry out a simple acid-base titration and record results'),
  ('Acids, Bases and Salts', 'Acid-Base Titrations', 'The learner should be able to perform calculations based on titration results'),
  ('Acids, Bases and Salts', 'Salts Solubility', 'The learner should be able to describe factors affecting the solubility of salts'),
  ('Acids, Bases and Salts', 'Salts Solubility', 'The learner should be able to interpret a solubility curve'),
  ('Chemical Reactions and Energetics', 'Energy Changes in Chemical Reactions', 'The learner should be able to calculate the heat of reaction from experimental data'),
  ('Chemical Reactions and Energetics', 'Energy Changes in Chemical Reactions', 'The learner should be able to explain energy changes using bond breaking and bond formation'),
  ('Chemical Reactions and Energetics', 'Rates of Reaction', 'The learner should be able to describe factors that affect the rate of a chemical reaction'),
  ('Chemical Reactions and Energetics', 'Rates of Reaction', 'The learner should be able to interpret graphs showing the rate of a chemical reaction'),
  ('Chemistry of Elements and Compounds', 'Sulphur and its Compounds', 'The learner should be able to describe the extraction and properties of sulphur'),
  ('Chemistry of Elements and Compounds', 'Sulphur and its Compounds', 'The learner should be able to describe the manufacture and uses of sulphuric acid'),
  ('Chemistry of Elements and Compounds', 'Nitrogen and its Compounds', 'The learner should be able to describe the industrial manufacture of ammonia'),
  ('Chemistry of Elements and Compounds', 'Nitrogen and its Compounds', 'The learner should be able to state the uses of nitrogen and its compounds')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Chemistry')
  and st.grade_id = (select id from grades where name = 'Form 3')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Biology / Form 3 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Cell Biology and Classification'),
  ('Nutrition and Transport'),
  ('Reproduction and Growth'),
  ('Genetics and Evolution'),
  ('Ecology and Environment')
) as v(name)
join subjects s on s.name = 'Biology'
join grades g on g.name = 'Form 3'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Cell Biology and Classification', 'Cell Physiology: Advanced'),
  ('Cell Biology and Classification', 'Excretion'),
  ('Nutrition and Transport', 'Circulatory System'),
  ('Nutrition and Transport', 'Homeostasis and Temperature Regulation'),
  ('Reproduction and Growth', 'Reproduction in Humans'),
  ('Reproduction and Growth', 'Growth and Development in Animals'),
  ('Genetics and Evolution', 'Genetics: Mendelian Inheritance'),
  ('Genetics and Evolution', 'Reproduction in Plants: Advanced'),
  ('Ecology and Environment', 'Ecology III: Population Studies'),
  ('Ecology and Environment', 'Conservation of Environment')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Biology')
  and st.grade_id = (select id from grades where name = 'Form 3')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Cell Biology and Classification', 'Cell Physiology: Advanced', 'The learner should be able to explain the mechanism of active transport across cell membranes'),
  ('Cell Biology and Classification', 'Cell Physiology: Advanced', 'The learner should be able to relate cell physiology processes to homeostasis'),
  ('Cell Biology and Classification', 'Excretion', 'The learner should be able to describe the structure and function of the human excretory system'),
  ('Cell Biology and Classification', 'Excretion', 'The learner should be able to explain the process of formation of urine in the kidney'),
  ('Nutrition and Transport', 'Circulatory System', 'The learner should be able to describe the structure and function of the mammalian heart'),
  ('Nutrition and Transport', 'Circulatory System', 'The learner should be able to trace the path of blood circulation in the human body'),
  ('Nutrition and Transport', 'Homeostasis and Temperature Regulation', 'The learner should be able to explain the concept of homeostasis in living organisms'),
  ('Nutrition and Transport', 'Homeostasis and Temperature Regulation', 'The learner should be able to describe mechanisms of temperature regulation in mammals'),
  ('Reproduction and Growth', 'Reproduction in Humans', 'The learner should be able to describe the structure and function of the human reproductive system'),
  ('Reproduction and Growth', 'Reproduction in Humans', 'The learner should be able to describe the menstrual cycle and its hormonal control'),
  ('Reproduction and Growth', 'Growth and Development in Animals', 'The learner should be able to describe patterns of growth and development in animals'),
  ('Reproduction and Growth', 'Growth and Development in Animals', 'The learner should be able to interpret a growth curve for a named organism'),
  ('Genetics and Evolution', 'Genetics: Mendelian Inheritance', 'The learner should be able to explain the basic principles of Mendelian inheritance'),
  ('Genetics and Evolution', 'Genetics: Mendelian Inheritance', 'The learner should be able to solve simple monohybrid genetic crosses'),
  ('Genetics and Evolution', 'Reproduction in Plants: Advanced', 'The learner should be able to describe mechanisms that promote cross-pollination in plants'),
  ('Genetics and Evolution', 'Reproduction in Plants: Advanced', 'The learner should be able to describe the dispersal of fruits and seeds'),
  ('Ecology and Environment', 'Ecology III: Population Studies', 'The learner should be able to describe factors that affect population size in an ecosystem'),
  ('Ecology and Environment', 'Ecology III: Population Studies', 'The learner should be able to estimate population size using sampling techniques'),
  ('Ecology and Environment', 'Conservation of Environment', 'The learner should be able to identify human activities that degrade the environment'),
  ('Ecology and Environment', 'Conservation of Environment', 'The learner should be able to explain measures for conserving the environment')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Biology')
  and st.grade_id = (select id from grades where name = 'Form 3')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Physics / Form 3 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Measurement and Mechanics'),
  ('Heat and Matter'),
  ('Waves, Light and Sound'),
  ('Electricity and Magnetism'),
  ('Modern Physics and Energy')
) as v(name)
join subjects s on s.name = 'Physics'
join grades g on g.name = 'Form 3'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Measurement and Mechanics', 'Linear Motion and Newton''s Laws'),
  ('Measurement and Mechanics', 'Work, Energy and Power'),
  ('Heat and Matter', 'Gas Laws'),
  ('Heat and Matter', 'Refraction of Light'),
  ('Waves, Light and Sound', 'Waves: Properties and Types'),
  ('Waves, Light and Sound', 'Lenses'),
  ('Electricity and Magnetism', 'Electromagnetic Induction'),
  ('Electricity and Magnetism', 'Electric Circuits: Advanced'),
  ('Modern Physics and Energy', 'Cathode Rays and Electronics: An Introduction'),
  ('Modern Physics and Energy', 'Thin Lenses and Optical Instruments')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Physics')
  and st.grade_id = (select id from grades where name = 'Form 3')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Measurement and Mechanics', 'Linear Motion and Newton''s Laws', 'The learner should be able to derive and apply the equations of uniformly accelerated motion'),
  ('Measurement and Mechanics', 'Linear Motion and Newton''s Laws', 'The learner should be able to state and apply Newton''s laws of motion to solve problems'),
  ('Measurement and Mechanics', 'Work, Energy and Power', 'The learner should be able to calculate work done, energy and power in given situations'),
  ('Measurement and Mechanics', 'Work, Energy and Power', 'The learner should be able to apply the law of conservation of energy to solve problems'),
  ('Heat and Matter', 'Gas Laws', 'The learner should be able to state and apply Boyle''s and Charles''s laws'),
  ('Heat and Matter', 'Gas Laws', 'The learner should be able to apply the general gas equation to solve numerical problems'),
  ('Heat and Matter', 'Refraction of Light', 'The learner should be able to state the laws of refraction and define refractive index'),
  ('Heat and Matter', 'Refraction of Light', 'The learner should be able to explain total internal reflection and its applications'),
  ('Waves, Light and Sound', 'Waves: Properties and Types', 'The learner should be able to distinguish between transverse and longitudinal waves'),
  ('Waves, Light and Sound', 'Waves: Properties and Types', 'The learner should be able to relate wave speed, frequency and wavelength'),
  ('Waves, Light and Sound', 'Lenses', 'The learner should be able to describe image formation by converging and diverging lenses'),
  ('Waves, Light and Sound', 'Lenses', 'The learner should be able to apply the lens formula to solve numerical problems'),
  ('Electricity and Magnetism', 'Electromagnetic Induction', 'The learner should be able to describe the phenomenon of electromagnetic induction'),
  ('Electricity and Magnetism', 'Electromagnetic Induction', 'The learner should be able to state applications of electromagnetic induction in generators and transformers'),
  ('Electricity and Magnetism', 'Electric Circuits: Advanced', 'The learner should be able to analyse series and parallel circuits using Kirchhoff''s laws'),
  ('Electricity and Magnetism', 'Electric Circuits: Advanced', 'The learner should be able to calculate effective resistance in combined circuits'),
  ('Modern Physics and Energy', 'Cathode Rays and Electronics: An Introduction', 'The learner should be able to describe the production and properties of cathode rays'),
  ('Modern Physics and Energy', 'Cathode Rays and Electronics: An Introduction', 'The learner should be able to explain the working of a simple cathode ray oscilloscope'),
  ('Modern Physics and Energy', 'Thin Lenses and Optical Instruments', 'The learner should be able to describe the working of the human eye as an optical instrument'),
  ('Modern Physics and Energy', 'Thin Lenses and Optical Instruments', 'The learner should be able to explain the construction and use of simple optical instruments')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Physics')
  and st.grade_id = (select id from grades where name = 'Form 3')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Christian Religious Education / Form 3 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('The Bible'),
  ('Christian Values'),
  ('Christian Living'),
  ('The Church')
) as v(name)
join subjects s on s.name = 'Christian Religious Education'
join grades g on g.name = 'Form 3'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('The Bible', 'The Life and Ministry of Jesus Christ'),
  ('The Bible', 'The Passion, Death and Resurrection'),
  ('Christian Values', 'The Kingdom of God and Christian Ethics'),
  ('Christian Values', 'Love, Marriage and Family Life'),
  ('Christian Living', 'Handling Peer Pressure and Temptation'),
  ('Christian Living', 'Christian Attitude to Work and Wealth'),
  ('The Church', 'The Growth of the Early Church'),
  ('The Church', 'Church and State Relations')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Christian Religious Education')
  and st.grade_id = (select id from grades where name = 'Form 3')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('The Bible', 'The Life and Ministry of Jesus Christ', 'The learner should be able to narrate key events in the life and ministry of Jesus Christ'),
  ('The Bible', 'The Life and Ministry of Jesus Christ', 'The learner should be able to explain the significance of Jesus'' teachings and miracles'),
  ('The Bible', 'The Passion, Death and Resurrection', 'The learner should be able to narrate the events of the passion, death and resurrection of Jesus'),
  ('The Bible', 'The Passion, Death and Resurrection', 'The learner should be able to explain the significance of the resurrection to Christian faith'),
  ('Christian Values', 'The Kingdom of God and Christian Ethics', 'The learner should be able to explain the concept of the Kingdom of God as taught by Jesus'),
  ('Christian Values', 'The Kingdom of God and Christian Ethics', 'The learner should be able to relate the ethics of the Kingdom of God to everyday decision-making'),
  ('Christian Values', 'Love, Marriage and Family Life', 'The learner should be able to explain the Christian teaching on love, marriage and family'),
  ('Christian Values', 'Love, Marriage and Family Life', 'The learner should be able to describe the responsibilities of family members towards each other'),
  ('Christian Living', 'Handling Peer Pressure and Temptation', 'The learner should be able to explain the Christian response to peer pressure and temptation'),
  ('Christian Living', 'Handling Peer Pressure and Temptation', 'The learner should be able to demonstrate strategies for resisting negative peer pressure'),
  ('Christian Living', 'Christian Attitude to Work and Wealth', 'The learner should be able to explain the Christian teaching on stewardship of resources'),
  ('Christian Living', 'Christian Attitude to Work and Wealth', 'The learner should be able to demonstrate responsible use of personal and communal resources'),
  ('The Church', 'The Growth of the Early Church', 'The learner should be able to describe the growth and spread of the early Church'),
  ('The Church', 'The Growth of the Early Church', 'The learner should be able to explain the challenges faced by the early Church'),
  ('The Church', 'Church and State Relations', 'The learner should be able to explain the relationship between the Church and the state'),
  ('The Church', 'Church and State Relations', 'The learner should be able to describe the role of the Church in nation-building')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Christian Religious Education')
  and st.grade_id = (select id from grades where name = 'Form 3')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);
