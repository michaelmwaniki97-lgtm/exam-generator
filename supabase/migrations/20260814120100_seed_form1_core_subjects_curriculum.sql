-- ============================================================================
-- Checkpoint: AI-generated curriculum structure (strands/sub_strands/
-- learning_outcomes) for Form 1 core subjects — approximate content
-- for MVP, to be refined against official KICD sources later.
-- NOT YET APPLIED — for review.
-- Re-runnable: every insert is guarded with `where not exists`, so applying
-- this file more than once inserts nothing the second time.
-- ============================================================================

-- ---- English / Form 1 ----

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
join grades g on g.name = 'Form 1'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Listening and Speaking', 'Pronunciation and Listening Skills'),
  ('Listening and Speaking', 'Introduction to Public Speaking'),
  ('Reading', 'Comprehension Skills'),
  ('Reading', 'Study Skills and Class Reader'),
  ('Writing', 'Guided Composition Writing'),
  ('Writing', 'Functional Writing: Informal Letters'),
  ('Grammar in Use', 'Parts of Speech and Word Classes'),
  ('Grammar in Use', 'Simple and Compound Sentences'),
  ('Literature in English', 'Oral Literature (Oral Narratives)'),
  ('Literature in English', 'Introduction to Literary Genres')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'English')
  and st.grade_id = (select id from grades where name = 'Form 1')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Listening and Speaking', 'Pronunciation and Listening Skills', 'The learner should be able to articulate English sounds and words correctly in spoken contexts'),
  ('Listening and Speaking', 'Pronunciation and Listening Skills', 'The learner should be able to listen to a short passage and respond to questions accurately'),
  ('Listening and Speaking', 'Introduction to Public Speaking', 'The learner should be able to make a short, well-organised speech on a familiar topic'),
  ('Listening and Speaking', 'Introduction to Public Speaking', 'The learner should be able to use appropriate body language and eye contact when speaking'),
  ('Reading', 'Comprehension Skills', 'The learner should be able to read a passage silently and answer comprehension questions accurately'),
  ('Reading', 'Comprehension Skills', 'The learner should be able to identify the main idea and supporting details in a given text'),
  ('Reading', 'Study Skills and Class Reader', 'The learner should be able to use a dictionary and other reference materials effectively'),
  ('Reading', 'Study Skills and Class Reader', 'The learner should be able to read a class reader and summarise its main events'),
  ('Writing', 'Guided Composition Writing', 'The learner should be able to write a guided composition with a clear beginning, middle and end'),
  ('Writing', 'Guided Composition Writing', 'The learner should be able to use appropriate vocabulary and paragraphing in composition writing'),
  ('Writing', 'Functional Writing: Informal Letters', 'The learner should be able to write an informal letter following the correct format'),
  ('Writing', 'Functional Writing: Informal Letters', 'The learner should be able to use an appropriate tone when writing to a friend or relative'),
  ('Grammar in Use', 'Parts of Speech and Word Classes', 'The learner should be able to identify and use the different parts of speech correctly in sentences'),
  ('Grammar in Use', 'Parts of Speech and Word Classes', 'The learner should be able to use nouns, pronouns and adjectives accurately in writing and speech'),
  ('Grammar in Use', 'Simple and Compound Sentences', 'The learner should be able to construct grammatically correct simple sentences'),
  ('Grammar in Use', 'Simple and Compound Sentences', 'The learner should be able to combine simple sentences into compound sentences using conjunctions'),
  ('Literature in English', 'Oral Literature (Oral Narratives)', 'The learner should be able to narrate an oral narrative citing its key features'),
  ('Literature in English', 'Oral Literature (Oral Narratives)', 'The learner should be able to explain the role of oral narratives in preserving culture'),
  ('Literature in English', 'Introduction to Literary Genres', 'The learner should be able to distinguish between prose, poetry and drama as literary genres'),
  ('Literature in English', 'Introduction to Literary Genres', 'The learner should be able to identify the basic features of each literary genre')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'English')
  and st.grade_id = (select id from grades where name = 'Form 1')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Kiswahili / Form 1 ----

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
join grades g on g.name = 'Form 1'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Kusikiliza na Kuzungumza', 'Matamshi na Ufasaha'),
  ('Kusikiliza na Kuzungumza', 'Mazungumzo Rasmi na Yasiyo Rasmi'),
  ('Kusoma', 'Ufahamu wa Kimsingi'),
  ('Kusoma', 'Usomaji wa Riwaya Teule'),
  ('Kuandika', 'Insha za Maelezo'),
  ('Kuandika', 'Uandishi wa Barua Pepe'),
  ('Sarufi na Matumizi ya Lugha', 'Aina za Maneno'),
  ('Sarufi na Matumizi ya Lugha', 'Ngeli za Nomino'),
  ('Fasihi', 'Fasihi Simulizi'),
  ('Fasihi', 'Utangulizi wa Tanzu za Fasihi')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Kiswahili')
  and st.grade_id = (select id from grades where name = 'Form 1')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Kusikiliza na Kuzungumza', 'Matamshi na Ufasaha', 'The learner should be able to tamka sauti na maneno ya Kiswahili kwa ufasaha'),
  ('Kusikiliza na Kuzungumza', 'Matamshi na Ufasaha', 'The learner should be able to zungumza kwa ufasaha akitumia msamiati unaofaa'),
  ('Kusikiliza na Kuzungumza', 'Mazungumzo Rasmi na Yasiyo Rasmi', 'The learner should be able to shiriki mazungumzo rasmi na yasiyo rasmi kwa adabu'),
  ('Kusikiliza na Kuzungumza', 'Mazungumzo Rasmi na Yasiyo Rasmi', 'The learner should be able to tofautisha kati ya mazungumzo rasmi na yasiyo rasmi'),
  ('Kusoma', 'Ufahamu wa Kimsingi', 'The learner should be able to soma kifungu na kujibu maswali ya ufahamu kwa usahihi'),
  ('Kusoma', 'Ufahamu wa Kimsingi', 'The learner should be able to tambua wazo kuu na vipengele vinavyoliunga mkono'),
  ('Kusoma', 'Usomaji wa Riwaya Teule', 'The learner should be able to soma riwaya teule na kufupisha visa vyake'),
  ('Kusoma', 'Usomaji wa Riwaya Teule', 'The learner should be able to tambua wahusika wakuu katika riwaya teule'),
  ('Kuandika', 'Insha za Maelezo', 'The learner should be able to andika insha ya maelezo yenye mpangilio mzuri'),
  ('Kuandika', 'Insha za Maelezo', 'The learner should be able to tumia msamiati unaofaa katika insha ya maelezo'),
  ('Kuandika', 'Uandishi wa Barua Pepe', 'The learner should be able to andika barua pepe rasmi kwa kufuata muundo unaofaa'),
  ('Kuandika', 'Uandishi wa Barua Pepe', 'The learner should be able to tumia lugha inayofaa katika mawasiliano ya kielektroniki'),
  ('Sarufi na Matumizi ya Lugha', 'Aina za Maneno', 'The learner should be able to tambua na kutumia aina mbalimbali za maneno kwa usahihi'),
  ('Sarufi na Matumizi ya Lugha', 'Aina za Maneno', 'The learner should be able to tunga sentensi sahihi kwa kutumia aina za maneno'),
  ('Sarufi na Matumizi ya Lugha', 'Ngeli za Nomino', 'The learner should be able to ainisha nomino katika ngeli mbalimbali'),
  ('Sarufi na Matumizi ya Lugha', 'Ngeli za Nomino', 'The learner should be able to onyesha upatanisho wa kisarufi kulingana na ngeli'),
  ('Fasihi', 'Fasihi Simulizi', 'The learner should be able to simulia hadithi ya kimapokeo akitaja sifa zake'),
  ('Fasihi', 'Fasihi Simulizi', 'The learner should be able to athamini nafasi ya fasihi simulizi katika jamii'),
  ('Fasihi', 'Utangulizi wa Tanzu za Fasihi', 'The learner should be able to tofautisha kati ya tanzu za fasihi: hadithi, ushairi na tamthilia'),
  ('Fasihi', 'Utangulizi wa Tanzu za Fasihi', 'The learner should be able to tambua sifa bainifu za kila tanzu ya fasihi')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Kiswahili')
  and st.grade_id = (select id from grades where name = 'Form 1')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Mathematics / Form 1 ----

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
join grades g on g.name = 'Form 1'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Numbers', 'Numbers in Base Ten and Other Bases'),
  ('Numbers', 'Squares, Square Roots and Approximation'),
  ('Algebra', 'Algebraic Expressions and Simplification'),
  ('Algebra', 'Linear Equations and Inequalities'),
  ('Measurement', 'Length, Area and Volume'),
  ('Measurement', 'Time, Distance and Speed'),
  ('Geometry', 'Angles and Angle Properties'),
  ('Geometry', 'Geometrical Constructions and Scale Drawing'),
  ('Data Handling and Probability', 'Data Collection, Organisation and Representation'),
  ('Data Handling and Probability', 'Measures of Central Tendency')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Mathematics')
  and st.grade_id = (select id from grades where name = 'Form 1')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Numbers', 'Numbers in Base Ten and Other Bases', 'The learner should be able to convert numbers from base ten to other bases and vice versa'),
  ('Numbers', 'Numbers in Base Ten and Other Bases', 'The learner should be able to perform basic operations on numbers expressed in different bases'),
  ('Numbers', 'Squares, Square Roots and Approximation', 'The learner should be able to work out squares and square roots of numbers by factorisation and division'),
  ('Numbers', 'Squares, Square Roots and Approximation', 'The learner should be able to approximate quantities to a required degree of accuracy'),
  ('Algebra', 'Algebraic Expressions and Simplification', 'The learner should be able to form algebraic expressions from word statements and real-life situations'),
  ('Algebra', 'Algebraic Expressions and Simplification', 'The learner should be able to simplify algebraic expressions by collecting like terms and factorising'),
  ('Algebra', 'Linear Equations and Inequalities', 'The learner should be able to form and solve linear equations in one unknown'),
  ('Algebra', 'Linear Equations and Inequalities', 'The learner should be able to form and solve simple linear inequalities and represent solutions on a number line'),
  ('Measurement', 'Length, Area and Volume', 'The learner should be able to convert units of length, area and volume between different systems'),
  ('Measurement', 'Length, Area and Volume', 'The learner should be able to calculate the perimeter, area and volume of simple geometric shapes and solids'),
  ('Measurement', 'Time, Distance and Speed', 'The learner should be able to convert units of time and perform calculations involving time'),
  ('Measurement', 'Time, Distance and Speed', 'The learner should be able to calculate speed, distance and time in real-life travel problems'),
  ('Geometry', 'Angles and Angle Properties', 'The learner should be able to identify and measure different types of angles using a protractor'),
  ('Geometry', 'Angles and Angle Properties', 'The learner should be able to calculate angles formed by intersecting and parallel lines'),
  ('Geometry', 'Geometrical Constructions and Scale Drawing', 'The learner should be able to construct triangles and other polygons using a ruler and a pair of compasses'),
  ('Geometry', 'Geometrical Constructions and Scale Drawing', 'The learner should be able to interpret and draw simple scale diagrams'),
  ('Data Handling and Probability', 'Data Collection, Organisation and Representation', 'The learner should be able to collect and organise data using tally marks and frequency tables'),
  ('Data Handling and Probability', 'Data Collection, Organisation and Representation', 'The learner should be able to represent data using bar graphs, pie charts and pictographs'),
  ('Data Handling and Probability', 'Measures of Central Tendency', 'The learner should be able to calculate the mean, median and mode of ungrouped data'),
  ('Data Handling and Probability', 'Measures of Central Tendency', 'The learner should be able to interpret measures of central tendency in real-life contexts')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Mathematics')
  and st.grade_id = (select id from grades where name = 'Form 1')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Chemistry / Form 1 ----

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
join grades g on g.name = 'Form 1'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Introduction to Chemistry and Matter', 'Introduction to Chemistry and Laboratory Safety'),
  ('Introduction to Chemistry and Matter', 'Classification of Substances'),
  ('Structure of Matter and Bonding', 'Structure of the Atom'),
  ('Structure of Matter and Bonding', 'Simple Classification: Metals and Non-metals'),
  ('Acids, Bases and Salts', 'Acids, Bases and Indicators'),
  ('Acids, Bases and Salts', 'Air and Combustion'),
  ('Chemical Reactions and Energetics', 'Water and Hydrogen'),
  ('Chemical Reactions and Energetics', 'Simple Separation Techniques'),
  ('Chemistry of Elements and Compounds', 'The Study of Gases: Oxygen'),
  ('Chemistry of Elements and Compounds', 'Fire Fighting')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Chemistry')
  and st.grade_id = (select id from grades where name = 'Form 1')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Introduction to Chemistry and Matter', 'Introduction to Chemistry and Laboratory Safety', 'The learner should be able to identify common laboratory apparatus and state their uses'),
  ('Introduction to Chemistry and Matter', 'Introduction to Chemistry and Laboratory Safety', 'The learner should be able to observe basic laboratory safety rules and procedures'),
  ('Introduction to Chemistry and Matter', 'Classification of Substances', 'The learner should be able to classify substances as elements, compounds or mixtures'),
  ('Introduction to Chemistry and Matter', 'Classification of Substances', 'The learner should be able to identify properties used to classify matter'),
  ('Structure of Matter and Bonding', 'Structure of the Atom', 'The learner should be able to describe the basic structure of an atom'),
  ('Structure of Matter and Bonding', 'Structure of the Atom', 'The learner should be able to identify the sub-atomic particles and their relative charges'),
  ('Structure of Matter and Bonding', 'Simple Classification: Metals and Non-metals', 'The learner should be able to distinguish between metals and non-metals using physical properties'),
  ('Structure of Matter and Bonding', 'Simple Classification: Metals and Non-metals', 'The learner should be able to state everyday uses of common metals and non-metals'),
  ('Acids, Bases and Salts', 'Acids, Bases and Indicators', 'The learner should be able to identify common acids and bases found in the environment'),
  ('Acids, Bases and Salts', 'Acids, Bases and Indicators', 'The learner should be able to test substances using litmus paper and other indicators'),
  ('Acids, Bases and Salts', 'Air and Combustion', 'The learner should be able to describe the composition of air'),
  ('Acids, Bases and Salts', 'Air and Combustion', 'The learner should be able to explain the conditions necessary for combustion'),
  ('Chemical Reactions and Energetics', 'Water and Hydrogen', 'The learner should be able to describe the properties and uses of water'),
  ('Chemical Reactions and Energetics', 'Water and Hydrogen', 'The learner should be able to describe a laboratory method of preparing hydrogen gas'),
  ('Chemical Reactions and Energetics', 'Simple Separation Techniques', 'The learner should be able to select an appropriate method to separate a given mixture'),
  ('Chemical Reactions and Energetics', 'Simple Separation Techniques', 'The learner should be able to carry out simple separation techniques such as filtration and evaporation'),
  ('Chemistry of Elements and Compounds', 'The Study of Gases: Oxygen', 'The learner should be able to describe a laboratory method of preparing oxygen gas'),
  ('Chemistry of Elements and Compounds', 'The Study of Gases: Oxygen', 'The learner should be able to state the properties and uses of oxygen'),
  ('Chemistry of Elements and Compounds', 'Fire Fighting', 'The learner should be able to explain the fire triangle and conditions for combustion to occur'),
  ('Chemistry of Elements and Compounds', 'Fire Fighting', 'The learner should be able to describe methods of fighting different classes of fires')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Chemistry')
  and st.grade_id = (select id from grades where name = 'Form 1')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Biology / Form 1 ----

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
join grades g on g.name = 'Form 1'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Cell Biology and Classification', 'Introduction to Biology and Laboratory Skills'),
  ('Cell Biology and Classification', 'Cell Structure and Function'),
  ('Nutrition and Transport', 'Classification of Living Things'),
  ('Nutrition and Transport', 'Nutrition in Plants and Animals: An Introduction'),
  ('Reproduction and Growth', 'Support and Movement in Plants and Animals'),
  ('Reproduction and Growth', 'Cell Physiology: Diffusion and Osmosis'),
  ('Genetics and Evolution', 'Kingdom Monera and Protoctista'),
  ('Genetics and Evolution', 'Kingdom Fungi'),
  ('Ecology and Environment', 'Ecology I: Ecosystem Concepts'),
  ('Ecology and Environment', 'Relationships in an Ecosystem')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Biology')
  and st.grade_id = (select id from grades where name = 'Form 1')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Cell Biology and Classification', 'Introduction to Biology and Laboratory Skills', 'The learner should be able to identify common biology laboratory apparatus and their uses'),
  ('Cell Biology and Classification', 'Introduction to Biology and Laboratory Skills', 'The learner should be able to use a hand lens and light microscope correctly'),
  ('Cell Biology and Classification', 'Cell Structure and Function', 'The learner should be able to identify the structures of a plant and an animal cell'),
  ('Cell Biology and Classification', 'Cell Structure and Function', 'The learner should be able to relate the structure of a cell organelle to its function'),
  ('Nutrition and Transport', 'Classification of Living Things', 'The learner should be able to classify living things into major kingdoms based on observable features'),
  ('Nutrition and Transport', 'Classification of Living Things', 'The learner should be able to explain the importance of classification in biology'),
  ('Nutrition and Transport', 'Nutrition in Plants and Animals: An Introduction', 'The learner should be able to describe the modes of nutrition in living organisms'),
  ('Nutrition and Transport', 'Nutrition in Plants and Animals: An Introduction', 'The learner should be able to outline the process of photosynthesis in green plants'),
  ('Reproduction and Growth', 'Support and Movement in Plants and Animals', 'The learner should be able to describe mechanisms of support in plants and animals'),
  ('Reproduction and Growth', 'Support and Movement in Plants and Animals', 'The learner should be able to relate the structure of support tissues to their function'),
  ('Reproduction and Growth', 'Cell Physiology: Diffusion and Osmosis', 'The learner should be able to describe the process of diffusion in living organisms'),
  ('Reproduction and Growth', 'Cell Physiology: Diffusion and Osmosis', 'The learner should be able to demonstrate the process of osmosis using a simple experiment'),
  ('Genetics and Evolution', 'Kingdom Monera and Protoctista', 'The learner should be able to describe the characteristics of organisms in kingdom Monera'),
  ('Genetics and Evolution', 'Kingdom Monera and Protoctista', 'The learner should be able to describe the characteristics of organisms in kingdom Protoctista'),
  ('Genetics and Evolution', 'Kingdom Fungi', 'The learner should be able to describe the characteristics of organisms in kingdom Fungi'),
  ('Genetics and Evolution', 'Kingdom Fungi', 'The learner should be able to state the economic importance of fungi'),
  ('Ecology and Environment', 'Ecology I: Ecosystem Concepts', 'The learner should be able to describe the components of an ecosystem'),
  ('Ecology and Environment', 'Ecology I: Ecosystem Concepts', 'The learner should be able to explain the interdependence between living and non-living things'),
  ('Ecology and Environment', 'Relationships in an Ecosystem', 'The learner should be able to describe feeding relationships using food chains and food webs'),
  ('Ecology and Environment', 'Relationships in an Ecosystem', 'The learner should be able to explain different types of relationships among organisms')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Biology')
  and st.grade_id = (select id from grades where name = 'Form 1')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Physics / Form 1 ----

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
join grades g on g.name = 'Form 1'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Measurement and Mechanics', 'Introduction to Physics and Measurement'),
  ('Measurement and Mechanics', 'Force and Linear Motion: Basics'),
  ('Heat and Matter', 'Particulate Nature of Matter'),
  ('Heat and Matter', 'Thermal Expansion'),
  ('Waves, Light and Sound', 'Rectilinear Propagation of Light'),
  ('Waves, Light and Sound', 'Reflection at Plane Surfaces'),
  ('Electricity and Magnetism', 'Magnetism: An Introduction'),
  ('Electricity and Magnetism', 'Measurement of Physical Quantities'),
  ('Modern Physics and Energy', 'Pressure in Fluids'),
  ('Modern Physics and Energy', 'Fluid Flow: An Introduction')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Physics')
  and st.grade_id = (select id from grades where name = 'Form 1')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Measurement and Mechanics', 'Introduction to Physics and Measurement', 'The learner should be able to identify branches of physics and their relevance to everyday life'),
  ('Measurement and Mechanics', 'Introduction to Physics and Measurement', 'The learner should be able to measure length, mass and time using appropriate instruments'),
  ('Measurement and Mechanics', 'Force and Linear Motion: Basics', 'The learner should be able to distinguish between distance, displacement, speed and velocity'),
  ('Measurement and Mechanics', 'Force and Linear Motion: Basics', 'The learner should be able to interpret simple distance-time and velocity-time graphs'),
  ('Heat and Matter', 'Particulate Nature of Matter', 'The learner should be able to describe the arrangement of particles in solids, liquids and gases'),
  ('Heat and Matter', 'Particulate Nature of Matter', 'The learner should be able to relate the kinetic theory to the states of matter'),
  ('Heat and Matter', 'Thermal Expansion', 'The learner should be able to demonstrate thermal expansion in solids, liquids and gases'),
  ('Heat and Matter', 'Thermal Expansion', 'The learner should be able to explain everyday applications of thermal expansion'),
  ('Waves, Light and Sound', 'Rectilinear Propagation of Light', 'The learner should be able to demonstrate that light travels in a straight line'),
  ('Waves, Light and Sound', 'Rectilinear Propagation of Light', 'The learner should be able to explain formation of shadows and eclipses using rectilinear propagation'),
  ('Waves, Light and Sound', 'Reflection at Plane Surfaces', 'The learner should be able to state the laws of reflection of light'),
  ('Waves, Light and Sound', 'Reflection at Plane Surfaces', 'The learner should be able to describe the characteristics of an image formed by a plane mirror'),
  ('Electricity and Magnetism', 'Magnetism: An Introduction', 'The learner should be able to describe properties of magnets through simple experiments'),
  ('Electricity and Magnetism', 'Magnetism: An Introduction', 'The learner should be able to distinguish between magnetic and non-magnetic materials'),
  ('Electricity and Magnetism', 'Measurement of Physical Quantities', 'The learner should be able to measure area and volume of regular and irregular objects'),
  ('Electricity and Magnetism', 'Measurement of Physical Quantities', 'The learner should be able to determine density of solids and liquids experimentally'),
  ('Modern Physics and Energy', 'Pressure in Fluids', 'The learner should be able to explain the concept of pressure and its units'),
  ('Modern Physics and Energy', 'Pressure in Fluids', 'The learner should be able to describe factors affecting pressure in liquids and gases'),
  ('Modern Physics and Energy', 'Fluid Flow: An Introduction', 'The learner should be able to distinguish between laminar and turbulent flow'),
  ('Modern Physics and Energy', 'Fluid Flow: An Introduction', 'The learner should be able to state everyday applications of fluid flow principles')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Physics')
  and st.grade_id = (select id from grades where name = 'Form 1')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Christian Religious Education / Form 1 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('The Bible'),
  ('Christian Values'),
  ('Christian Living'),
  ('The Church')
) as v(name)
join subjects s on s.name = 'Christian Religious Education'
join grades g on g.name = 'Form 1'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('The Bible', 'The Bible as a Source of Divine Revelation'),
  ('The Bible', 'Creation and the Fall of Man'),
  ('Christian Values', 'African Religious Heritage'),
  ('Christian Values', 'Traditional African Marriage and Family'),
  ('Christian Living', 'Prayer and Worship'),
  ('Christian Living', 'Personal Discipline and Self-Control'),
  ('The Church', 'The Origin and Growth of the Church'),
  ('The Church', 'Christian Worship Today')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Christian Religious Education')
  and st.grade_id = (select id from grades where name = 'Form 1')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('The Bible', 'The Bible as a Source of Divine Revelation', 'The learner should be able to describe how the Bible was compiled and preserved'),
  ('The Bible', 'The Bible as a Source of Divine Revelation', 'The learner should be able to explain the significance of the Bible to Christians today'),
  ('The Bible', 'Creation and the Fall of Man', 'The learner should be able to narrate the biblical accounts of creation and the fall of man'),
  ('The Bible', 'Creation and the Fall of Man', 'The learner should be able to explain the lessons learnt from the creation and fall narratives'),
  ('Christian Values', 'African Religious Heritage', 'The learner should be able to describe the traditional African understanding of God'),
  ('Christian Values', 'African Religious Heritage', 'The learner should be able to compare African religious heritage with Christian teaching'),
  ('Christian Values', 'Traditional African Marriage and Family', 'The learner should be able to describe traditional African practices regarding marriage and family'),
  ('Christian Values', 'Traditional African Marriage and Family', 'The learner should be able to compare traditional African family values with Christian teaching on family'),
  ('Christian Living', 'Prayer and Worship', 'The learner should be able to explain the significance of prayer in a Christian''s life'),
  ('Christian Living', 'Prayer and Worship', 'The learner should be able to practise different forms of Christian prayer and worship'),
  ('Christian Living', 'Personal Discipline and Self-Control', 'The learner should be able to explain the Christian teaching on self-control and discipline'),
  ('Christian Living', 'Personal Discipline and Self-Control', 'The learner should be able to demonstrate self-discipline in day-to-day school life'),
  ('The Church', 'The Origin and Growth of the Church', 'The learner should be able to describe the events surrounding the birth of the Church at Pentecost'),
  ('The Church', 'The Origin and Growth of the Church', 'The learner should be able to trace the early growth and spread of the Church'),
  ('The Church', 'Christian Worship Today', 'The learner should be able to describe different forms of Christian worship practised today'),
  ('The Church', 'Christian Worship Today', 'The learner should be able to explain the importance of corporate worship to believers')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Christian Religious Education')
  and st.grade_id = (select id from grades where name = 'Form 1')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);
