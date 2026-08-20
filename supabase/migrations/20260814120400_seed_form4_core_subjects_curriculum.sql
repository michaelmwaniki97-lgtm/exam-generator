-- ============================================================================
-- Checkpoint: AI-generated curriculum structure (strands/sub_strands/
-- learning_outcomes) for Form 4 core subjects — approximate content
-- for MVP, to be refined against official KICD sources later.
-- NOT YET APPLIED — for review.
-- Re-runnable: every insert is guarded with `where not exists`, so applying
-- this file more than once inserts nothing the second time.
-- ============================================================================

-- ---- English / Form 4 ----

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
join grades g on g.name = 'Form 4'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Listening and Speaking', 'Persuasive and Impromptu Speaking'),
  ('Listening and Speaking', 'Panel Discussions'),
  ('Reading', 'Advanced Comprehension and Summary'),
  ('Reading', 'Set Text Analysis'),
  ('Writing', 'Article and Speech Writing'),
  ('Writing', 'Summary Writing Skills'),
  ('Grammar in Use', 'Advanced Sentence Structure and Style'),
  ('Grammar in Use', 'Idiomatic Expressions and Register'),
  ('Literature in English', 'Poetry Analysis'),
  ('Literature in English', 'Set Novel and Play Study (Advanced)')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'English')
  and st.grade_id = (select id from grades where name = 'Form 4')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Listening and Speaking', 'Persuasive and Impromptu Speaking', 'The learner should be able to deliver an impromptu speech confidently on a given topic'),
  ('Listening and Speaking', 'Persuasive and Impromptu Speaking', 'The learner should be able to use persuasive techniques effectively when speaking'),
  ('Listening and Speaking', 'Panel Discussions', 'The learner should be able to participate effectively as a panellist in a structured discussion'),
  ('Listening and Speaking', 'Panel Discussions', 'The learner should be able to moderate a panel discussion, managing time and turn-taking'),
  ('Reading', 'Advanced Comprehension and Summary', 'The learner should be able to answer inferential and evaluative comprehension questions accurately'),
  ('Reading', 'Advanced Comprehension and Summary', 'The learner should be able to summarise a lengthy passage while retaining its key ideas'),
  ('Reading', 'Set Text Analysis', 'The learner should be able to critically analyse the set text''s themes, style and characterisation'),
  ('Reading', 'Set Text Analysis', 'The learner should be able to relate the concerns of a set text to contemporary issues'),
  ('Writing', 'Article and Speech Writing', 'The learner should be able to write a newspaper article following journalistic conventions'),
  ('Writing', 'Article and Speech Writing', 'The learner should be able to write and structure a speech for a given audience and purpose'),
  ('Writing', 'Summary Writing Skills', 'The learner should be able to condense a passage into a coherent summary within a word limit'),
  ('Writing', 'Summary Writing Skills', 'The learner should be able to select and paraphrase relevant points when summarising'),
  ('Grammar in Use', 'Advanced Sentence Structure and Style', 'The learner should be able to vary sentence structure to achieve stylistic effect in writing'),
  ('Grammar in Use', 'Advanced Sentence Structure and Style', 'The learner should be able to edit written work for grammatical accuracy and clarity'),
  ('Grammar in Use', 'Idiomatic Expressions and Register', 'The learner should be able to use common English idioms appropriately in context'),
  ('Grammar in Use', 'Idiomatic Expressions and Register', 'The learner should be able to adjust register to suit formal and informal communication'),
  ('Literature in English', 'Poetry Analysis', 'The learner should be able to analyse poetic devices and their effect in a given poem'),
  ('Literature in English', 'Poetry Analysis', 'The learner should be able to compare the style and themes of two different poems'),
  ('Literature in English', 'Set Novel and Play Study (Advanced)', 'The learner should be able to critically evaluate the author''s craft in a set novel or play'),
  ('Literature in English', 'Set Novel and Play Study (Advanced)', 'The learner should be able to construct a well-supported literary argument in an essay')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'English')
  and st.grade_id = (select id from grades where name = 'Form 4')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Kiswahili / Form 4 ----

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
join grades g on g.name = 'Form 4'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Kusikiliza na Kuzungumza', 'Mazungumzo ya Kitaaluma'),
  ('Kusikiliza na Kuzungumza', 'Uwasilishaji Mbele ya Hadhira'),
  ('Kusoma', 'Ufahamu wa Kina wa Makala'),
  ('Kusoma', 'Fasihi Andishi Teule'),
  ('Kuandika', 'Insha za Kisanaa'),
  ('Kuandika', 'Muhtasari'),
  ('Sarufi na Matumizi ya Lugha', 'Sarufi Mtambuka na Mtindo'),
  ('Sarufi na Matumizi ya Lugha', 'Matumizi ya Lugha ya Kitaalamu'),
  ('Fasihi', 'Ushairi wa Kisasa'),
  ('Fasihi', 'Uhakiki wa Kazi za Fasihi')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Kiswahili')
  and st.grade_id = (select id from grades where name = 'Form 4')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Kusikiliza na Kuzungumza', 'Mazungumzo ya Kitaaluma', 'The learner should be able to shiriki mazungumzo ya kitaaluma kwa lugha rasmi'),
  ('Kusikiliza na Kuzungumza', 'Mazungumzo ya Kitaaluma', 'The learner should be able to eleza mawazo yake kwa mpangilio na mantiki'),
  ('Kusikiliza na Kuzungumza', 'Uwasilishaji Mbele ya Hadhira', 'The learner should be able to wasilisha mada mbele ya hadhira kwa ujasiri'),
  ('Kusikiliza na Kuzungumza', 'Uwasilishaji Mbele ya Hadhira', 'The learner should be able to tumia vielelezo kuboresha uwasilishaji wake'),
  ('Kusoma', 'Ufahamu wa Kina wa Makala', 'The learner should be able to changanua hoja kuu za makala magumu'),
  ('Kusoma', 'Ufahamu wa Kina wa Makala', 'The learner should be able to tathmini ubora wa hoja katika makala'),
  ('Kusoma', 'Fasihi Andishi Teule', 'The learner should be able to changanua kazi ya fasihi andishi teule kwa kina'),
  ('Kusoma', 'Fasihi Andishi Teule', 'The learner should be able to linganisha kazi mbili za fasihi andishi'),
  ('Kuandika', 'Insha za Kisanaa', 'The learner should be able to andika insha ya kisanaa yenye ubunifu wa hali ya juu'),
  ('Kuandika', 'Insha za Kisanaa', 'The learner should be able to tumia mtindo wa kipekee katika uandishi wa kisanaa'),
  ('Kuandika', 'Muhtasari', 'The learner should be able to fupisha kifungu kirefu bila kupoteza maana'),
  ('Kuandika', 'Muhtasari', 'The learner should be able to tumia maneno yake mwenyewe katika muhtasari'),
  ('Sarufi na Matumizi ya Lugha', 'Sarufi Mtambuka na Mtindo', 'The learner should be able to tumia sarufi sanifu katika miktadha mbalimbali'),
  ('Sarufi na Matumizi ya Lugha', 'Sarufi Mtambuka na Mtindo', 'The learner should be able to hariri kazi yake kuondoa makosa ya kisarufi'),
  ('Sarufi na Matumizi ya Lugha', 'Matumizi ya Lugha ya Kitaalamu', 'The learner should be able to tumia msamiati wa kitaalamu ipasavyo'),
  ('Sarufi na Matumizi ya Lugha', 'Matumizi ya Lugha ya Kitaalamu', 'The learner should be able to badilisha usajili wa lugha kulingana na muktadha'),
  ('Fasihi', 'Ushairi wa Kisasa', 'The learner should be able to changanua vipengele vya ushairi wa kisasa'),
  ('Fasihi', 'Ushairi wa Kisasa', 'The learner should be able to linganisha ushairi wa kisasa na wa kimapokeo'),
  ('Fasihi', 'Uhakiki wa Kazi za Fasihi', 'The learner should be able to hakiki kazi ya fasihi akizingatia vigezo vya kihakiki'),
  ('Fasihi', 'Uhakiki wa Kazi za Fasihi', 'The learner should be able to toa maoni yenye mashiko kuhusu kazi ya fasihi')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Kiswahili')
  and st.grade_id = (select id from grades where name = 'Form 4')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Mathematics / Form 4 ----

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
join grades g on g.name = 'Form 4'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Numbers', 'Binomial Expansion'),
  ('Numbers', 'Further Logarithms and Compound Interest'),
  ('Algebra', 'Linear Programming'),
  ('Algebra', 'Differentiation and Rate of Change'),
  ('Measurement', 'Three-Dimensional Geometry'),
  ('Measurement', 'Area Under a Curve'),
  ('Geometry', 'Loci and Locus Constructions'),
  ('Geometry', 'Compound Angles and Trigonometric Identities'),
  ('Data Handling and Probability', 'Statistics: Cumulative Frequency and Ogive'),
  ('Data Handling and Probability', 'Correlation and Line of Best Fit')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Mathematics')
  and st.grade_id = (select id from grades where name = 'Form 4')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Numbers', 'Binomial Expansion', 'The learner should be able to expand binomial expressions using Pascal''s triangle'),
  ('Numbers', 'Binomial Expansion', 'The learner should be able to apply binomial expansion to estimate numerical values'),
  ('Numbers', 'Further Logarithms and Compound Interest', 'The learner should be able to solve exponential equations using logarithms'),
  ('Numbers', 'Further Logarithms and Compound Interest', 'The learner should be able to apply logarithms to compound interest and depreciation problems'),
  ('Algebra', 'Linear Programming', 'The learner should be able to form linear inequalities to represent a given real-life situation'),
  ('Algebra', 'Linear Programming', 'The learner should be able to determine the optimal solution of a linear programming problem graphically'),
  ('Algebra', 'Differentiation and Rate of Change', 'The learner should be able to differentiate simple algebraic functions from first principles and by rule'),
  ('Algebra', 'Differentiation and Rate of Change', 'The learner should be able to apply differentiation to solve problems involving rates of change and turning points'),
  ('Measurement', 'Three-Dimensional Geometry', 'The learner should be able to calculate the angle between a line and a plane in three dimensions'),
  ('Measurement', 'Three-Dimensional Geometry', 'The learner should be able to calculate the angle between two planes in a solid figure'),
  ('Measurement', 'Area Under a Curve', 'The learner should be able to estimate the area under a curve using the trapezium rule'),
  ('Measurement', 'Area Under a Curve', 'The learner should be able to apply integration to find the area bounded by a curve and the axes'),
  ('Geometry', 'Loci and Locus Constructions', 'The learner should be able to construct the locus of a point moving under a given condition'),
  ('Geometry', 'Loci and Locus Constructions', 'The learner should be able to apply loci to solve practical siting and location problems'),
  ('Geometry', 'Compound Angles and Trigonometric Identities', 'The learner should be able to derive formulae for compound and double angles'),
  ('Geometry', 'Compound Angles and Trigonometric Identities', 'The learner should be able to solve trigonometric equations using compound angle identities'),
  ('Data Handling and Probability', 'Statistics: Cumulative Frequency and Ogive', 'The learner should be able to draw a cumulative frequency curve (ogive) for grouped data'),
  ('Data Handling and Probability', 'Statistics: Cumulative Frequency and Ogive', 'The learner should be able to estimate the median and quartiles from an ogive'),
  ('Data Handling and Probability', 'Correlation and Line of Best Fit', 'The learner should be able to draw a scatter diagram and a line of best fit for bivariate data'),
  ('Data Handling and Probability', 'Correlation and Line of Best Fit', 'The learner should be able to interpret the strength and direction of correlation between two variables')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Mathematics')
  and st.grade_id = (select id from grades where name = 'Form 4')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Chemistry / Form 4 ----

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
join grades g on g.name = 'Form 4'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Introduction to Chemistry and Matter', 'Organic Chemistry II'),
  ('Introduction to Chemistry and Matter', 'Radioactivity'),
  ('Structure of Matter and Bonding', 'Metals and their Extraction'),
  ('Structure of Matter and Bonding', 'Periodic Table Trends: Advanced'),
  ('Acids, Bases and Salts', 'Water Treatment and Analysis'),
  ('Acids, Bases and Salts', 'pH and Buffer Solutions'),
  ('Chemical Reactions and Energetics', 'Chemical Kinetics and Equilibrium'),
  ('Chemical Reactions and Energetics', 'Electrochemistry: Cells'),
  ('Chemistry of Elements and Compounds', 'Carbon and its Compounds: Fuels'),
  ('Chemistry of Elements and Compounds', 'Environmental Chemistry: Pollution')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Chemistry')
  and st.grade_id = (select id from grades where name = 'Form 4')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Introduction to Chemistry and Matter', 'Organic Chemistry II', 'The learner should be able to describe the properties and reactions of alkanes, alkenes and alcohols'),
  ('Introduction to Chemistry and Matter', 'Organic Chemistry II', 'The learner should be able to relate the structure of organic compounds to their properties'),
  ('Introduction to Chemistry and Matter', 'Radioactivity', 'The learner should be able to describe the types and properties of radioactive emissions'),
  ('Introduction to Chemistry and Matter', 'Radioactivity', 'The learner should be able to state the uses and hazards of radioactivity'),
  ('Structure of Matter and Bonding', 'Metals and their Extraction', 'The learner should be able to describe the extraction of a named metal from its ore'),
  ('Structure of Matter and Bonding', 'Metals and their Extraction', 'The learner should be able to relate the reactivity of metals to their extraction methods'),
  ('Structure of Matter and Bonding', 'Periodic Table Trends: Advanced', 'The learner should be able to explain trends in atomic radius and ionisation energy across a period'),
  ('Structure of Matter and Bonding', 'Periodic Table Trends: Advanced', 'The learner should be able to relate periodic trends to chemical reactivity'),
  ('Acids, Bases and Salts', 'Water Treatment and Analysis', 'The learner should be able to describe the stages involved in water treatment'),
  ('Acids, Bases and Salts', 'Water Treatment and Analysis', 'The learner should be able to test water for the presence of common impurities'),
  ('Acids, Bases and Salts', 'pH and Buffer Solutions', 'The learner should be able to explain the pH scale and measure the pH of common substances'),
  ('Acids, Bases and Salts', 'pH and Buffer Solutions', 'The learner should be able to describe the role of buffer solutions in maintaining pH'),
  ('Chemical Reactions and Energetics', 'Chemical Kinetics and Equilibrium', 'The learner should be able to describe the characteristics of a reversible reaction at equilibrium'),
  ('Chemical Reactions and Energetics', 'Chemical Kinetics and Equilibrium', 'The learner should be able to apply Le Chatelier''s principle to predict shifts in equilibrium'),
  ('Chemical Reactions and Energetics', 'Electrochemistry: Cells', 'The learner should be able to describe the working of a simple electrochemical cell'),
  ('Chemical Reactions and Energetics', 'Electrochemistry: Cells', 'The learner should be able to compare primary and secondary cells'),
  ('Chemistry of Elements and Compounds', 'Carbon and its Compounds: Fuels', 'The learner should be able to describe the fractional distillation of crude oil'),
  ('Chemistry of Elements and Compounds', 'Carbon and its Compounds: Fuels', 'The learner should be able to state the uses of the fractions obtained from crude oil'),
  ('Chemistry of Elements and Compounds', 'Environmental Chemistry: Pollution', 'The learner should be able to identify the major sources and effects of environmental pollution'),
  ('Chemistry of Elements and Compounds', 'Environmental Chemistry: Pollution', 'The learner should be able to propose measures for controlling chemical pollution')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Chemistry')
  and st.grade_id = (select id from grades where name = 'Form 4')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Biology / Form 4 ----

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
join grades g on g.name = 'Form 4'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Cell Biology and Classification', 'Coordination: The Nervous System'),
  ('Cell Biology and Classification', 'Coordination: The Endocrine System'),
  ('Nutrition and Transport', 'Support and Locomotion: The Skeletal System'),
  ('Nutrition and Transport', 'Behaviour in Plants and Animals'),
  ('Reproduction and Growth', 'Genetics: Applied Genetics'),
  ('Reproduction and Growth', 'Growth and Primary Growth Curves'),
  ('Genetics and Evolution', 'Evolution'),
  ('Genetics and Evolution', 'Variation and Selection'),
  ('Ecology and Environment', 'Human Populations and Health'),
  ('Ecology and Environment', 'Conservation of Environment: Advanced')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Biology')
  and st.grade_id = (select id from grades where name = 'Form 4')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Cell Biology and Classification', 'Coordination: The Nervous System', 'The learner should be able to describe the structure and function of a neurone'),
  ('Cell Biology and Classification', 'Coordination: The Nervous System', 'The learner should be able to explain the transmission of a nerve impulse'),
  ('Cell Biology and Classification', 'Coordination: The Endocrine System', 'The learner should be able to describe the location and function of major endocrine glands'),
  ('Cell Biology and Classification', 'Coordination: The Endocrine System', 'The learner should be able to explain the role of hormones in coordinating body activities'),
  ('Nutrition and Transport', 'Support and Locomotion: The Skeletal System', 'The learner should be able to describe the structure and function of the human skeleton'),
  ('Nutrition and Transport', 'Support and Locomotion: The Skeletal System', 'The learner should be able to explain the mechanism of movement at a joint'),
  ('Nutrition and Transport', 'Behaviour in Plants and Animals', 'The learner should be able to describe types of tropic responses in plants'),
  ('Nutrition and Transport', 'Behaviour in Plants and Animals', 'The learner should be able to distinguish between innate and learned behaviour in animals'),
  ('Reproduction and Growth', 'Genetics: Applied Genetics', 'The learner should be able to solve dihybrid genetic cross problems'),
  ('Reproduction and Growth', 'Genetics: Applied Genetics', 'The learner should be able to explain the application of genetics in agriculture and medicine'),
  ('Reproduction and Growth', 'Growth and Primary Growth Curves', 'The learner should be able to interpret sigmoid and other growth curves'),
  ('Reproduction and Growth', 'Growth and Primary Growth Curves', 'The learner should be able to explain factors that affect growth in living organisms'),
  ('Genetics and Evolution', 'Evolution', 'The learner should be able to explain the theories of evolution and the evidence supporting them'),
  ('Genetics and Evolution', 'Evolution', 'The learner should be able to describe the mechanism of natural selection'),
  ('Genetics and Evolution', 'Variation and Selection', 'The learner should be able to distinguish between continuous and discontinuous variation'),
  ('Genetics and Evolution', 'Variation and Selection', 'The learner should be able to explain how selection pressures lead to adaptation'),
  ('Ecology and Environment', 'Human Populations and Health', 'The learner should be able to describe the causes, effects and control of common diseases'),
  ('Ecology and Environment', 'Human Populations and Health', 'The learner should be able to explain factors affecting human population growth'),
  ('Ecology and Environment', 'Conservation of Environment: Advanced', 'The learner should be able to evaluate strategies for sustainable use of natural resources'),
  ('Ecology and Environment', 'Conservation of Environment: Advanced', 'The learner should be able to explain the role of international agreements in conservation')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Biology')
  and st.grade_id = (select id from grades where name = 'Form 4')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Physics / Form 4 ----

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
join grades g on g.name = 'Form 4'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Measurement and Mechanics', 'Uniform Circular Motion'),
  ('Measurement and Mechanics', 'Floating and Sinking: Archimedes'' Principle'),
  ('Heat and Matter', 'Thermal Energy Transfer: Vapourisation'),
  ('Heat and Matter', 'Structure of the Atom'),
  ('Waves, Light and Sound', 'Electromagnetic Spectrum'),
  ('Waves, Light and Sound', 'Photoelectric Effect: An Introduction'),
  ('Electricity and Magnetism', 'Mains Electricity and Electrical Wiring'),
  ('Electricity and Magnetism', 'Electronics: Diodes and Transistors'),
  ('Modern Physics and Energy', 'Radioactivity'),
  ('Modern Physics and Energy', 'X-Rays and Nuclear Energy')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Physics')
  and st.grade_id = (select id from grades where name = 'Form 4')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Measurement and Mechanics', 'Uniform Circular Motion', 'The learner should be able to explain the concept of centripetal force and acceleration'),
  ('Measurement and Mechanics', 'Uniform Circular Motion', 'The learner should be able to solve problems involving objects in uniform circular motion'),
  ('Measurement and Mechanics', 'Floating and Sinking: Archimedes'' Principle', 'The learner should be able to state and verify Archimedes'' principle experimentally'),
  ('Measurement and Mechanics', 'Floating and Sinking: Archimedes'' Principle', 'The learner should be able to apply the law of floatation to solve real-life problems'),
  ('Heat and Matter', 'Thermal Energy Transfer: Vapourisation', 'The learner should be able to explain the processes of melting, boiling and evaporation'),
  ('Heat and Matter', 'Thermal Energy Transfer: Vapourisation', 'The learner should be able to describe factors affecting the rate of evaporation'),
  ('Heat and Matter', 'Structure of the Atom', 'The learner should be able to describe the structure of the atom and isotopes'),
  ('Heat and Matter', 'Structure of the Atom', 'The learner should be able to explain the significance of atomic number and mass number'),
  ('Waves, Light and Sound', 'Electromagnetic Spectrum', 'The learner should be able to describe the components and properties of the electromagnetic spectrum'),
  ('Waves, Light and Sound', 'Electromagnetic Spectrum', 'The learner should be able to state everyday applications of electromagnetic waves'),
  ('Waves, Light and Sound', 'Photoelectric Effect: An Introduction', 'The learner should be able to describe the photoelectric effect and its significance'),
  ('Waves, Light and Sound', 'Photoelectric Effect: An Introduction', 'The learner should be able to relate the photoelectric effect to the particle nature of light'),
  ('Electricity and Magnetism', 'Mains Electricity and Electrical Wiring', 'The learner should be able to describe the domestic wiring system and safety devices used'),
  ('Electricity and Magnetism', 'Mains Electricity and Electrical Wiring', 'The learner should be able to calculate the cost of electrical energy consumed in a home'),
  ('Electricity and Magnetism', 'Electronics: Diodes and Transistors', 'The learner should be able to describe the working of a diode as a rectifier'),
  ('Electricity and Magnetism', 'Electronics: Diodes and Transistors', 'The learner should be able to describe the basic function of a transistor in simple circuits'),
  ('Modern Physics and Energy', 'Radioactivity', 'The learner should be able to describe the types and properties of radioactive emissions'),
  ('Modern Physics and Energy', 'Radioactivity', 'The learner should be able to explain the concept of half-life and its applications'),
  ('Modern Physics and Energy', 'X-Rays and Nuclear Energy', 'The learner should be able to describe the production and uses of X-rays'),
  ('Modern Physics and Energy', 'X-Rays and Nuclear Energy', 'The learner should be able to distinguish between nuclear fission and nuclear fusion')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Physics')
  and st.grade_id = (select id from grades where name = 'Form 4')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Christian Religious Education / Form 4 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('The Bible'),
  ('Christian Values'),
  ('Christian Living'),
  ('The Church')
) as v(name)
join subjects s on s.name = 'Christian Religious Education'
join grades g on g.name = 'Form 4'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('The Bible', 'The Letters of Paul'),
  ('The Bible', 'The Life of the Early Christian Community'),
  ('Christian Values', 'Human Sexuality and Morality'),
  ('Christian Values', 'Contemporary Social Issues'),
  ('Christian Living', 'Christian Citizenship and Nation Building'),
  ('Christian Living', 'Handling Conflict and Reconciliation'),
  ('The Church', 'Christian Leadership Today'),
  ('The Church', 'Ecumenism and Interfaith Relations')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Christian Religious Education')
  and st.grade_id = (select id from grades where name = 'Form 4')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('The Bible', 'The Letters of Paul', 'The learner should be able to outline the key teachings in selected letters of Paul'),
  ('The Bible', 'The Letters of Paul', 'The learner should be able to relate the teachings of Paul to Christian living today'),
  ('The Bible', 'The Life of the Early Christian Community', 'The learner should be able to describe the characteristics of the early Christian community'),
  ('The Bible', 'The Life of the Early Christian Community', 'The learner should be able to relate the practices of the early Church to the Church today'),
  ('Christian Values', 'Human Sexuality and Morality', 'The learner should be able to explain the Christian teaching on human sexuality and morality'),
  ('Christian Values', 'Human Sexuality and Morality', 'The learner should be able to demonstrate responsible behaviour regarding relationships and sexuality'),
  ('Christian Values', 'Contemporary Social Issues', 'The learner should be able to explain the Christian response to drug and substance abuse'),
  ('Christian Values', 'Contemporary Social Issues', 'The learner should be able to explain the Christian response to HIV/AIDS and related stigma'),
  ('Christian Living', 'Christian Citizenship and Nation Building', 'The learner should be able to explain the responsibilities of a Christian citizen'),
  ('Christian Living', 'Christian Citizenship and Nation Building', 'The learner should be able to describe ways Christians can contribute to nation-building'),
  ('Christian Living', 'Handling Conflict and Reconciliation', 'The learner should be able to explain the Christian teaching on conflict resolution and forgiveness'),
  ('Christian Living', 'Handling Conflict and Reconciliation', 'The learner should be able to demonstrate skills for promoting reconciliation in a community'),
  ('The Church', 'Christian Leadership Today', 'The learner should be able to evaluate qualities required of Christian leaders today'),
  ('The Church', 'Christian Leadership Today', 'The learner should be able to identify challenges facing Christian leadership in contemporary society'),
  ('The Church', 'Ecumenism and Interfaith Relations', 'The learner should be able to explain the meaning and importance of ecumenism'),
  ('The Church', 'Ecumenism and Interfaith Relations', 'The learner should be able to describe how Christians can relate positively with other faiths')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Christian Religious Education')
  and st.grade_id = (select id from grades where name = 'Form 4')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);
