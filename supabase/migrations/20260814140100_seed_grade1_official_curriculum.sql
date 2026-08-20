-- ============================================================================
-- Curriculum structure (strands/sub_strands) for Grade 1 sourced from the
-- official KICD scheme of work summary provided by the teacher (Grade 1.pdf).
-- Strand and sub-strand names are verbatim from that source; learning outcomes
-- below are AI-paraphrased approximations for MVP.
-- NOT YET APPLIED — for review.
-- Re-runnable: every insert is guarded with `where not exists`, so applying
-- this file more than once inserts nothing the second time.
-- ============================================================================

-- ---- Creative Activities / Grade 1 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Creating and Execution'),
  ('Performing and Displaying'),
  ('Appreciation')
) as v(name)
join subjects s on s.name = 'Creative Activities'
join grades g on g.name = 'Grade 1'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Creating and Execution', 'Jumping'),
  ('Creating and Execution', 'Musical Sounds'),
  ('Creating and Execution', 'Drawing'),
  ('Creating and Execution', 'Stretching'),
  ('Creating and Execution', 'Painting and Colouring'),
  ('Creating and Execution', 'Pattern making'),
  ('Creating and Execution', 'Rhythm'),
  ('Performing and Displaying', 'Africa Style -Singing Games'),
  ('Performing and Displaying', 'Throwing and Catching'),
  ('Performing and Displaying', 'Paper Craft'),
  ('Performing and Displaying', 'Log Roll and T Balances'),
  ('Performing and Displaying', 'Percussion Musical Instruments'),
  ('Performing and Displaying', 'Modelling'),
  ('Appreciation', 'Africa Style -Singing Games'),
  ('Appreciation', 'Water Safety Awareness')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Creative Activities')
  and st.grade_id = (select id from grades where name = 'Grade 1')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Creating and Execution', 'Jumping', 'The learner should be able to jump using both feet with correct landing technique'),
  ('Creating and Execution', 'Jumping', 'The learner should be able to jump over a low obstacle safely'),
  ('Creating and Execution', 'Musical Sounds', 'The learner should be able to identify different musical sounds in the environment'),
  ('Creating and Execution', 'Musical Sounds', 'The learner should be able to produce simple musical sounds using classroom objects'),
  ('Creating and Execution', 'Drawing', 'The learner should be able to draw simple familiar objects freely'),
  ('Creating and Execution', 'Drawing', 'The learner should be able to hold a drawing tool correctly while drawing'),
  ('Creating and Execution', 'Stretching', 'The learner should be able to perform simple stretching movements for the body'),
  ('Creating and Execution', 'Stretching', 'The learner should be able to stretch different body parts safely before play'),
  ('Creating and Execution', 'Painting and Colouring', 'The learner should be able to colour pictures neatly within the lines'),
  ('Creating and Execution', 'Painting and Colouring', 'The learner should be able to mix colours to create new ones'),
  ('Creating and Execution', 'Pattern making', 'The learner should be able to make simple repeating patterns using shapes or colours'),
  ('Creating and Execution', 'Pattern making', 'The learner should be able to identify patterns in the immediate environment'),
  ('Creating and Execution', 'Rhythm', 'The learner should be able to clap to a simple rhythm'),
  ('Creating and Execution', 'Rhythm', 'The learner should be able to move their body in time with a rhythm'),
  ('Performing and Displaying', 'Africa Style -Singing Games', 'The learner should be able to participate in African singing games with correct actions'),
  ('Performing and Displaying', 'Africa Style -Singing Games', 'The learner should be able to sing along to a familiar singing game'),
  ('Performing and Displaying', 'Throwing and Catching', 'The learner should be able to throw a ball towards a target'),
  ('Performing and Displaying', 'Throwing and Catching', 'The learner should be able to catch a ball rolled or thrown to them'),
  ('Performing and Displaying', 'Paper Craft', 'The learner should be able to fold paper to make simple craft items'),
  ('Performing and Displaying', 'Paper Craft', 'The learner should be able to cut and paste paper shapes to create a craft item'),
  ('Performing and Displaying', 'Log Roll and T Balances', 'The learner should be able to perform a log roll safely on a mat'),
  ('Performing and Displaying', 'Log Roll and T Balances', 'The learner should be able to hold a simple T balance position'),
  ('Performing and Displaying', 'Percussion Musical Instruments', 'The learner should be able to identify simple percussion instruments'),
  ('Performing and Displaying', 'Percussion Musical Instruments', 'The learner should be able to play a simple rhythm using a percussion instrument'),
  ('Performing and Displaying', 'Modelling', 'The learner should be able to model simple objects using clay or play dough'),
  ('Performing and Displaying', 'Modelling', 'The learner should be able to describe the object they have modelled'),
  ('Appreciation', 'Africa Style -Singing Games', 'The learner should be able to appreciate the cultural value of African singing games'),
  ('Appreciation', 'Africa Style -Singing Games', 'The learner should be able to enjoy participating in singing games with peers'),
  ('Appreciation', 'Water Safety Awareness', 'The learner should be able to identify safe and unsafe practices around water'),
  ('Appreciation', 'Water Safety Awareness', 'The learner should be able to explain why it is important to be careful near water')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Creative Activities')
  and st.grade_id = (select id from grades where name = 'Grade 1')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Environmental Activities / Grade 1 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Social Environment'),
  ('Natural Environment'),
  ('Resources in Our Environment')
) as v(name)
join subjects s on s.name = 'Environmental Activities'
join grades g on g.name = 'Grade 1'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Social Environment', 'Cleaning my body'),
  ('Social Environment', 'Our home'),
  ('Social Environment', 'Family needs'),
  ('Social Environment', 'Our school'),
  ('Social Environment', 'Our Market'),
  ('Natural Environment', 'Weather and the sky'),
  ('Natural Environment', 'Soil'),
  ('Natural Environment', 'Sound'),
  ('Resources in Our Environment', 'Water'),
  ('Resources in Our Environment', 'Plants'),
  ('Resources in Our Environment', 'Animals')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Environmental Activities')
  and st.grade_id = (select id from grades where name = 'Grade 1')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Social Environment', 'Cleaning my body', 'The learner should be able to demonstrate correct ways of keeping the body clean'),
  ('Social Environment', 'Cleaning my body', 'The learner should be able to explain why personal hygiene is important'),
  ('Social Environment', 'Our home', 'The learner should be able to identify members of their family and their roles'),
  ('Social Environment', 'Our home', 'The learner should be able to describe things found in their home'),
  ('Social Environment', 'Family needs', 'The learner should be able to identify basic needs of a family'),
  ('Social Environment', 'Family needs', 'The learner should be able to explain how family needs are met'),
  ('Social Environment', 'Our school', 'The learner should be able to identify people who work in the school'),
  ('Social Environment', 'Our school', 'The learner should be able to describe places found within the school'),
  ('Social Environment', 'Our Market', 'The learner should be able to identify items sold in a local market'),
  ('Social Environment', 'Our Market', 'The learner should be able to explain the importance of a market to the community'),
  ('Natural Environment', 'Weather and the sky', 'The learner should be able to describe daily weather conditions'),
  ('Natural Environment', 'Weather and the sky', 'The learner should be able to identify objects seen in the sky during the day and night'),
  ('Natural Environment', 'Soil', 'The learner should be able to identify different types of soil in their environment'),
  ('Natural Environment', 'Soil', 'The learner should be able to explain the uses of soil'),
  ('Natural Environment', 'Sound', 'The learner should be able to identify different sounds in the environment'),
  ('Natural Environment', 'Sound', 'The learner should be able to distinguish between loud and soft sounds'),
  ('Resources in Our Environment', 'Water', 'The learner should be able to identify sources of water in their environment'),
  ('Resources in Our Environment', 'Water', 'The learner should be able to explain the uses of water'),
  ('Resources in Our Environment', 'Plants', 'The learner should be able to identify common plants in their environment'),
  ('Resources in Our Environment', 'Plants', 'The learner should be able to explain the importance of plants'),
  ('Resources in Our Environment', 'Animals', 'The learner should be able to identify common animals in their environment'),
  ('Resources in Our Environment', 'Animals', 'The learner should be able to explain the importance of animals')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Environmental Activities')
  and st.grade_id = (select id from grades where name = 'Grade 1')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Mathematics / Grade 1 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Numbers'),
  ('Measurements'),
  ('Geometry')
) as v(name)
join subjects s on s.name = 'Mathematics'
join grades g on g.name = 'Grade 1'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Numbers', 'Pre-number activities'),
  ('Numbers', 'Whole numbers'),
  ('Numbers', 'Addition'),
  ('Numbers', 'Subtraction'),
  ('Measurements', 'Length'),
  ('Measurements', 'Mass'),
  ('Measurements', 'Capacity'),
  ('Measurements', 'Time'),
  ('Measurements', 'Money'),
  ('Geometry', 'Lines'),
  ('Geometry', 'Shapes')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Mathematics')
  and st.grade_id = (select id from grades where name = 'Grade 1')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Numbers', 'Pre-number activities', 'The learner should be able to sort and classify objects by colour, size or shape'),
  ('Numbers', 'Pre-number activities', 'The learner should be able to match objects one to one'),
  ('Numbers', 'Whole numbers', 'The learner should be able to count, read and write numbers up to 20'),
  ('Numbers', 'Whole numbers', 'The learner should be able to arrange numbers in ascending and descending order'),
  ('Numbers', 'Addition', 'The learner should be able to add numbers with a sum up to 20'),
  ('Numbers', 'Addition', 'The learner should be able to solve simple real-life addition problems'),
  ('Numbers', 'Subtraction', 'The learner should be able to subtract numbers within 20'),
  ('Numbers', 'Subtraction', 'The learner should be able to solve simple real-life subtraction problems'),
  ('Measurements', 'Length', 'The learner should be able to compare objects by length using non-standard units'),
  ('Measurements', 'Length', 'The learner should be able to arrange objects from shortest to longest'),
  ('Measurements', 'Mass', 'The learner should be able to compare objects by mass using non-standard units'),
  ('Measurements', 'Mass', 'The learner should be able to identify objects that are heavier or lighter'),
  ('Measurements', 'Capacity', 'The learner should be able to compare containers by the amount they hold'),
  ('Measurements', 'Capacity', 'The learner should be able to identify containers that hold more or less'),
  ('Measurements', 'Time', 'The learner should be able to identify events that happen in the morning, afternoon and evening'),
  ('Measurements', 'Time', 'The learner should be able to name the days of the week in order'),
  ('Measurements', 'Money', 'The learner should be able to identify Kenyan coins and notes'),
  ('Measurements', 'Money', 'The learner should be able to relate money to buying simple items'),
  ('Geometry', 'Lines', 'The learner should be able to identify straight and curved lines in the environment'),
  ('Geometry', 'Lines', 'The learner should be able to draw straight and curved lines'),
  ('Geometry', 'Shapes', 'The learner should be able to identify common shapes such as circles, squares and triangles'),
  ('Geometry', 'Shapes', 'The learner should be able to sort objects according to their shapes')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Mathematics')
  and st.grade_id = (select id from grades where name = 'Grade 1')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Kiswahili / Grade 1 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Kusikiliza na Kuzungumza'),
  ('Kusoma'),
  ('Kuandika'),
  ('Sarufi')
) as v(name)
join subjects s on s.name = 'Kiswahili'
join grades g on g.name = 'Grade 1'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Kusikiliza na Kuzungumza', 'Maamkuzi na Maagano'),
  ('Kusikiliza na Kuzungumza', 'Maneno ya Adabu na Heshima'),
  ('Kusikiliza na Kuzungumza', 'Matamshi Bora'),
  ('Kusikiliza na Kuzungumza', 'Kifungu cha Hadithi'),
  ('Kusikiliza na Kuzungumza', 'Maagizo'),
  ('Kusikiliza na Kuzungumza', 'Mazungumzo'),
  ('Kusoma', 'Usomaji Mwafaka'),
  ('Kusoma', 'Kusoma kwa Ufahamu'),
  ('Kusoma', 'Kusoma kwa Ufasaha'),
  ('Kuandika', 'Uandishi Bora'),
  ('Kuandika', 'Hati Nadhifu Herufi kubwa'),
  ('Kuandika', 'Hati Nadhifu Herufi Ndogo'),
  ('Kuandika', 'Hati Nadhifu'),
  ('Kuandika', 'Matumizi ya Kikomo'),
  ('Kuandika', 'Tahajia Imla'),
  ('Kuandika', 'Kuandika maneno ipasavyo'),
  ('Kuandika', 'Tahajia'),
  ('Kuandika', 'Kifungu kutokana na picha'),
  ('Sarufi', 'Matumizi ya Mimi na Sisi'),
  ('Sarufi', 'Umoja na Wingi wa Majina'),
  ('Sarufi', 'Matumizi ya Huyu na Hawa'),
  ('Sarufi', 'Matumizi ya -angu na -etu'),
  ('Sarufi', 'Matumizi ya -zuri na baya'),
  ('Sarufi', 'Ukanushaji'),
  ('Sarufi', 'Matumizi ya hiki na hivi'),
  ('Sarufi', 'Matumizi ya maneno yanayoashiria vitendo'),
  ('Sarufi', 'Vinyume vya Vitendo')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Kiswahili')
  and st.grade_id = (select id from grades where name = 'Grade 1')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Kusikiliza na Kuzungumza', 'Maamkuzi na Maagano', 'The learner should be able to toa na kupokea maamkuzi kwa usahihi'),
  ('Kusikiliza na Kuzungumza', 'Maamkuzi na Maagano', 'The learner should be able to aga kwa adabu anapoondoka'),
  ('Kusikiliza na Kuzungumza', 'Maneno ya Adabu na Heshima', 'The learner should be able to tumia maneno ya adabu kama tafadhali na asante'),
  ('Kusikiliza na Kuzungumza', 'Maneno ya Adabu na Heshima', 'The learner should be able to onyesha heshima kwa wazee kupitia maneno anayotumia'),
  ('Kusikiliza na Kuzungumza', 'Matamshi Bora', 'The learner should be able to tamka sauti na maneno ya Kiswahili kwa usahihi'),
  ('Kusikiliza na Kuzungumza', 'Matamshi Bora', 'The learner should be able to tamka maneno magumu kwa ufasaha'),
  ('Kusikiliza na Kuzungumza', 'Kifungu cha Hadithi', 'The learner should be able to sikiliza hadithi fupi na kuisimulia kwa maneno yake'),
  ('Kusikiliza na Kuzungumza', 'Kifungu cha Hadithi', 'The learner should be able to jibu maswali rahisi kuhusu hadithi aliyosikiliza'),
  ('Kusikiliza na Kuzungumza', 'Maagizo', 'The learner should be able to sikiliza na kufuata maagizo rahisi'),
  ('Kusikiliza na Kuzungumza', 'Maagizo', 'The learner should be able to toa maagizo rahisi kwa mwenzake'),
  ('Kusikiliza na Kuzungumza', 'Mazungumzo', 'The learner should be able to shiriki mazungumzo rahisi na wenzake'),
  ('Kusikiliza na Kuzungumza', 'Mazungumzo', 'The learner should be able to sikiliza mwenzake anapozungumza bila kumkatiza'),
  ('Kusoma', 'Usomaji Mwafaka', 'The learner should be able to soma herufi na silabi za Kiswahili kwa usahihi'),
  ('Kusoma', 'Usomaji Mwafaka', 'The learner should be able to soma maneno rahisi ya Kiswahili'),
  ('Kusoma', 'Kusoma kwa Ufahamu', 'The learner should be able to soma sentensi fupi na kuelewa maana yake'),
  ('Kusoma', 'Kusoma kwa Ufahamu', 'The learner should be able to jibu maswali rahisi kuhusu kifungu alichosoma'),
  ('Kusoma', 'Kusoma kwa Ufasaha', 'The learner should be able to soma kifungu fupi bila kusitasita'),
  ('Kusoma', 'Kusoma kwa Ufasaha', 'The learner should be able to soma kwa mahadhi yanayofaa'),
  ('Kuandika', 'Uandishi Bora', 'The learner should be able to andika herufi za Kiswahili kwa mpangilio unaofaa'),
  ('Kuandika', 'Uandishi Bora', 'The learner should be able to andika maneno rahisi kwa hati nadhifu'),
  ('Kuandika', 'Hati Nadhifu Herufi kubwa', 'The learner should be able to andika herufi kubwa za alfabeti kwa usahihi'),
  ('Kuandika', 'Hati Nadhifu Herufi kubwa', 'The learner should be able to tumia herufi kubwa mwanzoni mwa sentensi'),
  ('Kuandika', 'Hati Nadhifu Herufi Ndogo', 'The learner should be able to andika herufi ndogo za alfabeti kwa usahihi'),
  ('Kuandika', 'Hati Nadhifu Herufi Ndogo', 'The learner should be able to andika maneno kwa herufi ndogo zenye mpangilio mzuri'),
  ('Kuandika', 'Hati Nadhifu', 'The learner should be able to andika kwa hati safi na nadhifu'),
  ('Kuandika', 'Hati Nadhifu', 'The learner should be able to acha nafasi ifaayo kati ya maneno anapoandika'),
  ('Kuandika', 'Matumizi ya Kikomo', 'The learner should be able to tumia kikomo (nukta) mwishoni mwa sentensi'),
  ('Kuandika', 'Matumizi ya Kikomo', 'The learner should be able to tambua mahali panapofaa kutumia kikomo'),
  ('Kuandika', 'Tahajia Imla', 'The learner should be able to andika maneno anayosikia kwa tahajia sahihi'),
  ('Kuandika', 'Tahajia Imla', 'The learner should be able to andika sentensi fupi za imla kwa usahihi'),
  ('Kuandika', 'Kuandika maneno ipasavyo', 'The learner should be able to andika maneno rahisi bila kukosea herufi'),
  ('Kuandika', 'Kuandika maneno ipasavyo', 'The learner should be able to kagua na kusahihisha makosa rahisi ya tahajia'),
  ('Kuandika', 'Tahajia', 'The learner should be able to tahajia maneno rahisi ya kila siku'),
  ('Kuandika', 'Tahajia', 'The learner should be able to tambua herufi zinazounda neno fulani'),
  ('Kuandika', 'Kifungu kutokana na picha', 'The learner should be able to andika sentensi rahisi kutokana na picha'),
  ('Kuandika', 'Kifungu kutokana na picha', 'The learner should be able to eleza kwa maneno kile kinachoonyeshwa na picha'),
  ('Sarufi', 'Matumizi ya Mimi na Sisi', 'The learner should be able to tumia neno mimi anapojizungumzia'),
  ('Sarufi', 'Matumizi ya Mimi na Sisi', 'The learner should be able to tumia neno sisi anapozungumzia kikundi'),
  ('Sarufi', 'Umoja na Wingi wa Majina', 'The learner should be able to tambua umoja na wingi wa majina rahisi'),
  ('Sarufi', 'Umoja na Wingi wa Majina', 'The learner should be able to badilisha jina kutoka umoja kwenda wingi'),
  ('Sarufi', 'Matumizi ya Huyu na Hawa', 'The learner should be able to tumia neno huyu kumwelekeza mtu mmoja'),
  ('Sarufi', 'Matumizi ya Huyu na Hawa', 'The learner should be able to tumia neno hawa kuelekeza watu wengi'),
  ('Sarufi', 'Matumizi ya -angu na -etu', 'The learner should be able to tumia kiambishi -angu kuonyesha umiliki wa mtu mmoja'),
  ('Sarufi', 'Matumizi ya -angu na -etu', 'The learner should be able to tumia kiambishi -etu kuonyesha umiliki wa kikundi'),
  ('Sarufi', 'Matumizi ya -zuri na baya', 'The learner should be able to tumia neno -zuri kueleza sifa nzuri ya kitu'),
  ('Sarufi', 'Matumizi ya -zuri na baya', 'The learner should be able to tumia neno -baya kueleza sifa mbaya ya kitu'),
  ('Sarufi', 'Ukanushaji', 'The learner should be able to kanusha sentensi rahisi kwa usahihi'),
  ('Sarufi', 'Ukanushaji', 'The learner should be able to tambua maneno yanayoonyesha ukanushaji'),
  ('Sarufi', 'Matumizi ya hiki na hivi', 'The learner should be able to tumia neno hiki kuelekeza kitu kimoja kilicho karibu'),
  ('Sarufi', 'Matumizi ya hiki na hivi', 'The learner should be able to tumia neno hivi kuelekeza vitu vingi vilivyo karibu'),
  ('Sarufi', 'Matumizi ya maneno yanayoashiria vitendo', 'The learner should be able to tambua vitenzi vinavyoonyesha vitendo mbalimbali'),
  ('Sarufi', 'Matumizi ya maneno yanayoashiria vitendo', 'The learner should be able to tumia vitenzi ipasavyo katika sentensi'),
  ('Sarufi', 'Vinyume vya Vitendo', 'The learner should be able to tambua vitendo na vinyume vyake'),
  ('Sarufi', 'Vinyume vya Vitendo', 'The learner should be able to tumia vinyume vya vitendo katika sentensi rahisi')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Kiswahili')
  and st.grade_id = (select id from grades where name = 'Grade 1')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);
