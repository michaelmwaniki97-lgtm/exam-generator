-- ============================================================================
-- AI-generated curriculum structure (strands/sub_strands/learning_outcomes)
-- for Grade 6 (Upper Primary) core subjects — approximate content for MVP,
-- to be refined against official KICD sources later. Upper Primary subject set
-- differs from Lower Primary: Creative Activities and Environmental Activities
-- do not carry over; Science and Technology and Social Studies begin here.
-- NOT YET APPLIED — for review.
-- Re-runnable: every insert is guarded with `where not exists`, so applying
-- this file more than once inserts nothing the second time.
-- ============================================================================

-- ---- English / Grade 6 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Listening and Speaking'),
  ('Reading'),
  ('Writing'),
  ('Grammar in Use')
) as v(name)
join subjects s on s.name = 'English'
join grades g on g.name = 'Grade 6'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Listening and Speaking', 'Debate and Discussion'),
  ('Listening and Speaking', 'Interviews and Reporting'),
  ('Reading', 'Critical Reading'),
  ('Reading', 'Study Skills'),
  ('Writing', 'Composition Writing'),
  ('Writing', 'Functional Writing: Formal Letters and Reports'),
  ('Grammar in Use', 'Tenses and Concord'),
  ('Grammar in Use', 'Direct and Indirect Speech')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'English')
  and st.grade_id = (select id from grades where name = 'Grade 6')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Listening and Speaking', 'Debate and Discussion', 'The learner should be able to present an argument clearly in a class debate'),
  ('Listening and Speaking', 'Debate and Discussion', 'The learner should be able to listen and respond respectfully to opposing views'),
  ('Listening and Speaking', 'Interviews and Reporting', 'The learner should be able to conduct a simple interview using prepared questions'),
  ('Listening and Speaking', 'Interviews and Reporting', 'The learner should be able to report the findings of an interview orally'),
  ('Reading', 'Critical Reading', 'The learner should be able to distinguish between fact and opinion in a text'),
  ('Reading', 'Critical Reading', 'The learner should be able to evaluate the writer''s purpose in a given passage'),
  ('Reading', 'Study Skills', 'The learner should be able to use skimming and scanning to locate information'),
  ('Reading', 'Study Skills', 'The learner should be able to summarise the main points of a passage'),
  ('Writing', 'Composition Writing', 'The learner should be able to write a well-organised composition on a given topic'),
  ('Writing', 'Composition Writing', 'The learner should be able to use varied vocabulary and sentence structures'),
  ('Writing', 'Functional Writing: Formal Letters and Reports', 'The learner should be able to write a formal letter following the correct format'),
  ('Writing', 'Functional Writing: Formal Letters and Reports', 'The learner should be able to write a simple report on an event or activity'),
  ('Grammar in Use', 'Tenses and Concord', 'The learner should be able to apply subject-verb agreement correctly'),
  ('Grammar in Use', 'Tenses and Concord', 'The learner should be able to use tenses consistently in extended writing'),
  ('Grammar in Use', 'Direct and Indirect Speech', 'The learner should be able to change direct speech to indirect speech'),
  ('Grammar in Use', 'Direct and Indirect Speech', 'The learner should be able to punctuate direct speech correctly')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'English')
  and st.grade_id = (select id from grades where name = 'Grade 6')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Kiswahili / Grade 6 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Kusikiliza na Kuzungumza'),
  ('Kusoma'),
  ('Kuandika'),
  ('Sarufi')
) as v(name)
join subjects s on s.name = 'Kiswahili'
join grades g on g.name = 'Grade 6'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Kusikiliza na Kuzungumza', 'Mdahalo na Majadiliano'),
  ('Kusikiliza na Kuzungumza', 'Mahojiano'),
  ('Kusoma', 'Usomaji wa Uchambuzi'),
  ('Kusoma', 'Mbinu za Kusoma'),
  ('Kuandika', 'Insha'),
  ('Kuandika', 'Barua Rasmi na Ripoti'),
  ('Sarufi', 'Nyakati na Upatanisho'),
  ('Sarufi', 'Msemo wa Moja kwa Moja na wa Taarifa')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Kiswahili')
  and st.grade_id = (select id from grades where name = 'Grade 6')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Kusikiliza na Kuzungumza', 'Mdahalo na Majadiliano', 'The learner should be able to wasilisha hoja kwa uwazi katika mdahalo'),
  ('Kusikiliza na Kuzungumza', 'Mdahalo na Majadiliano', 'The learner should be able to sikiliza na kujibu maoni tofauti kwa heshima'),
  ('Kusikiliza na Kuzungumza', 'Mahojiano', 'The learner should be able to fanya mahojiano rahisi kwa maswali yaliyoandaliwa'),
  ('Kusikiliza na Kuzungumza', 'Mahojiano', 'The learner should be able to ripoti matokeo ya mahojiano kwa mdomo'),
  ('Kusoma', 'Usomaji wa Uchambuzi', 'The learner should be able to tofautisha kati ya ukweli na maoni katika kifungu'),
  ('Kusoma', 'Usomaji wa Uchambuzi', 'The learner should be able to tathmini lengo la mwandishi katika kifungu'),
  ('Kusoma', 'Mbinu za Kusoma', 'The learner should be able to tumia mbinu za kusoma kwa haraka kupata habari'),
  ('Kusoma', 'Mbinu za Kusoma', 'The learner should be able to fupisha hoja kuu za kifungu'),
  ('Kuandika', 'Insha', 'The learner should be able to andika insha yenye mpangilio mzuri kuhusu mada aliyopewa'),
  ('Kuandika', 'Insha', 'The learner should be able to tumia msamiati na miundo mbalimbali ya sentensi'),
  ('Kuandika', 'Barua Rasmi na Ripoti', 'The learner should be able to andika barua rasmi kwa muundo unaofaa'),
  ('Kuandika', 'Barua Rasmi na Ripoti', 'The learner should be able to andika ripoti fupi kuhusu tukio fulani'),
  ('Sarufi', 'Nyakati na Upatanisho', 'The learner should be able to onyesha upatanisho sahihi wa kisarufi katika sentensi'),
  ('Sarufi', 'Nyakati na Upatanisho', 'The learner should be able to tumia nyakati kwa uthabiti katika uandishi'),
  ('Sarufi', 'Msemo wa Moja kwa Moja na wa Taarifa', 'The learner should be able to geuza msemo wa moja kwa moja kuwa wa taarifa'),
  ('Sarufi', 'Msemo wa Moja kwa Moja na wa Taarifa', 'The learner should be able to tumia alama za uakifishaji katika msemo wa moja kwa moja')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Kiswahili')
  and st.grade_id = (select id from grades where name = 'Grade 6')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Mathematics / Grade 6 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Numbers'),
  ('Measurement'),
  ('Geometry'),
  ('Data Handling')
) as v(name)
join subjects s on s.name = 'Mathematics'
join grades g on g.name = 'Grade 6'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Numbers', 'Whole Numbers and Operations'),
  ('Numbers', 'Fractions, Decimals and Percentages'),
  ('Numbers', 'Ratio and Proportion'),
  ('Measurement', 'Area, Volume and Capacity'),
  ('Measurement', 'Money and Simple Interest'),
  ('Geometry', 'Angles and Geometrical Constructions'),
  ('Geometry', 'Three-Dimensional Shapes'),
  ('Data Handling', 'Statistical Graphs'),
  ('Data Handling', 'Measures of Central Tendency')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Mathematics')
  and st.grade_id = (select id from grades where name = 'Grade 6')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Numbers', 'Whole Numbers and Operations', 'The learner should be able to perform combined operations using the correct order'),
  ('Numbers', 'Whole Numbers and Operations', 'The learner should be able to work out squares and square roots of whole numbers'),
  ('Numbers', 'Fractions, Decimals and Percentages', 'The learner should be able to convert between fractions, decimals and percentages'),
  ('Numbers', 'Fractions, Decimals and Percentages', 'The learner should be able to solve real-life problems involving percentages'),
  ('Numbers', 'Ratio and Proportion', 'The learner should be able to share quantities in a given ratio'),
  ('Numbers', 'Ratio and Proportion', 'The learner should be able to solve problems involving direct proportion'),
  ('Measurement', 'Area, Volume and Capacity', 'The learner should be able to calculate the area of circles and composite shapes'),
  ('Measurement', 'Area, Volume and Capacity', 'The learner should be able to calculate the volume and capacity of common solids'),
  ('Measurement', 'Money and Simple Interest', 'The learner should be able to calculate profit, loss and discount'),
  ('Measurement', 'Money and Simple Interest', 'The learner should be able to calculate simple interest on a given principal'),
  ('Geometry', 'Angles and Geometrical Constructions', 'The learner should be able to construct angles and bisect lines using a pair of compasses'),
  ('Geometry', 'Angles and Geometrical Constructions', 'The learner should be able to calculate angles in triangles and quadrilaterals'),
  ('Geometry', 'Three-Dimensional Shapes', 'The learner should be able to identify and describe properties of common solids'),
  ('Geometry', 'Three-Dimensional Shapes', 'The learner should be able to draw and interpret nets of common solids'),
  ('Data Handling', 'Statistical Graphs', 'The learner should be able to represent data using line graphs and pie charts'),
  ('Data Handling', 'Statistical Graphs', 'The learner should be able to interpret data presented in different types of graphs'),
  ('Data Handling', 'Measures of Central Tendency', 'The learner should be able to calculate the mean, median and mode of a data set'),
  ('Data Handling', 'Measures of Central Tendency', 'The learner should be able to apply measures of central tendency to real-life situations')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Mathematics')
  and st.grade_id = (select id from grades where name = 'Grade 6')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Science and Technology / Grade 6 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Living Things'),
  ('Human Body'),
  ('Environment'),
  ('Energy and Technology')
) as v(name)
join subjects s on s.name = 'Science and Technology'
join grades g on g.name = 'Grade 6'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Living Things', 'Classification of Living Things'),
  ('Living Things', 'Interdependence in Nature'),
  ('Human Body', 'The Excretory System'),
  ('Human Body', 'Reproductive Health and Adolescence'),
  ('Environment', 'Pollution and Waste Management'),
  ('Environment', 'Natural Resources and Conservation'),
  ('Energy and Technology', 'Light and Sound'),
  ('Energy and Technology', 'Machines and Digital Technology')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Science and Technology')
  and st.grade_id = (select id from grades where name = 'Grade 6')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Living Things', 'Classification of Living Things', 'The learner should be able to classify living things into major groups'),
  ('Living Things', 'Classification of Living Things', 'The learner should be able to explain the importance of classification'),
  ('Living Things', 'Interdependence in Nature', 'The learner should be able to construct simple food chains and food webs'),
  ('Living Things', 'Interdependence in Nature', 'The learner should be able to explain the interdependence of living things'),
  ('Human Body', 'The Excretory System', 'The learner should be able to identify the main parts of the human excretory system'),
  ('Human Body', 'The Excretory System', 'The learner should be able to explain the importance of excretion to the body'),
  ('Human Body', 'Reproductive Health and Adolescence', 'The learner should be able to describe changes that occur during adolescence'),
  ('Human Body', 'Reproductive Health and Adolescence', 'The learner should be able to explain the importance of personal hygiene during adolescence'),
  ('Environment', 'Pollution and Waste Management', 'The learner should be able to identify types and sources of pollution'),
  ('Environment', 'Pollution and Waste Management', 'The learner should be able to describe proper methods of waste disposal'),
  ('Environment', 'Natural Resources and Conservation', 'The learner should be able to identify renewable and non-renewable resources'),
  ('Environment', 'Natural Resources and Conservation', 'The learner should be able to explain strategies for conserving natural resources'),
  ('Energy and Technology', 'Light and Sound', 'The learner should be able to describe the properties of light including reflection'),
  ('Energy and Technology', 'Light and Sound', 'The learner should be able to explain how sound is produced and travels'),
  ('Energy and Technology', 'Machines and Digital Technology', 'The learner should be able to explain how simple machines make work easier'),
  ('Energy and Technology', 'Machines and Digital Technology', 'The learner should be able to describe the uses of digital devices in everyday life')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Science and Technology')
  and st.grade_id = (select id from grades where name = 'Grade 6')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Social Studies / Grade 6 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Natural and Built Environment'),
  ('People and Population'),
  ('Resources and Economic Activities'),
  ('Political Systems and Governance')
) as v(name)
join subjects s on s.name = 'Social Studies'
join grades g on g.name = 'Grade 6'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Natural and Built Environment', 'Physical Features of Eastern Africa'),
  ('Natural and Built Environment', 'Climate and Vegetation'),
  ('People and Population', 'Historical Development of Kenya'),
  ('People and Population', 'National Unity and Cohesion'),
  ('Resources and Economic Activities', 'Industries and Mining'),
  ('Resources and Economic Activities', 'Tourism and Trade'),
  ('Political Systems and Governance', 'Devolution and County Government'),
  ('Political Systems and Governance', 'Human Rights and the Constitution')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Social Studies')
  and st.grade_id = (select id from grades where name = 'Grade 6')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Natural and Built Environment', 'Physical Features of Eastern Africa', 'The learner should be able to locate major physical features of Eastern Africa on a map'),
  ('Natural and Built Environment', 'Physical Features of Eastern Africa', 'The learner should be able to explain how physical features influence climate'),
  ('Natural and Built Environment', 'Climate and Vegetation', 'The learner should be able to describe the main climatic regions of Kenya'),
  ('Natural and Built Environment', 'Climate and Vegetation', 'The learner should be able to relate climate to the natural vegetation of an area'),
  ('People and Population', 'Historical Development of Kenya', 'The learner should be able to describe key events in the history of Kenya'),
  ('People and Population', 'Historical Development of Kenya', 'The learner should be able to explain the contribution of national heroes to Kenya''s independence'),
  ('People and Population', 'National Unity and Cohesion', 'The learner should be able to explain the importance of national unity'),
  ('People and Population', 'National Unity and Cohesion', 'The learner should be able to identify factors that promote peaceful coexistence'),
  ('Resources and Economic Activities', 'Industries and Mining', 'The learner should be able to identify major industries and minerals in Kenya'),
  ('Resources and Economic Activities', 'Industries and Mining', 'The learner should be able to explain the contribution of industries to the economy'),
  ('Resources and Economic Activities', 'Tourism and Trade', 'The learner should be able to identify major tourist attractions in Kenya'),
  ('Resources and Economic Activities', 'Tourism and Trade', 'The learner should be able to explain the importance of tourism to the economy'),
  ('Political Systems and Governance', 'Devolution and County Government', 'The learner should be able to describe the structure of county government'),
  ('Political Systems and Governance', 'Devolution and County Government', 'The learner should be able to explain the functions of the county government'),
  ('Political Systems and Governance', 'Human Rights and the Constitution', 'The learner should be able to identify basic human rights in the Constitution of Kenya'),
  ('Political Systems and Governance', 'Human Rights and the Constitution', 'The learner should be able to explain the importance of respecting the rights of others')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Social Studies')
  and st.grade_id = (select id from grades where name = 'Grade 6')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Christian Religious Education / Grade 6 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Creation'),
  ('The Bible'),
  ('The Life of Jesus Christ'),
  ('Christian Living')
) as v(name)
join subjects s on s.name = 'Christian Religious Education'
join grades g on g.name = 'Grade 6'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Creation', 'God''s Plan for Creation'),
  ('Creation', 'Stewardship of the Environment'),
  ('The Bible', 'The Prophets'),
  ('The Bible', 'The New Testament Church'),
  ('The Life of Jesus Christ', 'The Death and Resurrection of Jesus'),
  ('The Life of Jesus Christ', 'Following the Example of Jesus'),
  ('Christian Living', 'Christian Values and Decision Making'),
  ('Christian Living', 'Service to Others')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Christian Religious Education')
  and st.grade_id = (select id from grades where name = 'Grade 6')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Creation', 'God''s Plan for Creation', 'The learner should be able to explain God''s purpose for creating human beings'),
  ('Creation', 'God''s Plan for Creation', 'The learner should be able to appreciate the uniqueness of every person as God''s creation'),
  ('Creation', 'Stewardship of the Environment', 'The learner should be able to explain the Christian responsibility of caring for creation'),
  ('Creation', 'Stewardship of the Environment', 'The learner should be able to participate in activities that conserve the environment'),
  ('The Bible', 'The Prophets', 'The learner should be able to narrate the work of selected Old Testament prophets'),
  ('The Bible', 'The Prophets', 'The learner should be able to explain the messages of the prophets to the people'),
  ('The Bible', 'The New Testament Church', 'The learner should be able to describe the beginning of the early Church'),
  ('The Bible', 'The New Testament Church', 'The learner should be able to explain the work of the apostles in spreading the gospel'),
  ('The Life of Jesus Christ', 'The Death and Resurrection of Jesus', 'The learner should be able to narrate the events of the death and resurrection of Jesus'),
  ('The Life of Jesus Christ', 'The Death and Resurrection of Jesus', 'The learner should be able to explain the significance of the resurrection to Christians'),
  ('The Life of Jesus Christ', 'Following the Example of Jesus', 'The learner should be able to identify qualities of Jesus worth emulating'),
  ('The Life of Jesus Christ', 'Following the Example of Jesus', 'The learner should be able to demonstrate Christ-like behaviour in daily life'),
  ('Christian Living', 'Christian Values and Decision Making', 'The learner should be able to apply Christian values when making decisions'),
  ('Christian Living', 'Christian Values and Decision Making', 'The learner should be able to explain the consequences of wrong choices'),
  ('Christian Living', 'Service to Others', 'The learner should be able to explain the Christian teaching on serving others'),
  ('Christian Living', 'Service to Others', 'The learner should be able to participate in activities that help the needy in the community')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Christian Religious Education')
  and st.grade_id = (select id from grades where name = 'Grade 6')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Agriculture / Grade 6 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Crop Production'),
  ('Livestock Production'),
  ('Agricultural Resources'),
  ('Nutrition and Food Handling')
) as v(name)
join subjects s on s.name = 'Agriculture'
join grades g on g.name = 'Grade 6'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Crop Production', 'Crop Farming Practices'),
  ('Crop Production', 'Post-Harvest Handling'),
  ('Livestock Production', 'Dairy and Small Livestock Farming'),
  ('Livestock Production', 'Livestock Products and Marketing'),
  ('Agricultural Resources', 'Soil Conservation'),
  ('Agricultural Resources', 'Agroforestry'),
  ('Nutrition and Food Handling', 'Balanced Diet and Food Security'),
  ('Nutrition and Food Handling', 'Entrepreneurship in Agriculture')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Agriculture')
  and st.grade_id = (select id from grades where name = 'Grade 6')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Crop Production', 'Crop Farming Practices', 'The learner should be able to describe practices that improve crop yields'),
  ('Crop Production', 'Crop Farming Practices', 'The learner should be able to carry out proper harvesting of a named crop'),
  ('Crop Production', 'Post-Harvest Handling', 'The learner should be able to describe proper post-harvest handling of produce'),
  ('Crop Production', 'Post-Harvest Handling', 'The learner should be able to explain how poor handling leads to post-harvest losses'),
  ('Livestock Production', 'Dairy and Small Livestock Farming', 'The learner should be able to describe the management of dairy and small livestock'),
  ('Livestock Production', 'Dairy and Small Livestock Farming', 'The learner should be able to explain the economic importance of livestock farming'),
  ('Livestock Production', 'Livestock Products and Marketing', 'The learner should be able to identify products obtained from different livestock'),
  ('Livestock Production', 'Livestock Products and Marketing', 'The learner should be able to describe simple ways of marketing livestock products'),
  ('Agricultural Resources', 'Soil Conservation', 'The learner should be able to identify causes and effects of soil erosion'),
  ('Agricultural Resources', 'Soil Conservation', 'The learner should be able to describe methods of controlling soil erosion'),
  ('Agricultural Resources', 'Agroforestry', 'The learner should be able to explain the meaning and importance of agroforestry'),
  ('Agricultural Resources', 'Agroforestry', 'The learner should be able to describe suitable trees for agroforestry in their locality'),
  ('Nutrition and Food Handling', 'Balanced Diet and Food Security', 'The learner should be able to plan a balanced diet using locally available foods'),
  ('Nutrition and Food Handling', 'Balanced Diet and Food Security', 'The learner should be able to explain the meaning and importance of food security'),
  ('Nutrition and Food Handling', 'Entrepreneurship in Agriculture', 'The learner should be able to identify income-generating opportunities in agriculture'),
  ('Nutrition and Food Handling', 'Entrepreneurship in Agriculture', 'The learner should be able to prepare a simple budget for a small farming project')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Agriculture')
  and st.grade_id = (select id from grades where name = 'Grade 6')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);
