-- ============================================================================
-- Checkpoint: AI-generated curriculum structure (strands/sub_strands/
-- learning_outcomes) for Grade 10 core subjects — approximate content
-- for MVP, to be refined against official KICD sources later.
-- NOT YET APPLIED — for review.
-- Re-runnable: every insert is guarded with `where not exists`, so applying
-- this file more than once inserts nothing the second time.
-- ============================================================================

-- ---- English / Grade 10 ----

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
join grades g on g.name = 'Grade 10'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Listening and Speaking', 'Public Speaking and Advocacy'),
  ('Listening and Speaking', 'Panel and Group Discussions'),
  ('Reading', 'Analytical and Critical Reading'),
  ('Reading', 'Extended Text Study'),
  ('Writing', 'Creative and Reflective Writing'),
  ('Writing', 'Report, Proposal and Minutes Writing'),
  ('Grammar in Use', 'Language Structures in Context'),
  ('Grammar in Use', 'Style, Register and Editing Skills'),
  ('Literature in English', 'Contemporary Prose'),
  ('Literature in English', 'Poetry and Performance')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'English')
  and st.grade_id = (select id from grades where name = 'Grade 10')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Listening and Speaking', 'Public Speaking and Advocacy', 'The learner should be able to deliver a well-researched persuasive speech on a social issue'),
  ('Listening and Speaking', 'Public Speaking and Advocacy', 'The learner should be able to advocate for a position using evidence-based arguments'),
  ('Listening and Speaking', 'Panel and Group Discussions', 'The learner should be able to facilitate and contribute meaningfully to a panel discussion'),
  ('Listening and Speaking', 'Panel and Group Discussions', 'The learner should be able to build consensus through active listening and respectful dialogue'),
  ('Reading', 'Analytical and Critical Reading', 'The learner should be able to critically evaluate the credibility and bias of a given text'),
  ('Reading', 'Analytical and Critical Reading', 'The learner should be able to synthesise information from multiple texts on a topic'),
  ('Reading', 'Extended Text Study', 'The learner should be able to analyse the structure and themes of an extended literary or non-fiction text'),
  ('Reading', 'Extended Text Study', 'The learner should be able to relate an extended text''s ideas to real-world contexts'),
  ('Writing', 'Creative and Reflective Writing', 'The learner should be able to write a creative piece that demonstrates originality and voice'),
  ('Writing', 'Creative and Reflective Writing', 'The learner should be able to write a reflective essay evaluating a personal experience'),
  ('Writing', 'Report, Proposal and Minutes Writing', 'The learner should be able to write a structured proposal for a given project or activity'),
  ('Writing', 'Report, Proposal and Minutes Writing', 'The learner should be able to record accurate and concise minutes of a meeting'),
  ('Grammar in Use', 'Language Structures in Context', 'The learner should be able to apply correct grammatical structures across different text types'),
  ('Grammar in Use', 'Language Structures in Context', 'The learner should be able to identify and correct common errors in extended writing'),
  ('Grammar in Use', 'Style, Register and Editing Skills', 'The learner should be able to adapt style and register to suit audience and purpose'),
  ('Grammar in Use', 'Style, Register and Editing Skills', 'The learner should be able to edit and proofread a piece of writing for clarity and coherence'),
  ('Literature in English', 'Contemporary Prose', 'The learner should be able to analyse themes and characterisation in a contemporary prose text'),
  ('Literature in English', 'Contemporary Prose', 'The learner should be able to evaluate how a contemporary text addresses current social issues'),
  ('Literature in English', 'Poetry and Performance', 'The learner should be able to perform a poem with appropriate expression and interpretation'),
  ('Literature in English', 'Poetry and Performance', 'The learner should be able to analyse how performance choices affect a poem''s meaning')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'English')
  and st.grade_id = (select id from grades where name = 'Grade 10')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Kiswahili / Grade 10 ----

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
join grades g on g.name = 'Grade 10'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Kusikiliza na Kuzungumza', 'Mazungumzo Rasmi na Mawasilisho'),
  ('Kusikiliza na Kuzungumza', 'Midahalo na Mijadala'),
  ('Kusoma', 'Usomaji wa Uchambuzi'),
  ('Kusoma', 'Usomaji wa Ziada'),
  ('Kuandika', 'Uandishi Bunifu'),
  ('Kuandika', 'Uandishi wa Ripoti na Mapendekezo'),
  ('Sarufi na Matumizi ya Lugha', 'Muundo wa Lugha katika Muktadha'),
  ('Sarufi na Matumizi ya Lugha', 'Mtindo na Uhariri'),
  ('Fasihi', 'Fasihi Simulizi na Andishi'),
  ('Fasihi', 'Ushairi na Maonyesho')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Kiswahili')
  and st.grade_id = (select id from grades where name = 'Grade 10')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Kusikiliza na Kuzungumza', 'Mazungumzo Rasmi na Mawasilisho', 'The learner should be able to wasilisha hoja rasmi mbele ya hadhira mbalimbali'),
  ('Kusikiliza na Kuzungumza', 'Mazungumzo Rasmi na Mawasilisho', 'The learner should be able to shiriki mazungumzo rasmi kwa kuzingatia adabu za lugha'),
  ('Kusikiliza na Kuzungumza', 'Midahalo na Mijadala', 'The learner should be able to shiriki kikamilifu katika midahalo akitumia hoja za kimantiki'),
  ('Kusikiliza na Kuzungumza', 'Midahalo na Mijadala', 'The learner should be able to ongoza mjadala kwa ufanisi na kwa mpangilio'),
  ('Kusoma', 'Usomaji wa Uchambuzi', 'The learner should be able to changanua vifungu vigumu kwa kina'),
  ('Kusoma', 'Usomaji wa Uchambuzi', 'The learner should be able to tathmini uaminifu na upendeleo katika maandishi'),
  ('Kusoma', 'Usomaji wa Ziada', 'The learner should be able to soma vitabu vya ziada na kutoa muhtasari wenye mashiko'),
  ('Kusoma', 'Usomaji wa Ziada', 'The learner should be able to sitawisha tabia ya kusoma kwa kujitegemea'),
  ('Kuandika', 'Uandishi Bunifu', 'The learner should be able to andika kazi bunifu inayoonyesha ustadi wa lugha'),
  ('Kuandika', 'Uandishi Bunifu', 'The learner should be able to tumia mbinu za kisanaa katika uandishi bunifu'),
  ('Kuandika', 'Uandishi wa Ripoti na Mapendekezo', 'The learner should be able to andika ripoti rasmi kwa kufuata muundo unaokubalika'),
  ('Kuandika', 'Uandishi wa Ripoti na Mapendekezo', 'The learner should be able to andika pendekezo lenye mantiki kuhusu mradi fulani'),
  ('Sarufi na Matumizi ya Lugha', 'Muundo wa Lugha katika Muktadha', 'The learner should be able to tumia muundo sahihi wa lugha katika aina mbalimbali za maandishi'),
  ('Sarufi na Matumizi ya Lugha', 'Muundo wa Lugha katika Muktadha', 'The learner should be able to tambua na kurekebisha makosa ya kisarufi katika maandishi marefu'),
  ('Sarufi na Matumizi ya Lugha', 'Mtindo na Uhariri', 'The learner should be able to hariri kazi yake ili kuboresha mtindo na uwazi'),
  ('Sarufi na Matumizi ya Lugha', 'Mtindo na Uhariri', 'The learner should be able to badilisha mtindo wa uandishi kulingana na hadhira na madhumuni'),
  ('Fasihi', 'Fasihi Simulizi na Andishi', 'The learner should be able to linganisha vipengele vya fasihi simulizi na fasihi andishi'),
  ('Fasihi', 'Fasihi Simulizi na Andishi', 'The learner should be able to tathmini umuhimu wa fasihi katika kuakisi jamii ya sasa'),
  ('Fasihi', 'Ushairi na Maonyesho', 'The learner should be able to ghani au kuigiza kazi ya kifasihi kwa hisia zinazofaa'),
  ('Fasihi', 'Ushairi na Maonyesho', 'The learner should be able to changanua athari za maonyesho katika ufasiri wa kazi ya fasihi')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Kiswahili')
  and st.grade_id = (select id from grades where name = 'Grade 10')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Mathematics / Grade 10 ----

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
join grades g on g.name = 'Grade 10'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Numbers', 'Number Systems and Number Bases'),
  ('Numbers', 'Sets and Number Operations'),
  ('Algebra', 'Algebraic Expressions, Equations and Inequalities'),
  ('Algebra', 'Sequences and Patterns'),
  ('Measurement', 'Length, Area, Volume and Mass in Real-Life Contexts'),
  ('Measurement', 'Time, Distance, Speed and Money'),
  ('Geometry', 'Angles, Polygons and Geometrical Constructions'),
  ('Geometry', 'Coordinate Geometry and Transformations'),
  ('Data Handling and Probability', 'Data Collection, Representation and Interpretation'),
  ('Data Handling and Probability', 'Probability and Chance')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Mathematics')
  and st.grade_id = (select id from grades where name = 'Grade 10')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Numbers', 'Number Systems and Number Bases', 'The learner should be able to convert numbers between base ten and other number bases'),
  ('Numbers', 'Number Systems and Number Bases', 'The learner should be able to apply number systems to solve real-life computational problems'),
  ('Numbers', 'Sets and Number Operations', 'The learner should be able to represent sets using Venn diagrams and set notation'),
  ('Numbers', 'Sets and Number Operations', 'The learner should be able to perform operations on sets and apply them to solve problems'),
  ('Algebra', 'Algebraic Expressions, Equations and Inequalities', 'The learner should be able to simplify and factorise algebraic expressions arising from real-life contexts'),
  ('Algebra', 'Algebraic Expressions, Equations and Inequalities', 'The learner should be able to form and solve linear and simple quadratic equations and inequalities'),
  ('Algebra', 'Sequences and Patterns', 'The learner should be able to identify the rule governing a given number pattern'),
  ('Algebra', 'Sequences and Patterns', 'The learner should be able to generate and extend arithmetic and geometric sequences'),
  ('Measurement', 'Length, Area, Volume and Mass in Real-Life Contexts', 'The learner should be able to apply length, area and volume calculations to solve real-life problems'),
  ('Measurement', 'Length, Area, Volume and Mass in Real-Life Contexts', 'The learner should be able to convert and apply units of mass in practical situations'),
  ('Measurement', 'Time, Distance, Speed and Money', 'The learner should be able to solve problems involving time, distance and speed'),
  ('Measurement', 'Time, Distance, Speed and Money', 'The learner should be able to apply mathematics to personal and household financial decisions'),
  ('Geometry', 'Angles, Polygons and Geometrical Constructions', 'The learner should be able to calculate interior and exterior angles of regular polygons'),
  ('Geometry', 'Angles, Polygons and Geometrical Constructions', 'The learner should be able to construct polygons and angle bisectors using a ruler and a pair of compasses'),
  ('Geometry', 'Coordinate Geometry and Transformations', 'The learner should be able to plot and interpret points and shapes on the Cartesian plane'),
  ('Geometry', 'Coordinate Geometry and Transformations', 'The learner should be able to perform simple transformations such as translation, reflection and rotation'),
  ('Data Handling and Probability', 'Data Collection, Representation and Interpretation', 'The learner should be able to collect, organise and represent data using appropriate statistical graphs'),
  ('Data Handling and Probability', 'Data Collection, Representation and Interpretation', 'The learner should be able to interpret statistical data presented in tables and charts'),
  ('Data Handling and Probability', 'Probability and Chance', 'The learner should be able to determine the probability of simple events using experiments and theory'),
  ('Data Handling and Probability', 'Probability and Chance', 'The learner should be able to apply probability concepts to make informed everyday decisions')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Mathematics')
  and st.grade_id = (select id from grades where name = 'Grade 10')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Chemistry / Grade 10 ----

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
join grades g on g.name = 'Grade 10'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Introduction to Chemistry and Matter', 'Introduction to Chemistry and Laboratory Safety'),
  ('Introduction to Chemistry and Matter', 'Classification of Matter'),
  ('Structure of Matter and Bonding', 'Atomic Structure and the Periodic Table'),
  ('Structure of Matter and Bonding', 'Chemical Bonding'),
  ('Acids, Bases and Salts', 'Acids, Bases and Indicators'),
  ('Acids, Bases and Salts', 'Salts and Their Preparation'),
  ('Chemical Reactions and Energetics', 'Chemical Reactions and Equations'),
  ('Chemical Reactions and Energetics', 'Energy Changes in Reactions'),
  ('Chemistry of Elements and Compounds', 'Air and Combustion'),
  ('Chemistry of Elements and Compounds', 'Water and Its Treatment')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Chemistry')
  and st.grade_id = (select id from grades where name = 'Grade 10')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Introduction to Chemistry and Matter', 'Introduction to Chemistry and Laboratory Safety', 'The learner should be able to identify laboratory apparatus and observe safety rules in practical work'),
  ('Introduction to Chemistry and Matter', 'Introduction to Chemistry and Laboratory Safety', 'The learner should be able to describe the branches and relevance of chemistry in everyday life'),
  ('Introduction to Chemistry and Matter', 'Classification of Matter', 'The learner should be able to classify substances as elements, compounds or mixtures'),
  ('Introduction to Chemistry and Matter', 'Classification of Matter', 'The learner should be able to apply appropriate techniques to separate mixtures'),
  ('Structure of Matter and Bonding', 'Atomic Structure and the Periodic Table', 'The learner should be able to describe the structure of the atom and its sub-atomic particles'),
  ('Structure of Matter and Bonding', 'Atomic Structure and the Periodic Table', 'The learner should be able to relate the position of an element in the periodic table to its properties'),
  ('Structure of Matter and Bonding', 'Chemical Bonding', 'The learner should be able to describe the formation of ionic and covalent bonds'),
  ('Structure of Matter and Bonding', 'Chemical Bonding', 'The learner should be able to relate bonding to the physical properties of substances'),
  ('Acids, Bases and Salts', 'Acids, Bases and Indicators', 'The learner should be able to classify substances as acidic, basic or neutral using indicators'),
  ('Acids, Bases and Salts', 'Acids, Bases and Indicators', 'The learner should be able to describe everyday applications of acids and bases'),
  ('Acids, Bases and Salts', 'Salts and Their Preparation', 'The learner should be able to describe laboratory methods for preparing soluble and insoluble salts'),
  ('Acids, Bases and Salts', 'Salts and Their Preparation', 'The learner should be able to state the everyday uses of common salts'),
  ('Chemical Reactions and Energetics', 'Chemical Reactions and Equations', 'The learner should be able to write and balance simple chemical equations'),
  ('Chemical Reactions and Energetics', 'Chemical Reactions and Equations', 'The learner should be able to classify chemical reactions into different types'),
  ('Chemical Reactions and Energetics', 'Energy Changes in Reactions', 'The learner should be able to distinguish between exothermic and endothermic reactions'),
  ('Chemical Reactions and Energetics', 'Energy Changes in Reactions', 'The learner should be able to relate energy changes to bond breaking and formation'),
  ('Chemistry of Elements and Compounds', 'Air and Combustion', 'The learner should be able to describe the composition and uses of the components of air'),
  ('Chemistry of Elements and Compounds', 'Air and Combustion', 'The learner should be able to explain the process and conditions necessary for combustion'),
  ('Chemistry of Elements and Compounds', 'Water and Its Treatment', 'The learner should be able to describe the properties and importance of water'),
  ('Chemistry of Elements and Compounds', 'Water and Its Treatment', 'The learner should be able to describe methods used to treat water for domestic use')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Chemistry')
  and st.grade_id = (select id from grades where name = 'Grade 10')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Biology / Grade 10 ----

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
join grades g on g.name = 'Grade 10'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Cell Biology and Classification', 'Cell Structure, Organisation and Classification'),
  ('Cell Biology and Classification', 'Cell Physiology and Transport'),
  ('Nutrition and Transport', 'Nutrition in Plants and Animals'),
  ('Nutrition and Transport', 'Transport Systems in Living Things'),
  ('Reproduction and Growth', 'Reproduction, Growth and Development'),
  ('Reproduction and Growth', 'Support and Movement'),
  ('Genetics and Evolution', 'Genetics and Variation'),
  ('Genetics and Evolution', 'Introduction to Evolution'),
  ('Ecology and Environment', 'Ecosystems and Energy Flow'),
  ('Ecology and Environment', 'Conservation and Environmental Management')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Biology')
  and st.grade_id = (select id from grades where name = 'Grade 10')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Cell Biology and Classification', 'Cell Structure, Organisation and Classification', 'The learner should be able to describe the structure and function of plant and animal cells'),
  ('Cell Biology and Classification', 'Cell Structure, Organisation and Classification', 'The learner should be able to classify organisms into major kingdoms based on shared characteristics'),
  ('Cell Biology and Classification', 'Cell Physiology and Transport', 'The learner should be able to explain the processes of diffusion, osmosis and active transport'),
  ('Cell Biology and Classification', 'Cell Physiology and Transport', 'The learner should be able to relate cell transport mechanisms to real-life biological processes'),
  ('Nutrition and Transport', 'Nutrition in Plants and Animals', 'The learner should be able to describe the process of photosynthesis and its significance'),
  ('Nutrition and Transport', 'Nutrition in Plants and Animals', 'The learner should be able to describe the process of digestion in the human body'),
  ('Nutrition and Transport', 'Transport Systems in Living Things', 'The learner should be able to describe transport systems in flowering plants and mammals'),
  ('Nutrition and Transport', 'Transport Systems in Living Things', 'The learner should be able to relate the structure of transport organs to their function'),
  ('Reproduction and Growth', 'Reproduction, Growth and Development', 'The learner should be able to describe modes of reproduction in plants and animals'),
  ('Reproduction and Growth', 'Reproduction, Growth and Development', 'The learner should be able to explain patterns of growth and development in living organisms'),
  ('Reproduction and Growth', 'Support and Movement', 'The learner should be able to describe mechanisms of support and movement in plants and animals'),
  ('Reproduction and Growth', 'Support and Movement', 'The learner should be able to relate the structure of skeletal systems to locomotion'),
  ('Genetics and Evolution', 'Genetics and Variation', 'The learner should be able to explain the basic principles of inheritance of traits'),
  ('Genetics and Evolution', 'Genetics and Variation', 'The learner should be able to distinguish between continuous and discontinuous variation'),
  ('Genetics and Evolution', 'Introduction to Evolution', 'The learner should be able to describe evidence used to support the theory of evolution'),
  ('Genetics and Evolution', 'Introduction to Evolution', 'The learner should be able to explain the process of natural selection'),
  ('Ecology and Environment', 'Ecosystems and Energy Flow', 'The learner should be able to describe the flow of energy and cycling of nutrients in an ecosystem'),
  ('Ecology and Environment', 'Ecosystems and Energy Flow', 'The learner should be able to construct and interpret food chains, food webs and ecological pyramids'),
  ('Ecology and Environment', 'Conservation and Environmental Management', 'The learner should be able to identify human activities that threaten biodiversity'),
  ('Ecology and Environment', 'Conservation and Environmental Management', 'The learner should be able to propose sustainable strategies for environmental conservation')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Biology')
  and st.grade_id = (select id from grades where name = 'Grade 10')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Physics / Grade 10 ----

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
join grades g on g.name = 'Grade 10'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Measurement and Mechanics', 'Physical Quantities and Measurement'),
  ('Measurement and Mechanics', 'Forces and Motion'),
  ('Heat and Matter', 'Thermal Properties of Matter'),
  ('Heat and Matter', 'Pressure and Fluids'),
  ('Waves, Light and Sound', 'Light and Optics'),
  ('Waves, Light and Sound', 'Sound and Wave Motion'),
  ('Electricity and Magnetism', 'Current Electricity and Circuits'),
  ('Electricity and Magnetism', 'Magnetism and Electromagnetism'),
  ('Modern Physics and Energy', 'Energy, Work and Power'),
  ('Modern Physics and Energy', 'Introduction to Modern Physics')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Physics')
  and st.grade_id = (select id from grades where name = 'Grade 10')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Measurement and Mechanics', 'Physical Quantities and Measurement', 'The learner should be able to distinguish between fundamental and derived physical quantities'),
  ('Measurement and Mechanics', 'Physical Quantities and Measurement', 'The learner should be able to measure length, mass, time and volume using appropriate instruments'),
  ('Measurement and Mechanics', 'Forces and Motion', 'The learner should be able to describe types of forces and their effects on objects'),
  ('Measurement and Mechanics', 'Forces and Motion', 'The learner should be able to apply Newton''s laws of motion to explain everyday phenomena'),
  ('Heat and Matter', 'Thermal Properties of Matter', 'The learner should be able to explain the kinetic theory of matter in relation to heat'),
  ('Heat and Matter', 'Thermal Properties of Matter', 'The learner should be able to describe thermal expansion and its everyday applications'),
  ('Heat and Matter', 'Pressure and Fluids', 'The learner should be able to explain the concept of pressure in solids, liquids and gases'),
  ('Heat and Matter', 'Pressure and Fluids', 'The learner should be able to apply Archimedes'' principle and the law of floatation'),
  ('Waves, Light and Sound', 'Light and Optics', 'The learner should be able to describe reflection and refraction of light and their applications'),
  ('Waves, Light and Sound', 'Light and Optics', 'The learner should be able to explain image formation by mirrors and lenses'),
  ('Waves, Light and Sound', 'Sound and Wave Motion', 'The learner should be able to describe the properties and production of sound waves'),
  ('Waves, Light and Sound', 'Sound and Wave Motion', 'The learner should be able to distinguish between transverse and longitudinal waves'),
  ('Electricity and Magnetism', 'Current Electricity and Circuits', 'The learner should be able to apply Ohm''s law to solve simple circuit problems'),
  ('Electricity and Magnetism', 'Current Electricity and Circuits', 'The learner should be able to construct and analyse series and parallel circuits'),
  ('Electricity and Magnetism', 'Magnetism and Electromagnetism', 'The learner should be able to describe the properties of magnets and magnetic fields'),
  ('Electricity and Magnetism', 'Magnetism and Electromagnetism', 'The learner should be able to explain the magnetic effect of an electric current'),
  ('Modern Physics and Energy', 'Energy, Work and Power', 'The learner should be able to calculate work done, energy and power in real-life situations'),
  ('Modern Physics and Energy', 'Energy, Work and Power', 'The learner should be able to apply the law of conservation of energy to solve problems'),
  ('Modern Physics and Energy', 'Introduction to Modern Physics', 'The learner should be able to describe the basic structure of the atom'),
  ('Modern Physics and Energy', 'Introduction to Modern Physics', 'The learner should be able to explain the concept and applications of radioactivity')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Physics')
  and st.grade_id = (select id from grades where name = 'Grade 10')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Christian Religious Education / Grade 10 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('The Bible'),
  ('Christian Values'),
  ('Christian Living'),
  ('The Church')
) as v(name)
join subjects s on s.name = 'Christian Religious Education'
join grades g on g.name = 'Grade 10'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('The Bible', 'Composition and Interpretation of the Bible'),
  ('The Bible', 'The Life and Teachings of Jesus Christ'),
  ('Christian Values', 'Christian Values and Contemporary Society'),
  ('Christian Values', 'Marriage, Family and Relationships'),
  ('Christian Living', 'Prayer, Worship and Personal Discipline'),
  ('Christian Living', 'Christian Response to Social Issues'),
  ('The Church', 'The Growth and Mission of the Church'),
  ('The Church', 'Christian Leadership and Service')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Christian Religious Education')
  and st.grade_id = (select id from grades where name = 'Grade 10')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('The Bible', 'Composition and Interpretation of the Bible', 'The learner should be able to describe how the Bible was compiled and translated over time'),
  ('The Bible', 'Composition and Interpretation of the Bible', 'The learner should be able to apply basic principles of biblical interpretation to a given text'),
  ('The Bible', 'The Life and Teachings of Jesus Christ', 'The learner should be able to narrate key events and teachings in the life of Jesus Christ'),
  ('The Bible', 'The Life and Teachings of Jesus Christ', 'The learner should be able to relate the teachings of Jesus to present-day Christian living'),
  ('Christian Values', 'Christian Values and Contemporary Society', 'The learner should be able to identify core Christian values relevant to contemporary society'),
  ('Christian Values', 'Christian Values and Contemporary Society', 'The learner should be able to apply Christian values to address current ethical challenges'),
  ('Christian Values', 'Marriage, Family and Relationships', 'The learner should be able to explain the Christian teaching on marriage, family and relationships'),
  ('Christian Values', 'Marriage, Family and Relationships', 'The learner should be able to describe the responsibilities of members within a Christian family'),
  ('Christian Living', 'Prayer, Worship and Personal Discipline', 'The learner should be able to explain the role of prayer and worship in Christian life'),
  ('Christian Living', 'Prayer, Worship and Personal Discipline', 'The learner should be able to demonstrate personal discipline informed by Christian teaching'),
  ('Christian Living', 'Christian Response to Social Issues', 'The learner should be able to identify contemporary social issues affecting young people'),
  ('Christian Living', 'Christian Response to Social Issues', 'The learner should be able to explain appropriate Christian responses to these social issues'),
  ('The Church', 'The Growth and Mission of the Church', 'The learner should be able to trace the growth of the Church from its origin to the present'),
  ('The Church', 'The Growth and Mission of the Church', 'The learner should be able to explain the mission of the Church in society today'),
  ('The Church', 'Christian Leadership and Service', 'The learner should be able to describe qualities of effective Christian leadership and service'),
  ('The Church', 'Christian Leadership and Service', 'The learner should be able to identify opportunities for Christian service within the community')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Christian Religious Education')
  and st.grade_id = (select id from grades where name = 'Grade 10')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);
