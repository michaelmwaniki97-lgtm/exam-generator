-- ============================================================================
-- Checkpoint: AI-generated curriculum structure (strands/sub_strands/
-- learning_outcomes) for Form 2 core subjects — approximate content
-- for MVP, to be refined against official KICD sources later.
-- NOT YET APPLIED — for review.
-- Re-runnable: every insert is guarded with `where not exists`, so applying
-- this file more than once inserts nothing the second time.
-- ============================================================================

-- ---- English / Form 2 ----

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
join grades g on g.name = 'Form 2'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Listening and Speaking', 'Interview Skills'),
  ('Listening and Speaking', 'Group Discussion Skills'),
  ('Reading', 'Intensive Reading and Comprehension'),
  ('Reading', 'Class Reader Study'),
  ('Writing', 'Narrative and Descriptive Composition'),
  ('Writing', 'Formal Letters'),
  ('Grammar in Use', 'Tenses and Concord'),
  ('Grammar in Use', 'Direct and Reported Speech'),
  ('Literature in English', 'The Short Story'),
  ('Literature in English', 'Poetry Appreciation')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'English')
  and st.grade_id = (select id from grades where name = 'Form 2')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Listening and Speaking', 'Interview Skills', 'The learner should be able to conduct a simple interview using well-structured questions'),
  ('Listening and Speaking', 'Interview Skills', 'The learner should be able to respond confidently and clearly to interview questions'),
  ('Listening and Speaking', 'Group Discussion Skills', 'The learner should be able to contribute constructively to a group discussion'),
  ('Listening and Speaking', 'Group Discussion Skills', 'The learner should be able to summarise the key points raised during a discussion'),
  ('Reading', 'Intensive Reading and Comprehension', 'The learner should be able to infer the meaning of unfamiliar words from context'),
  ('Reading', 'Intensive Reading and Comprehension', 'The learner should be able to distinguish fact from opinion in a given passage'),
  ('Reading', 'Class Reader Study', 'The learner should be able to analyse the main characters and themes in a class reader'),
  ('Reading', 'Class Reader Study', 'The learner should be able to relate events in a class reader to real-life experiences'),
  ('Writing', 'Narrative and Descriptive Composition', 'The learner should be able to write an imaginative story with a clear plot structure'),
  ('Writing', 'Narrative and Descriptive Composition', 'The learner should be able to use descriptive language to vividly portray a setting or character'),
  ('Writing', 'Formal Letters', 'The learner should be able to write a formal letter of request following the correct format'),
  ('Writing', 'Formal Letters', 'The learner should be able to use appropriate register and tone in formal correspondence'),
  ('Grammar in Use', 'Tenses and Concord', 'The learner should be able to use the correct tense forms consistently in writing and speech'),
  ('Grammar in Use', 'Tenses and Concord', 'The learner should be able to apply subject-verb agreement correctly in sentences'),
  ('Grammar in Use', 'Direct and Reported Speech', 'The learner should be able to convert direct speech to reported speech accurately'),
  ('Grammar in Use', 'Direct and Reported Speech', 'The learner should be able to punctuate direct speech correctly in written work'),
  ('Literature in English', 'The Short Story', 'The learner should be able to identify the theme and message of a given short story'),
  ('Literature in English', 'The Short Story', 'The learner should be able to describe the setting and its effect on the story'),
  ('Literature in English', 'Poetry Appreciation', 'The learner should be able to identify the mood and tone of a given poem'),
  ('Literature in English', 'Poetry Appreciation', 'The learner should be able to explain the use of figurative language in a poem')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'English')
  and st.grade_id = (select id from grades where name = 'Form 2')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Kiswahili / Form 2 ----

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
join grades g on g.name = 'Form 2'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Kusikiliza na Kuzungumza', 'Mahojiano'),
  ('Kusikiliza na Kuzungumza', 'Midahalo'),
  ('Kusoma', 'Ufahamu wa Kina'),
  ('Kusoma', 'Uchambuzi wa Riwaya'),
  ('Kuandika', 'Insha za Kubuni'),
  ('Kuandika', 'Barua Rasmi'),
  ('Sarufi na Matumizi ya Lugha', 'Nyakati na Hali'),
  ('Sarufi na Matumizi ya Lugha', 'Msemo wa Taarifa'),
  ('Fasihi', 'Hadithi Fupi'),
  ('Fasihi', 'Ushairi wa Kimapokeo')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Kiswahili')
  and st.grade_id = (select id from grades where name = 'Form 2')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Kusikiliza na Kuzungumza', 'Mahojiano', 'The learner should be able to fanya mahojiano sahili kwa kutumia maswali yaliyopangwa vyema'),
  ('Kusikiliza na Kuzungumza', 'Mahojiano', 'The learner should be able to jibu maswali ya mahojiano kwa ujasiri'),
  ('Kusikiliza na Kuzungumza', 'Midahalo', 'The learner should be able to shiriki kikamilifu katika mdahalo akitetea msimamo wake'),
  ('Kusikiliza na Kuzungumza', 'Midahalo', 'The learner should be able to sikiliza kwa makini na kutoa mrejesho unaofaa'),
  ('Kusoma', 'Ufahamu wa Kina', 'The learner should be able to elewa maana ya maneno magumu kwa kutumia muktadha'),
  ('Kusoma', 'Ufahamu wa Kina', 'The learner should be able to tofautisha kati ya ukweli na maoni katika kifungu'),
  ('Kusoma', 'Uchambuzi wa Riwaya', 'The learner should be able to changanua wahusika na maudhui katika riwaya'),
  ('Kusoma', 'Uchambuzi wa Riwaya', 'The learner should be able to husisha matukio ya riwaya na maisha halisi'),
  ('Kuandika', 'Insha za Kubuni', 'The learner should be able to andika hadithi ya kubuni yenye muundo dhahiri'),
  ('Kuandika', 'Insha za Kubuni', 'The learner should be able to tumia lugha ya kuvutia kuelezea mandhari na visa'),
  ('Kuandika', 'Barua Rasmi', 'The learner should be able to andika barua rasmi ya kuomba huduma kwa muundo sahihi'),
  ('Kuandika', 'Barua Rasmi', 'The learner should be able to tumia mtindo unaofaa katika barua rasmi'),
  ('Sarufi na Matumizi ya Lugha', 'Nyakati na Hali', 'The learner should be able to tumia nyakati mbalimbali kwa usahihi katika uandishi'),
  ('Sarufi na Matumizi ya Lugha', 'Nyakati na Hali', 'The learner should be able to onyesha upatanisho wa kisarufi kati ya kiima na kiarifu'),
  ('Sarufi na Matumizi ya Lugha', 'Msemo wa Taarifa', 'The learner should be able to geuza msemo wa moja kwa moja kuwa msemo wa taarifa'),
  ('Sarufi na Matumizi ya Lugha', 'Msemo wa Taarifa', 'The learner should be able to tumia alama za uakifishaji katika msemo wa moja kwa moja'),
  ('Fasihi', 'Hadithi Fupi', 'The learner should be able to tambua maudhui na ujumbe wa hadithi fupi'),
  ('Fasihi', 'Hadithi Fupi', 'The learner should be able to eleza mandhari na athari yake katika hadithi'),
  ('Fasihi', 'Ushairi wa Kimapokeo', 'The learner should be able to tambua sifa za ushairi wa kimapokeo'),
  ('Fasihi', 'Ushairi wa Kimapokeo', 'The learner should be able to eleza matumizi ya tamathali za semi katika shairi')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Kiswahili')
  and st.grade_id = (select id from grades where name = 'Form 2')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Mathematics / Form 2 ----

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
join grades g on g.name = 'Form 2'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Numbers', 'Indices and Logarithms'),
  ('Numbers', 'Cubes, Cube Roots and Reciprocals'),
  ('Algebra', 'Quadratic Expressions and Equations'),
  ('Algebra', 'Formulae and Variation'),
  ('Measurement', 'Trigonometric Ratios and Area of a Triangle'),
  ('Measurement', 'Commercial Arithmetic'),
  ('Geometry', 'Similarity, Congruence and Enlargement'),
  ('Geometry', 'Coordinate Geometry and Straight-line Graphs'),
  ('Data Handling and Probability', 'Statistics: Grouped Data and Dispersion'),
  ('Data Handling and Probability', 'Vectors in Two Dimensions')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Mathematics')
  and st.grade_id = (select id from grades where name = 'Form 2')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Numbers', 'Indices and Logarithms', 'The learner should be able to apply the laws of indices to simplify numerical and algebraic expressions'),
  ('Numbers', 'Indices and Logarithms', 'The learner should be able to use logarithm tables to perform multiplication and division'),
  ('Numbers', 'Cubes, Cube Roots and Reciprocals', 'The learner should be able to work out cubes and cube roots of numbers by factorisation and using tables'),
  ('Numbers', 'Cubes, Cube Roots and Reciprocals', 'The learner should be able to determine reciprocals of numbers using mathematical tables'),
  ('Algebra', 'Quadratic Expressions and Equations', 'The learner should be able to factorise quadratic expressions using different methods'),
  ('Algebra', 'Quadratic Expressions and Equations', 'The learner should be able to solve quadratic equations by factorisation'),
  ('Algebra', 'Formulae and Variation', 'The learner should be able to derive and change the subject of a given formula'),
  ('Algebra', 'Formulae and Variation', 'The learner should be able to solve problems involving direct, inverse, joint and partial variation'),
  ('Measurement', 'Trigonometric Ratios and Area of a Triangle', 'The learner should be able to define sine, cosine and tangent of an angle in a right-angled triangle'),
  ('Measurement', 'Trigonometric Ratios and Area of a Triangle', 'The learner should be able to calculate the area of a triangle using trigonometric ratios'),
  ('Measurement', 'Commercial Arithmetic', 'The learner should be able to calculate simple and compound interest on a given principal'),
  ('Measurement', 'Commercial Arithmetic', 'The learner should be able to solve problems involving profit, loss, discount and commission'),
  ('Geometry', 'Similarity, Congruence and Enlargement', 'The learner should be able to identify similar and congruent figures and state their properties'),
  ('Geometry', 'Similarity, Congruence and Enlargement', 'The learner should be able to construct an enlargement of a given figure using a stated scale factor'),
  ('Geometry', 'Coordinate Geometry and Straight-line Graphs', 'The learner should be able to plot points and draw straight-line graphs on the Cartesian plane'),
  ('Geometry', 'Coordinate Geometry and Straight-line Graphs', 'The learner should be able to determine the gradient and equation of a straight line'),
  ('Data Handling and Probability', 'Statistics: Grouped Data and Dispersion', 'The learner should be able to calculate the mean and median of grouped data'),
  ('Data Handling and Probability', 'Statistics: Grouped Data and Dispersion', 'The learner should be able to determine measures of dispersion such as range and quartiles'),
  ('Data Handling and Probability', 'Vectors in Two Dimensions', 'The learner should be able to represent a vector in column and coordinate form'),
  ('Data Handling and Probability', 'Vectors in Two Dimensions', 'The learner should be able to add and subtract vectors in two dimensions')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Mathematics')
  and st.grade_id = (select id from grades where name = 'Form 2')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Chemistry / Form 2 ----

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
join grades g on g.name = 'Form 2'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Introduction to Chemistry and Matter', 'Chemical Families: The Periodic Table'),
  ('Introduction to Chemistry and Matter', 'Structure and Bonding: An Overview'),
  ('Structure of Matter and Bonding', 'Ionic and Covalent Bonding'),
  ('Structure of Matter and Bonding', 'Gas Laws: An Introduction'),
  ('Acids, Bases and Salts', 'Acids, Bases and Salts in Depth'),
  ('Acids, Bases and Salts', 'Effects of Electric Current on Substances'),
  ('Chemical Reactions and Energetics', 'Water Hardness'),
  ('Chemical Reactions and Energetics', 'Energy Changes in Chemical Reactions: An Introduction'),
  ('Chemistry of Elements and Compounds', 'Salts and Salt Preparation'),
  ('Chemistry of Elements and Compounds', 'Safety in Use of Chemicals')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Chemistry')
  and st.grade_id = (select id from grades where name = 'Form 2')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Introduction to Chemistry and Matter', 'Chemical Families: The Periodic Table', 'The learner should be able to describe the arrangement of elements in the periodic table'),
  ('Introduction to Chemistry and Matter', 'Chemical Families: The Periodic Table', 'The learner should be able to relate the position of an element to its properties'),
  ('Introduction to Chemistry and Matter', 'Structure and Bonding: An Overview', 'The learner should be able to explain how atoms combine to form compounds'),
  ('Introduction to Chemistry and Matter', 'Structure and Bonding: An Overview', 'The learner should be able to relate bonding type to the properties of a substance'),
  ('Structure of Matter and Bonding', 'Ionic and Covalent Bonding', 'The learner should be able to describe the formation of ionic bonds using dot-and-cross diagrams'),
  ('Structure of Matter and Bonding', 'Ionic and Covalent Bonding', 'The learner should be able to describe the formation of covalent bonds in simple molecules'),
  ('Structure of Matter and Bonding', 'Gas Laws: An Introduction', 'The learner should be able to state the relationship between pressure, volume and temperature of a gas'),
  ('Structure of Matter and Bonding', 'Gas Laws: An Introduction', 'The learner should be able to apply the general gas equation to solve simple problems'),
  ('Acids, Bases and Salts', 'Acids, Bases and Salts in Depth', 'The learner should be able to describe the reaction of acids with metals, bases and carbonates'),
  ('Acids, Bases and Salts', 'Acids, Bases and Salts in Depth', 'The learner should be able to classify salts as normal, acidic or basic salts'),
  ('Acids, Bases and Salts', 'Effects of Electric Current on Substances', 'The learner should be able to describe simple electrolysis of molten and aqueous compounds'),
  ('Acids, Bases and Salts', 'Effects of Electric Current on Substances', 'The learner should be able to state everyday applications of electrolysis'),
  ('Chemical Reactions and Energetics', 'Water Hardness', 'The learner should be able to distinguish between temporary and permanent hardness of water'),
  ('Chemical Reactions and Energetics', 'Water Hardness', 'The learner should be able to describe methods of removing hardness from water'),
  ('Chemical Reactions and Energetics', 'Energy Changes in Chemical Reactions: An Introduction', 'The learner should be able to distinguish between exothermic and endothermic reactions'),
  ('Chemical Reactions and Energetics', 'Energy Changes in Chemical Reactions: An Introduction', 'The learner should be able to draw simple energy level diagrams for chemical reactions'),
  ('Chemistry of Elements and Compounds', 'Salts and Salt Preparation', 'The learner should be able to describe laboratory methods of preparing soluble and insoluble salts'),
  ('Chemistry of Elements and Compounds', 'Salts and Salt Preparation', 'The learner should be able to state everyday uses of common salts'),
  ('Chemistry of Elements and Compounds', 'Safety in Use of Chemicals', 'The learner should be able to interpret common hazard warning symbols on chemical containers'),
  ('Chemistry of Elements and Compounds', 'Safety in Use of Chemicals', 'The learner should be able to describe safe storage and handling practices for chemicals')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Chemistry')
  and st.grade_id = (select id from grades where name = 'Form 2')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Biology / Form 2 ----

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
join grades g on g.name = 'Form 2'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Cell Biology and Classification', 'Gaseous Exchange'),
  ('Cell Biology and Classification', 'Respiration'),
  ('Nutrition and Transport', 'Transport in Plants and Animals'),
  ('Nutrition and Transport', 'Nutrition: The Digestive System'),
  ('Reproduction and Growth', 'Reproduction in Flowering Plants'),
  ('Reproduction and Growth', 'Growth and Development: An Introduction'),
  ('Genetics and Evolution', 'Kingdom Plantae'),
  ('Genetics and Evolution', 'Kingdom Animalia: Invertebrates'),
  ('Ecology and Environment', 'Ecology II: Energy Flow'),
  ('Ecology and Environment', 'Water and its Sources')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Biology')
  and st.grade_id = (select id from grades where name = 'Form 2')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Cell Biology and Classification', 'Gaseous Exchange', 'The learner should be able to describe gaseous exchange surfaces in plants and animals'),
  ('Cell Biology and Classification', 'Gaseous Exchange', 'The learner should be able to relate the structure of gaseous exchange organs to their function'),
  ('Cell Biology and Classification', 'Respiration', 'The learner should be able to distinguish between aerobic and anaerobic respiration'),
  ('Cell Biology and Classification', 'Respiration', 'The learner should be able to write word equations for aerobic and anaerobic respiration'),
  ('Nutrition and Transport', 'Transport in Plants and Animals', 'The learner should be able to describe the transport system in flowering plants'),
  ('Nutrition and Transport', 'Transport in Plants and Animals', 'The learner should be able to describe the structure and function of blood vessels in animals'),
  ('Nutrition and Transport', 'Nutrition: The Digestive System', 'The learner should be able to describe the structure and function of the human digestive system'),
  ('Nutrition and Transport', 'Nutrition: The Digestive System', 'The learner should be able to explain the process of digestion and absorption of food'),
  ('Reproduction and Growth', 'Reproduction in Flowering Plants', 'The learner should be able to describe the structure of a named flower and its parts'),
  ('Reproduction and Growth', 'Reproduction in Flowering Plants', 'The learner should be able to describe the process of pollination and fertilisation in plants'),
  ('Reproduction and Growth', 'Growth and Development: An Introduction', 'The learner should be able to describe the conditions necessary for seed germination'),
  ('Reproduction and Growth', 'Growth and Development: An Introduction', 'The learner should be able to distinguish between epigeal and hypogeal germination'),
  ('Genetics and Evolution', 'Kingdom Plantae', 'The learner should be able to classify plants into major groups based on their features'),
  ('Genetics and Evolution', 'Kingdom Plantae', 'The learner should be able to describe the economic importance of plants in kingdom Plantae'),
  ('Genetics and Evolution', 'Kingdom Animalia: Invertebrates', 'The learner should be able to classify invertebrates into major phyla based on their features'),
  ('Genetics and Evolution', 'Kingdom Animalia: Invertebrates', 'The learner should be able to describe the economic importance of selected invertebrates'),
  ('Ecology and Environment', 'Ecology II: Energy Flow', 'The learner should be able to describe the flow of energy through an ecosystem'),
  ('Ecology and Environment', 'Ecology II: Energy Flow', 'The learner should be able to construct and interpret a pyramid of numbers and energy'),
  ('Ecology and Environment', 'Water and its Sources', 'The learner should be able to describe the sources and uses of water to living organisms'),
  ('Ecology and Environment', 'Water and its Sources', 'The learner should be able to explain the water cycle and its importance to ecosystems')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Biology')
  and st.grade_id = (select id from grades where name = 'Form 2')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Physics / Form 2 ----

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
join grades g on g.name = 'Form 2'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Measurement and Mechanics', 'Turning Effect of Forces'),
  ('Measurement and Mechanics', 'Equilibrium and Centre of Gravity'),
  ('Heat and Matter', 'Thermal Expansion: Advanced'),
  ('Heat and Matter', 'Heat Transfer'),
  ('Waves, Light and Sound', 'Reflection at Curved Surfaces'),
  ('Waves, Light and Sound', 'Sound Waves'),
  ('Electricity and Magnetism', 'Magnetic Effect of Electric Current'),
  ('Electricity and Magnetism', 'Electrostatics I'),
  ('Modern Physics and Energy', 'Current Electricity: Ohm''s Law'),
  ('Modern Physics and Energy', 'Measurement of Mass, Weight and Density')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Physics')
  and st.grade_id = (select id from grades where name = 'Form 2')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Measurement and Mechanics', 'Turning Effect of Forces', 'The learner should be able to define moment of a force and state the principle of moments'),
  ('Measurement and Mechanics', 'Turning Effect of Forces', 'The learner should be able to apply the principle of moments to solve simple problems'),
  ('Measurement and Mechanics', 'Equilibrium and Centre of Gravity', 'The learner should be able to determine the centre of gravity of a regular object'),
  ('Measurement and Mechanics', 'Equilibrium and Centre of Gravity', 'The learner should be able to relate stability of objects to the position of centre of gravity'),
  ('Heat and Matter', 'Thermal Expansion: Advanced', 'The learner should be able to calculate linear and cubical expansivity of materials'),
  ('Heat and Matter', 'Thermal Expansion: Advanced', 'The learner should be able to explain problems caused by expansion and their solutions'),
  ('Heat and Matter', 'Heat Transfer', 'The learner should be able to distinguish between conduction, convection and radiation'),
  ('Heat and Matter', 'Heat Transfer', 'The learner should be able to explain everyday applications of methods of heat transfer'),
  ('Waves, Light and Sound', 'Reflection at Curved Surfaces', 'The learner should be able to describe image formation by concave and convex mirrors'),
  ('Waves, Light and Sound', 'Reflection at Curved Surfaces', 'The learner should be able to state applications of curved mirrors in everyday devices'),
  ('Waves, Light and Sound', 'Sound Waves', 'The learner should be able to describe how sound is produced and transmitted'),
  ('Waves, Light and Sound', 'Sound Waves', 'The learner should be able to explain factors affecting the speed of sound'),
  ('Electricity and Magnetism', 'Magnetic Effect of Electric Current', 'The learner should be able to demonstrate the magnetic effect of a current-carrying conductor'),
  ('Electricity and Magnetism', 'Magnetic Effect of Electric Current', 'The learner should be able to describe the construction and use of an electromagnet'),
  ('Electricity and Magnetism', 'Electrostatics I', 'The learner should be able to explain the concept of charging by friction, induction and contact'),
  ('Electricity and Magnetism', 'Electrostatics I', 'The learner should be able to describe simple applications of electrostatic charges'),
  ('Modern Physics and Energy', 'Current Electricity: Ohm''s Law', 'The learner should be able to state and verify Ohm''s law experimentally'),
  ('Modern Physics and Energy', 'Current Electricity: Ohm''s Law', 'The learner should be able to solve simple circuit problems using Ohm''s law'),
  ('Modern Physics and Energy', 'Measurement of Mass, Weight and Density', 'The learner should be able to distinguish between mass and weight'),
  ('Modern Physics and Energy', 'Measurement of Mass, Weight and Density', 'The learner should be able to determine the density of regular and irregular solids')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Physics')
  and st.grade_id = (select id from grades where name = 'Form 2')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Christian Religious Education / Form 2 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('The Bible'),
  ('Christian Values'),
  ('Christian Living'),
  ('The Church')
) as v(name)
join subjects s on s.name = 'Christian Religious Education'
join grades g on g.name = 'Form 2'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('The Bible', 'The Patriarchs and Covenant'),
  ('The Bible', 'The Exodus and the Law'),
  ('Christian Values', 'The Prophets and Social Justice'),
  ('Christian Values', 'Wisdom Literature and Right Relationships'),
  ('Christian Living', 'Work and Wealth'),
  ('Christian Living', 'Christian Response to Injustice'),
  ('The Church', 'Leadership in the Church'),
  ('The Church', 'The Sacraments/Ordinances')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Christian Religious Education')
  and st.grade_id = (select id from grades where name = 'Form 2')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('The Bible', 'The Patriarchs and Covenant', 'The learner should be able to narrate the call and covenant of Abraham'),
  ('The Bible', 'The Patriarchs and Covenant', 'The learner should be able to explain the significance of covenant in the relationship between God and His people'),
  ('The Bible', 'The Exodus and the Law', 'The learner should be able to narrate the events of the Exodus and the giving of the Law'),
  ('The Bible', 'The Exodus and the Law', 'The learner should be able to explain the relevance of the Ten Commandments to Christian living today'),
  ('Christian Values', 'The Prophets and Social Justice', 'The learner should be able to describe the role of the prophets in calling for social justice'),
  ('Christian Values', 'The Prophets and Social Justice', 'The learner should be able to relate prophetic teaching on justice to contemporary society'),
  ('Christian Values', 'Wisdom Literature and Right Relationships', 'The learner should be able to outline key teachings found in Wisdom literature'),
  ('Christian Values', 'Wisdom Literature and Right Relationships', 'The learner should be able to apply lessons on right relationships from Wisdom literature to daily life'),
  ('Christian Living', 'Work and Wealth', 'The learner should be able to explain the Christian understanding of work and wealth'),
  ('Christian Living', 'Work and Wealth', 'The learner should be able to demonstrate a responsible Christian attitude towards wealth'),
  ('Christian Living', 'Christian Response to Injustice', 'The learner should be able to identify forms of injustice present in society'),
  ('Christian Living', 'Christian Response to Injustice', 'The learner should be able to explain appropriate Christian responses to injustice'),
  ('The Church', 'Leadership in the Church', 'The learner should be able to describe the qualities of good Christian leadership'),
  ('The Church', 'Leadership in the Church', 'The learner should be able to identify biblical examples of Christian leaders'),
  ('The Church', 'The Sacraments/Ordinances', 'The learner should be able to describe the meaning of key Christian sacraments/ordinances'),
  ('The Church', 'The Sacraments/Ordinances', 'The learner should be able to explain the significance of sacraments/ordinances in Christian life')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Christian Religious Education')
  and st.grade_id = (select id from grades where name = 'Form 2')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);
