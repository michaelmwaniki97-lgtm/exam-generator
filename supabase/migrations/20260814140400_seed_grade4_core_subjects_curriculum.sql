-- ============================================================================
-- AI-generated curriculum structure (strands/sub_strands/learning_outcomes)
-- for Grade 4 (Upper Primary) core subjects — approximate content for MVP,
-- to be refined against official KICD sources later. Upper Primary subject set
-- differs from Lower Primary: Creative Activities and Environmental Activities
-- do not carry over; Science and Technology and Social Studies begin here.
-- NOT YET APPLIED — for review.
-- Re-runnable: every insert is guarded with `where not exists`, so applying
-- this file more than once inserts nothing the second time.
-- ============================================================================

-- ---- English / Grade 4 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Listening and Speaking'),
  ('Reading'),
  ('Writing'),
  ('Grammar in Use')
) as v(name)
join subjects s on s.name = 'English'
join grades g on g.name = 'Grade 4'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Listening and Speaking', 'Pronunciation and Oral Fluency'),
  ('Listening and Speaking', 'Listening Comprehension'),
  ('Reading', 'Reading Comprehension'),
  ('Reading', 'Vocabulary Development'),
  ('Writing', 'Guided Composition'),
  ('Writing', 'Spelling and Punctuation'),
  ('Grammar in Use', 'Nouns, Pronouns and Adjectives'),
  ('Grammar in Use', 'Verbs and Tenses')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'English')
  and st.grade_id = (select id from grades where name = 'Grade 4')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Listening and Speaking', 'Pronunciation and Oral Fluency', 'The learner should be able to pronounce words with correct stress and intonation'),
  ('Listening and Speaking', 'Pronunciation and Oral Fluency', 'The learner should be able to speak fluently on a familiar topic'),
  ('Listening and Speaking', 'Listening Comprehension', 'The learner should be able to listen to an oral text and answer questions accurately'),
  ('Listening and Speaking', 'Listening Comprehension', 'The learner should be able to identify the main message in an oral presentation'),
  ('Reading', 'Reading Comprehension', 'The learner should be able to read a passage and answer comprehension questions'),
  ('Reading', 'Reading Comprehension', 'The learner should be able to identify the main idea and supporting details'),
  ('Reading', 'Vocabulary Development', 'The learner should be able to use context clues to work out meanings of new words'),
  ('Reading', 'Vocabulary Development', 'The learner should be able to use a dictionary to find word meanings'),
  ('Writing', 'Guided Composition', 'The learner should be able to write a guided composition with a clear structure'),
  ('Writing', 'Guided Composition', 'The learner should be able to organise ideas into logical paragraphs'),
  ('Writing', 'Spelling and Punctuation', 'The learner should be able to spell common words correctly in written work'),
  ('Writing', 'Spelling and Punctuation', 'The learner should be able to use capital letters and full stops appropriately'),
  ('Grammar in Use', 'Nouns, Pronouns and Adjectives', 'The learner should be able to identify and use nouns, pronouns and adjectives correctly'),
  ('Grammar in Use', 'Nouns, Pronouns and Adjectives', 'The learner should be able to use adjectives to describe people and objects'),
  ('Grammar in Use', 'Verbs and Tenses', 'The learner should be able to use the simple present, past and future tenses correctly'),
  ('Grammar in Use', 'Verbs and Tenses', 'The learner should be able to maintain consistent tense in a piece of writing')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'English')
  and st.grade_id = (select id from grades where name = 'Grade 4')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Kiswahili / Grade 4 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Kusikiliza na Kuzungumza'),
  ('Kusoma'),
  ('Kuandika'),
  ('Sarufi')
) as v(name)
join subjects s on s.name = 'Kiswahili'
join grades g on g.name = 'Grade 4'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Kusikiliza na Kuzungumza', 'Matamshi na Ufasaha'),
  ('Kusikiliza na Kuzungumza', 'Kusikiliza na Kuelewa'),
  ('Kusoma', 'Ufahamu'),
  ('Kusoma', 'Msamiati'),
  ('Kuandika', 'Insha ya Maelezo'),
  ('Kuandika', 'Tahajia na Uakifishaji'),
  ('Sarufi', 'Ngeli za Nomino'),
  ('Sarufi', 'Nyakati')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Kiswahili')
  and st.grade_id = (select id from grades where name = 'Grade 4')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Kusikiliza na Kuzungumza', 'Matamshi na Ufasaha', 'The learner should be able to tamka maneno ya Kiswahili kwa ufasaha'),
  ('Kusikiliza na Kuzungumza', 'Matamshi na Ufasaha', 'The learner should be able to zungumza kwa ufasaha kuhusu mada anayoifahamu'),
  ('Kusikiliza na Kuzungumza', 'Kusikiliza na Kuelewa', 'The learner should be able to sikiliza kifungu na kujibu maswali kwa usahihi'),
  ('Kusikiliza na Kuzungumza', 'Kusikiliza na Kuelewa', 'The learner should be able to tambua ujumbe mkuu wa kifungu alichosikiliza'),
  ('Kusoma', 'Ufahamu', 'The learner should be able to soma kifungu na kujibu maswali ya ufahamu'),
  ('Kusoma', 'Ufahamu', 'The learner should be able to tambua wazo kuu la kifungu'),
  ('Kusoma', 'Msamiati', 'The learner should be able to tumia msamiati mpya katika sentensi'),
  ('Kusoma', 'Msamiati', 'The learner should be able to tumia kamusi kutafuta maana za maneno'),
  ('Kuandika', 'Insha ya Maelezo', 'The learner should be able to andika insha fupi ya maelezo yenye mpangilio'),
  ('Kuandika', 'Insha ya Maelezo', 'The learner should be able to panga mawazo katika aya zinazofuatana'),
  ('Kuandika', 'Tahajia na Uakifishaji', 'The learner should be able to tahajia maneno kwa usahihi katika uandishi'),
  ('Kuandika', 'Tahajia na Uakifishaji', 'The learner should be able to tumia alama za uakifishaji ipasavyo'),
  ('Sarufi', 'Ngeli za Nomino', 'The learner should be able to ainisha nomino katika ngeli mbalimbali'),
  ('Sarufi', 'Ngeli za Nomino', 'The learner should be able to onyesha upatanisho wa kisarufi kulingana na ngeli'),
  ('Sarufi', 'Nyakati', 'The learner should be able to tumia nyakati za sasa, zilizopita na zijazo kwa usahihi'),
  ('Sarufi', 'Nyakati', 'The learner should be able to dumisha wakati mmoja katika kifungu')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Kiswahili')
  and st.grade_id = (select id from grades where name = 'Grade 4')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Mathematics / Grade 4 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Numbers'),
  ('Measurement'),
  ('Geometry'),
  ('Data Handling')
) as v(name)
join subjects s on s.name = 'Mathematics'
join grades g on g.name = 'Grade 4'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Numbers', 'Whole Numbers'),
  ('Numbers', 'Operations on Whole Numbers'),
  ('Numbers', 'Fractions and Decimals'),
  ('Measurement', 'Length, Mass and Capacity'),
  ('Measurement', 'Time and Money'),
  ('Geometry', 'Lines, Angles and Shapes'),
  ('Geometry', 'Perimeter and Area'),
  ('Data Handling', 'Data Collection and Representation'),
  ('Data Handling', 'Data Interpretation')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Mathematics')
  and st.grade_id = (select id from grades where name = 'Grade 4')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Numbers', 'Whole Numbers', 'The learner should be able to read, write and order numbers up to 10,000'),
  ('Numbers', 'Whole Numbers', 'The learner should be able to identify place value in four-digit numbers'),
  ('Numbers', 'Operations on Whole Numbers', 'The learner should be able to add and subtract four-digit numbers with regrouping'),
  ('Numbers', 'Operations on Whole Numbers', 'The learner should be able to multiply and divide numbers by one- and two-digit numbers'),
  ('Numbers', 'Fractions and Decimals', 'The learner should be able to compare and order simple fractions'),
  ('Numbers', 'Fractions and Decimals', 'The learner should be able to convert simple fractions to decimals'),
  ('Measurement', 'Length, Mass and Capacity', 'The learner should be able to convert between units of length, mass and capacity'),
  ('Measurement', 'Length, Mass and Capacity', 'The learner should be able to solve real-life problems involving measurement'),
  ('Measurement', 'Time and Money', 'The learner should be able to solve problems involving duration and timetables'),
  ('Measurement', 'Time and Money', 'The learner should be able to calculate profit and loss in simple transactions'),
  ('Geometry', 'Lines, Angles and Shapes', 'The learner should be able to identify types of lines and angles in the environment'),
  ('Geometry', 'Lines, Angles and Shapes', 'The learner should be able to describe properties of common two-dimensional shapes'),
  ('Geometry', 'Perimeter and Area', 'The learner should be able to calculate the perimeter of rectangles and squares'),
  ('Geometry', 'Perimeter and Area', 'The learner should be able to calculate the area of rectangles and squares'),
  ('Data Handling', 'Data Collection and Representation', 'The learner should be able to collect and record data using tally marks and tables'),
  ('Data Handling', 'Data Collection and Representation', 'The learner should be able to represent data using simple bar graphs and pictographs'),
  ('Data Handling', 'Data Interpretation', 'The learner should be able to read and interpret information from a bar graph'),
  ('Data Handling', 'Data Interpretation', 'The learner should be able to draw simple conclusions from collected data')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Mathematics')
  and st.grade_id = (select id from grades where name = 'Grade 4')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Science and Technology / Grade 4 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Living Things'),
  ('Human Body'),
  ('Environment'),
  ('Energy and Technology')
) as v(name)
join subjects s on s.name = 'Science and Technology'
join grades g on g.name = 'Grade 4'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Living Things', 'Plants: Parts and Functions'),
  ('Living Things', 'Animals: Classification and Habitats'),
  ('Human Body', 'The Digestive System'),
  ('Human Body', 'Personal Hygiene and Health'),
  ('Environment', 'Water and Its Uses'),
  ('Environment', 'Soil and Conservation'),
  ('Energy and Technology', 'Sources and Forms of Energy'),
  ('Energy and Technology', 'Simple Machines and Tools')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Science and Technology')
  and st.grade_id = (select id from grades where name = 'Grade 4')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Living Things', 'Plants: Parts and Functions', 'The learner should be able to identify the parts of a flowering plant and their functions'),
  ('Living Things', 'Plants: Parts and Functions', 'The learner should be able to explain the importance of plants to human beings'),
  ('Living Things', 'Animals: Classification and Habitats', 'The learner should be able to classify animals based on observable characteristics'),
  ('Living Things', 'Animals: Classification and Habitats', 'The learner should be able to relate animals to their natural habitats'),
  ('Human Body', 'The Digestive System', 'The learner should be able to identify the main parts of the human digestive system'),
  ('Human Body', 'The Digestive System', 'The learner should be able to explain the importance of eating a balanced diet'),
  ('Human Body', 'Personal Hygiene and Health', 'The learner should be able to describe practices that promote personal hygiene'),
  ('Human Body', 'Personal Hygiene and Health', 'The learner should be able to explain how to prevent common communicable diseases'),
  ('Environment', 'Water and Its Uses', 'The learner should be able to identify sources and uses of water in the community'),
  ('Environment', 'Water and Its Uses', 'The learner should be able to describe simple methods of making water safe for drinking'),
  ('Environment', 'Soil and Conservation', 'The learner should be able to identify different types of soil and their properties'),
  ('Environment', 'Soil and Conservation', 'The learner should be able to explain methods of conserving soil'),
  ('Energy and Technology', 'Sources and Forms of Energy', 'The learner should be able to identify different sources and forms of energy'),
  ('Energy and Technology', 'Sources and Forms of Energy', 'The learner should be able to explain the uses of energy in the home and school'),
  ('Energy and Technology', 'Simple Machines and Tools', 'The learner should be able to identify simple machines used in everyday life'),
  ('Energy and Technology', 'Simple Machines and Tools', 'The learner should be able to explain how simple machines make work easier')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Science and Technology')
  and st.grade_id = (select id from grades where name = 'Grade 4')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Social Studies / Grade 4 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Natural and Built Environment'),
  ('People and Population'),
  ('Resources and Economic Activities'),
  ('Political Systems and Governance')
) as v(name)
join subjects s on s.name = 'Social Studies'
join grades g on g.name = 'Grade 4'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Natural and Built Environment', 'Our County'),
  ('Natural and Built Environment', 'Weather and Climate'),
  ('People and Population', 'Our Community and Culture'),
  ('People and Population', 'Family and Social Relationships'),
  ('Resources and Economic Activities', 'Natural Resources in Our County'),
  ('Resources and Economic Activities', 'Economic Activities'),
  ('Political Systems and Governance', 'Leadership in the Community'),
  ('Political Systems and Governance', 'Rights and Responsibilities of Children')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Social Studies')
  and st.grade_id = (select id from grades where name = 'Grade 4')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Natural and Built Environment', 'Our County', 'The learner should be able to locate their county on a map of Kenya'),
  ('Natural and Built Environment', 'Our County', 'The learner should be able to describe the main physical features of their county'),
  ('Natural and Built Environment', 'Weather and Climate', 'The learner should be able to record and interpret weather conditions'),
  ('Natural and Built Environment', 'Weather and Climate', 'The learner should be able to explain how weather influences human activities'),
  ('People and Population', 'Our Community and Culture', 'The learner should be able to describe the cultural practices of their community'),
  ('People and Population', 'Our Community and Culture', 'The learner should be able to appreciate cultural diversity within Kenya'),
  ('People and Population', 'Family and Social Relationships', 'The learner should be able to describe different types of families'),
  ('People and Population', 'Family and Social Relationships', 'The learner should be able to explain the importance of good relationships in a family'),
  ('Resources and Economic Activities', 'Natural Resources in Our County', 'The learner should be able to identify natural resources found in their county'),
  ('Resources and Economic Activities', 'Natural Resources in Our County', 'The learner should be able to explain the importance of conserving natural resources'),
  ('Resources and Economic Activities', 'Economic Activities', 'The learner should be able to identify the main economic activities in their locality'),
  ('Resources and Economic Activities', 'Economic Activities', 'The learner should be able to explain how economic activities improve livelihoods'),
  ('Political Systems and Governance', 'Leadership in the Community', 'The learner should be able to identify leaders in the school and community'),
  ('Political Systems and Governance', 'Leadership in the Community', 'The learner should be able to describe the qualities of a good leader'),
  ('Political Systems and Governance', 'Rights and Responsibilities of Children', 'The learner should be able to identify the rights of a child'),
  ('Political Systems and Governance', 'Rights and Responsibilities of Children', 'The learner should be able to explain the responsibilities that accompany their rights')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Social Studies')
  and st.grade_id = (select id from grades where name = 'Grade 4')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Christian Religious Education / Grade 4 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Creation'),
  ('The Bible'),
  ('The Life of Jesus Christ'),
  ('Christian Living')
) as v(name)
join subjects s on s.name = 'Christian Religious Education'
join grades g on g.name = 'Grade 4'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Creation', 'God the Creator'),
  ('Creation', 'Caring for God''s Creation'),
  ('The Bible', 'The Bible as God''s Word'),
  ('The Bible', 'Bible Stories and Their Lessons'),
  ('The Life of Jesus Christ', 'The Birth and Childhood of Jesus'),
  ('The Life of Jesus Christ', 'Miracles and Teachings of Jesus'),
  ('Christian Living', 'Christian Values in Daily Life'),
  ('Christian Living', 'Prayer and Worship')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Christian Religious Education')
  and st.grade_id = (select id from grades where name = 'Grade 4')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Creation', 'God the Creator', 'The learner should be able to narrate the biblical account of creation'),
  ('Creation', 'God the Creator', 'The learner should be able to appreciate God as the creator of all things'),
  ('Creation', 'Caring for God''s Creation', 'The learner should be able to explain ways of caring for the environment'),
  ('Creation', 'Caring for God''s Creation', 'The learner should be able to demonstrate responsible use of God''s creation'),
  ('The Bible', 'The Bible as God''s Word', 'The learner should be able to describe how the Bible is organised'),
  ('The Bible', 'The Bible as God''s Word', 'The learner should be able to locate a given Bible verse using book, chapter and verse'),
  ('The Bible', 'Bible Stories and Their Lessons', 'The learner should be able to narrate selected Bible stories'),
  ('The Bible', 'Bible Stories and Their Lessons', 'The learner should be able to explain lessons learnt from Bible stories'),
  ('The Life of Jesus Christ', 'The Birth and Childhood of Jesus', 'The learner should be able to narrate the events of the birth and childhood of Jesus'),
  ('The Life of Jesus Christ', 'The Birth and Childhood of Jesus', 'The learner should be able to explain the significance of Jesus'' birth to Christians'),
  ('The Life of Jesus Christ', 'Miracles and Teachings of Jesus', 'The learner should be able to narrate selected miracles performed by Jesus'),
  ('The Life of Jesus Christ', 'Miracles and Teachings of Jesus', 'The learner should be able to apply the teachings of Jesus to everyday life'),
  ('Christian Living', 'Christian Values in Daily Life', 'The learner should be able to identify Christian values such as love, honesty and kindness'),
  ('Christian Living', 'Christian Values in Daily Life', 'The learner should be able to practise Christian values at home and school'),
  ('Christian Living', 'Prayer and Worship', 'The learner should be able to explain the importance of prayer to a Christian'),
  ('Christian Living', 'Prayer and Worship', 'The learner should be able to participate in different forms of Christian worship')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Christian Religious Education')
  and st.grade_id = (select id from grades where name = 'Grade 4')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Agriculture / Grade 4 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Crop Production'),
  ('Livestock Production'),
  ('Agricultural Resources'),
  ('Nutrition and Food Handling')
) as v(name)
join subjects s on s.name = 'Agriculture'
join grades g on g.name = 'Grade 4'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Crop Production', 'Soil Preparation and Planting'),
  ('Crop Production', 'Crop Care Practices'),
  ('Livestock Production', 'Common Farm Animals'),
  ('Livestock Production', 'Caring for Small Animals'),
  ('Agricultural Resources', 'Farm Tools and Their Uses'),
  ('Agricultural Resources', 'Water Conservation in Farming'),
  ('Nutrition and Food Handling', 'Food Groups and Balanced Diet'),
  ('Nutrition and Food Handling', 'Food Hygiene and Storage')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Agriculture')
  and st.grade_id = (select id from grades where name = 'Grade 4')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Crop Production', 'Soil Preparation and Planting', 'The learner should be able to prepare a seedbed for planting vegetables'),
  ('Crop Production', 'Soil Preparation and Planting', 'The learner should be able to plant seeds observing correct spacing and depth'),
  ('Crop Production', 'Crop Care Practices', 'The learner should be able to carry out weeding, watering and mulching on a crop'),
  ('Crop Production', 'Crop Care Practices', 'The learner should be able to explain the importance of crop care practices'),
  ('Livestock Production', 'Common Farm Animals', 'The learner should be able to identify common farm animals kept in the locality'),
  ('Livestock Production', 'Common Farm Animals', 'The learner should be able to describe the products obtained from farm animals'),
  ('Livestock Production', 'Caring for Small Animals', 'The learner should be able to describe how to feed and house small farm animals'),
  ('Livestock Production', 'Caring for Small Animals', 'The learner should be able to explain the importance of clean animal housing'),
  ('Agricultural Resources', 'Farm Tools and Their Uses', 'The learner should be able to identify common farm tools and state their uses'),
  ('Agricultural Resources', 'Farm Tools and Their Uses', 'The learner should be able to demonstrate safe use and storage of farm tools'),
  ('Agricultural Resources', 'Water Conservation in Farming', 'The learner should be able to identify sources of water used in farming'),
  ('Agricultural Resources', 'Water Conservation in Farming', 'The learner should be able to describe simple methods of conserving water on the farm'),
  ('Nutrition and Food Handling', 'Food Groups and Balanced Diet', 'The learner should be able to classify foods into major food groups'),
  ('Nutrition and Food Handling', 'Food Groups and Balanced Diet', 'The learner should be able to prepare a simple balanced meal'),
  ('Nutrition and Food Handling', 'Food Hygiene and Storage', 'The learner should be able to describe hygienic ways of handling food'),
  ('Nutrition and Food Handling', 'Food Hygiene and Storage', 'The learner should be able to explain simple methods of storing farm produce')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Agriculture')
  and st.grade_id = (select id from grades where name = 'Grade 4')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);
