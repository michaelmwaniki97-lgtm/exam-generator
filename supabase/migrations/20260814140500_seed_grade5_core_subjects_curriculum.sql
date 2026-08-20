-- ============================================================================
-- AI-generated curriculum structure (strands/sub_strands/learning_outcomes)
-- for Grade 5 (Upper Primary) core subjects — approximate content for MVP,
-- to be refined against official KICD sources later. Upper Primary subject set
-- differs from Lower Primary: Creative Activities and Environmental Activities
-- do not carry over; Science and Technology and Social Studies begin here.
-- NOT YET APPLIED — for review.
-- Re-runnable: every insert is guarded with `where not exists`, so applying
-- this file more than once inserts nothing the second time.
-- ============================================================================

-- ---- English / Grade 5 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Listening and Speaking'),
  ('Reading'),
  ('Writing'),
  ('Grammar in Use')
) as v(name)
join subjects s on s.name = 'English'
join grades g on g.name = 'Grade 5'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Listening and Speaking', 'Oral Presentation Skills'),
  ('Listening and Speaking', 'Listening for Detail'),
  ('Reading', 'Comprehension and Inference'),
  ('Reading', 'Reading for Pleasure'),
  ('Writing', 'Creative Composition'),
  ('Writing', 'Functional Writing: Letters and Notices'),
  ('Grammar in Use', 'Adverbs and Prepositions'),
  ('Grammar in Use', 'Sentence Types and Punctuation')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'English')
  and st.grade_id = (select id from grades where name = 'Grade 5')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Listening and Speaking', 'Oral Presentation Skills', 'The learner should be able to make a short oral presentation with confidence'),
  ('Listening and Speaking', 'Oral Presentation Skills', 'The learner should be able to use appropriate gestures and eye contact when speaking'),
  ('Listening and Speaking', 'Listening for Detail', 'The learner should be able to listen to a text and extract specific details'),
  ('Listening and Speaking', 'Listening for Detail', 'The learner should be able to take simple notes while listening'),
  ('Reading', 'Comprehension and Inference', 'The learner should be able to answer both direct and inferential comprehension questions'),
  ('Reading', 'Comprehension and Inference', 'The learner should be able to predict outcomes based on a text read'),
  ('Reading', 'Reading for Pleasure', 'The learner should be able to read a storybook and summarise its plot'),
  ('Reading', 'Reading for Pleasure', 'The learner should be able to develop the habit of independent reading'),
  ('Writing', 'Creative Composition', 'The learner should be able to write a story with a clear beginning, middle and end'),
  ('Writing', 'Creative Composition', 'The learner should be able to use descriptive words to make writing interesting'),
  ('Writing', 'Functional Writing: Letters and Notices', 'The learner should be able to write an informal letter following the correct format'),
  ('Writing', 'Functional Writing: Letters and Notices', 'The learner should be able to write a simple notice for a given purpose'),
  ('Grammar in Use', 'Adverbs and Prepositions', 'The learner should be able to identify and use adverbs correctly in sentences'),
  ('Grammar in Use', 'Adverbs and Prepositions', 'The learner should be able to use prepositions of place and time appropriately'),
  ('Grammar in Use', 'Sentence Types and Punctuation', 'The learner should be able to distinguish between statements, questions and commands'),
  ('Grammar in Use', 'Sentence Types and Punctuation', 'The learner should be able to punctuate different sentence types correctly')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'English')
  and st.grade_id = (select id from grades where name = 'Grade 5')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Kiswahili / Grade 5 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Kusikiliza na Kuzungumza'),
  ('Kusoma'),
  ('Kuandika'),
  ('Sarufi')
) as v(name)
join subjects s on s.name = 'Kiswahili'
join grades g on g.name = 'Grade 5'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Kusikiliza na Kuzungumza', 'Uwasilishaji wa Mdomo'),
  ('Kusikiliza na Kuzungumza', 'Kusikiliza kwa Makini'),
  ('Kusoma', 'Ufahamu wa Kina'),
  ('Kusoma', 'Kusoma kwa Starehe'),
  ('Kuandika', 'Insha ya Kubuni'),
  ('Kuandika', 'Barua na Matangazo'),
  ('Sarufi', 'Vielezi na Vihusishi'),
  ('Sarufi', 'Aina za Sentensi')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Kiswahili')
  and st.grade_id = (select id from grades where name = 'Grade 5')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Kusikiliza na Kuzungumza', 'Uwasilishaji wa Mdomo', 'The learner should be able to wasilisha mada fupi mbele ya wenzake kwa ujasiri'),
  ('Kusikiliza na Kuzungumza', 'Uwasilishaji wa Mdomo', 'The learner should be able to tumia ishara zinazofaa wakati wa uwasilishaji'),
  ('Kusikiliza na Kuzungumza', 'Kusikiliza kwa Makini', 'The learner should be able to sikiliza kifungu na kutoa maelezo mahususi'),
  ('Kusikiliza na Kuzungumza', 'Kusikiliza kwa Makini', 'The learner should be able to andika maelezo mafupi wakati wa kusikiliza'),
  ('Kusoma', 'Ufahamu wa Kina', 'The learner should be able to jibu maswali ya moja kwa moja na ya kufikirika'),
  ('Kusoma', 'Ufahamu wa Kina', 'The learner should be able to bashiri matokeo kutokana na kifungu alichosoma'),
  ('Kusoma', 'Kusoma kwa Starehe', 'The learner should be able to soma hadithi na kufupisha visa vyake'),
  ('Kusoma', 'Kusoma kwa Starehe', 'The learner should be able to sitawisha tabia ya kusoma kwa kujitegemea'),
  ('Kuandika', 'Insha ya Kubuni', 'The learner should be able to andika hadithi fupi yenye mwanzo, kati na mwisho'),
  ('Kuandika', 'Insha ya Kubuni', 'The learner should be able to tumia lugha ya kuvutia katika uandishi wa hadithi'),
  ('Kuandika', 'Barua na Matangazo', 'The learner should be able to andika barua isiyo rasmi kwa muundo sahihi'),
  ('Kuandika', 'Barua na Matangazo', 'The learner should be able to andika tangazo fupi kwa madhumuni fulani'),
  ('Sarufi', 'Vielezi na Vihusishi', 'The learner should be able to tambua na kutumia vielezi katika sentensi'),
  ('Sarufi', 'Vielezi na Vihusishi', 'The learner should be able to tumia vihusishi vya mahali na wakati ipasavyo'),
  ('Sarufi', 'Aina za Sentensi', 'The learner should be able to tofautisha sentensi za taarifa, maswali na amri'),
  ('Sarufi', 'Aina za Sentensi', 'The learner should be able to tumia alama za uakifishaji katika aina mbalimbali za sentensi')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Kiswahili')
  and st.grade_id = (select id from grades where name = 'Grade 5')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Mathematics / Grade 5 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Numbers'),
  ('Measurement'),
  ('Geometry'),
  ('Data Handling')
) as v(name)
join subjects s on s.name = 'Mathematics'
join grades g on g.name = 'Grade 5'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Numbers', 'Whole Numbers and Place Value'),
  ('Numbers', 'Fractions and Decimals'),
  ('Numbers', 'Percentages'),
  ('Measurement', 'Length, Area and Volume'),
  ('Measurement', 'Time, Speed and Money'),
  ('Geometry', 'Angles and Polygons'),
  ('Geometry', 'Symmetry and Patterns'),
  ('Data Handling', 'Graphs and Charts'),
  ('Data Handling', 'Averages')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Mathematics')
  and st.grade_id = (select id from grades where name = 'Grade 5')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Numbers', 'Whole Numbers and Place Value', 'The learner should be able to read, write and order numbers up to 1,000,000'),
  ('Numbers', 'Whole Numbers and Place Value', 'The learner should be able to round off numbers to the nearest ten, hundred and thousand'),
  ('Numbers', 'Fractions and Decimals', 'The learner should be able to add and subtract fractions with different denominators'),
  ('Numbers', 'Fractions and Decimals', 'The learner should be able to perform operations on decimals up to two decimal places'),
  ('Numbers', 'Percentages', 'The learner should be able to convert fractions and decimals to percentages'),
  ('Numbers', 'Percentages', 'The learner should be able to calculate simple percentages of a quantity'),
  ('Measurement', 'Length, Area and Volume', 'The learner should be able to calculate area of rectangles, squares and triangles'),
  ('Measurement', 'Length, Area and Volume', 'The learner should be able to calculate volume of cubes and cuboids'),
  ('Measurement', 'Time, Speed and Money', 'The learner should be able to solve problems involving time and simple speed'),
  ('Measurement', 'Time, Speed and Money', 'The learner should be able to prepare a simple personal budget'),
  ('Geometry', 'Angles and Polygons', 'The learner should be able to measure and draw angles using a protractor'),
  ('Geometry', 'Angles and Polygons', 'The learner should be able to identify and describe properties of common polygons'),
  ('Geometry', 'Symmetry and Patterns', 'The learner should be able to identify lines of symmetry in shapes and patterns'),
  ('Geometry', 'Symmetry and Patterns', 'The learner should be able to create patterns using geometric shapes'),
  ('Data Handling', 'Graphs and Charts', 'The learner should be able to represent data using bar graphs and pie charts'),
  ('Data Handling', 'Graphs and Charts', 'The learner should be able to interpret information presented in graphs and charts'),
  ('Data Handling', 'Averages', 'The learner should be able to calculate the mean of a small set of data'),
  ('Data Handling', 'Averages', 'The learner should be able to apply averages to solve real-life problems')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Mathematics')
  and st.grade_id = (select id from grades where name = 'Grade 5')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Science and Technology / Grade 5 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Living Things'),
  ('Human Body'),
  ('Environment'),
  ('Energy and Technology')
) as v(name)
join subjects s on s.name = 'Science and Technology'
join grades g on g.name = 'Grade 5'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Living Things', 'Plant Reproduction'),
  ('Living Things', 'Animal Life Cycles'),
  ('Human Body', 'The Circulatory System'),
  ('Human Body', 'The Respiratory System'),
  ('Environment', 'Weather and Climate'),
  ('Environment', 'Environmental Conservation'),
  ('Energy and Technology', 'Heat and Temperature'),
  ('Energy and Technology', 'Electricity and Simple Circuits')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Science and Technology')
  and st.grade_id = (select id from grades where name = 'Grade 5')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Living Things', 'Plant Reproduction', 'The learner should be able to describe the parts of a flower involved in reproduction'),
  ('Living Things', 'Plant Reproduction', 'The learner should be able to explain the process of pollination in plants'),
  ('Living Things', 'Animal Life Cycles', 'The learner should be able to describe the life cycle of common animals'),
  ('Living Things', 'Animal Life Cycles', 'The learner should be able to compare life cycles of different animals'),
  ('Human Body', 'The Circulatory System', 'The learner should be able to identify the main parts of the human circulatory system'),
  ('Human Body', 'The Circulatory System', 'The learner should be able to explain the function of blood in the body'),
  ('Human Body', 'The Respiratory System', 'The learner should be able to identify the main parts of the human respiratory system'),
  ('Human Body', 'The Respiratory System', 'The learner should be able to explain the process of breathing'),
  ('Environment', 'Weather and Climate', 'The learner should be able to identify instruments used to measure weather elements'),
  ('Environment', 'Weather and Climate', 'The learner should be able to record and interpret simple weather data'),
  ('Environment', 'Environmental Conservation', 'The learner should be able to identify human activities that harm the environment'),
  ('Environment', 'Environmental Conservation', 'The learner should be able to participate in activities that conserve the environment'),
  ('Energy and Technology', 'Heat and Temperature', 'The learner should be able to distinguish between heat and temperature'),
  ('Energy and Technology', 'Heat and Temperature', 'The learner should be able to describe how heat travels through different materials'),
  ('Energy and Technology', 'Electricity and Simple Circuits', 'The learner should be able to construct a simple electric circuit'),
  ('Energy and Technology', 'Electricity and Simple Circuits', 'The learner should be able to identify materials that conduct electricity')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Science and Technology')
  and st.grade_id = (select id from grades where name = 'Grade 5')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Social Studies / Grade 5 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Natural and Built Environment'),
  ('People and Population'),
  ('Resources and Economic Activities'),
  ('Political Systems and Governance')
) as v(name)
join subjects s on s.name = 'Social Studies'
join grades g on g.name = 'Grade 5'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Natural and Built Environment', 'Physical Features of Kenya'),
  ('Natural and Built Environment', 'Maps and Map Reading'),
  ('People and Population', 'Population Distribution in Kenya'),
  ('People and Population', 'Cultural Heritage'),
  ('Resources and Economic Activities', 'Agriculture in Kenya'),
  ('Resources and Economic Activities', 'Trade and Transport'),
  ('Political Systems and Governance', 'The Government of Kenya'),
  ('Political Systems and Governance', 'Democracy and Elections')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Social Studies')
  and st.grade_id = (select id from grades where name = 'Grade 5')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Natural and Built Environment', 'Physical Features of Kenya', 'The learner should be able to identify the major physical features of Kenya on a map'),
  ('Natural and Built Environment', 'Physical Features of Kenya', 'The learner should be able to explain how physical features influence human settlement'),
  ('Natural and Built Environment', 'Maps and Map Reading', 'The learner should be able to interpret symbols and a key on a map'),
  ('Natural and Built Environment', 'Maps and Map Reading', 'The learner should be able to determine direction and distance on a simple map'),
  ('People and Population', 'Population Distribution in Kenya', 'The learner should be able to describe how population is distributed in Kenya'),
  ('People and Population', 'Population Distribution in Kenya', 'The learner should be able to explain factors that influence population distribution'),
  ('People and Population', 'Cultural Heritage', 'The learner should be able to describe elements of Kenya''s cultural heritage'),
  ('People and Population', 'Cultural Heritage', 'The learner should be able to explain the importance of preserving cultural heritage'),
  ('Resources and Economic Activities', 'Agriculture in Kenya', 'The learner should be able to identify major agricultural activities in Kenya'),
  ('Resources and Economic Activities', 'Agriculture in Kenya', 'The learner should be able to explain the importance of agriculture to the economy'),
  ('Resources and Economic Activities', 'Trade and Transport', 'The learner should be able to describe the main means of transport used in Kenya'),
  ('Resources and Economic Activities', 'Trade and Transport', 'The learner should be able to explain the importance of trade to the community'),
  ('Political Systems and Governance', 'The Government of Kenya', 'The learner should be able to describe the three arms of the government of Kenya'),
  ('Political Systems and Governance', 'The Government of Kenya', 'The learner should be able to explain the functions of each arm of government'),
  ('Political Systems and Governance', 'Democracy and Elections', 'The learner should be able to explain the meaning of democracy'),
  ('Political Systems and Governance', 'Democracy and Elections', 'The learner should be able to describe how leaders are elected in Kenya')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Social Studies')
  and st.grade_id = (select id from grades where name = 'Grade 5')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Christian Religious Education / Grade 5 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Creation'),
  ('The Bible'),
  ('The Life of Jesus Christ'),
  ('Christian Living')
) as v(name)
join subjects s on s.name = 'Christian Religious Education'
join grades g on g.name = 'Grade 5'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Creation', 'God''s Creation and Human Responsibility'),
  ('Creation', 'The Fall of Man and Its Consequences'),
  ('The Bible', 'The Old Testament Leaders'),
  ('The Bible', 'Using the Bible'),
  ('The Life of Jesus Christ', 'The Ministry of Jesus'),
  ('The Life of Jesus Christ', 'Parables of Jesus'),
  ('Christian Living', 'Honesty, Obedience and Responsibility'),
  ('Christian Living', 'Living in Harmony with Others')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Christian Religious Education')
  and st.grade_id = (select id from grades where name = 'Grade 5')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Creation', 'God''s Creation and Human Responsibility', 'The learner should be able to explain the role of human beings as stewards of creation'),
  ('Creation', 'God''s Creation and Human Responsibility', 'The learner should be able to demonstrate responsible care for the environment'),
  ('Creation', 'The Fall of Man and Its Consequences', 'The learner should be able to narrate the biblical account of the fall of man'),
  ('Creation', 'The Fall of Man and Its Consequences', 'The learner should be able to explain the consequences of disobedience to God'),
  ('The Bible', 'The Old Testament Leaders', 'The learner should be able to narrate the stories of selected Old Testament leaders'),
  ('The Bible', 'The Old Testament Leaders', 'The learner should be able to explain lessons learnt from Old Testament leaders'),
  ('The Bible', 'Using the Bible', 'The learner should be able to locate and read Bible passages accurately'),
  ('The Bible', 'Using the Bible', 'The learner should be able to explain the importance of reading the Bible regularly'),
  ('The Life of Jesus Christ', 'The Ministry of Jesus', 'The learner should be able to describe the ministry and works of Jesus Christ'),
  ('The Life of Jesus Christ', 'The Ministry of Jesus', 'The learner should be able to explain how Jesus showed love and compassion'),
  ('The Life of Jesus Christ', 'Parables of Jesus', 'The learner should be able to narrate selected parables told by Jesus'),
  ('The Life of Jesus Christ', 'Parables of Jesus', 'The learner should be able to explain the meaning and lessons of the parables'),
  ('Christian Living', 'Honesty, Obedience and Responsibility', 'The learner should be able to explain the importance of honesty and obedience'),
  ('Christian Living', 'Honesty, Obedience and Responsibility', 'The learner should be able to demonstrate responsible behaviour at home and school'),
  ('Christian Living', 'Living in Harmony with Others', 'The learner should be able to explain the Christian teaching on loving one''s neighbour'),
  ('Christian Living', 'Living in Harmony with Others', 'The learner should be able to demonstrate ways of living peacefully with others')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Christian Religious Education')
  and st.grade_id = (select id from grades where name = 'Grade 5')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Agriculture / Grade 5 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Crop Production'),
  ('Livestock Production'),
  ('Agricultural Resources'),
  ('Nutrition and Food Handling')
) as v(name)
join subjects s on s.name = 'Agriculture'
join grades g on g.name = 'Grade 5'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Crop Production', 'Vegetable Growing'),
  ('Crop Production', 'Pest and Disease Control'),
  ('Livestock Production', 'Poultry Keeping'),
  ('Livestock Production', 'Animal Health'),
  ('Agricultural Resources', 'Soil Fertility and Manure'),
  ('Agricultural Resources', 'Water Harvesting'),
  ('Nutrition and Food Handling', 'Food Preparation and Preservation'),
  ('Nutrition and Food Handling', 'Value Addition to Farm Produce')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Agriculture')
  and st.grade_id = (select id from grades where name = 'Grade 5')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Crop Production', 'Vegetable Growing', 'The learner should be able to establish and manage a vegetable nursery'),
  ('Crop Production', 'Vegetable Growing', 'The learner should be able to transplant vegetable seedlings correctly'),
  ('Crop Production', 'Pest and Disease Control', 'The learner should be able to identify common crop pests and diseases'),
  ('Crop Production', 'Pest and Disease Control', 'The learner should be able to describe safe methods of controlling crop pests'),
  ('Livestock Production', 'Poultry Keeping', 'The learner should be able to describe the requirements for keeping poultry'),
  ('Livestock Production', 'Poultry Keeping', 'The learner should be able to explain the importance of poultry farming'),
  ('Livestock Production', 'Animal Health', 'The learner should be able to identify signs of a healthy and sick animal'),
  ('Livestock Production', 'Animal Health', 'The learner should be able to describe simple practices that keep animals healthy'),
  ('Agricultural Resources', 'Soil Fertility and Manure', 'The learner should be able to explain the importance of soil fertility in crop production'),
  ('Agricultural Resources', 'Soil Fertility and Manure', 'The learner should be able to prepare and apply organic manure'),
  ('Agricultural Resources', 'Water Harvesting', 'The learner should be able to describe simple methods of harvesting rainwater'),
  ('Agricultural Resources', 'Water Harvesting', 'The learner should be able to explain the importance of water harvesting in farming'),
  ('Nutrition and Food Handling', 'Food Preparation and Preservation', 'The learner should be able to prepare simple nutritious dishes from farm produce'),
  ('Nutrition and Food Handling', 'Food Preparation and Preservation', 'The learner should be able to describe methods of preserving food'),
  ('Nutrition and Food Handling', 'Value Addition to Farm Produce', 'The learner should be able to explain the meaning of value addition'),
  ('Nutrition and Food Handling', 'Value Addition to Farm Produce', 'The learner should be able to demonstrate simple value addition to a farm product')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Agriculture')
  and st.grade_id = (select id from grades where name = 'Grade 5')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);
