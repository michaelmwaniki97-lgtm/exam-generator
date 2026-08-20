-- ============================================================================
-- Curriculum structure (strands/sub_strands) for Grade 2 sourced from the
-- official KICD scheme of work summary provided by the teacher (HI Creative
-- Activities Grade 2.docx, embedded tables). Strand and sub-strand names are
-- verbatim from that source; learning outcomes below are AI-paraphrased
-- approximations for MVP.
-- NOT YET APPLIED — for review.
-- Re-runnable: every insert is guarded with `where not exists`, so applying
-- this file more than once inserts nothing the second time.
-- ============================================================================

-- ---- Creative Activities / Grade 2 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Creating and Execution'),
  ('Performing and Display'),
  ('Appreciation')
) as v(name)
join subjects s on s.name = 'Creative Activities'
join grades g on g.name = 'Grade 2'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Creating and Execution', 'Hopping'),
  ('Creating and Execution', 'Drawing and Painting'),
  ('Creating and Execution', 'Rhythm and Pattern Making'),
  ('Creating and Execution', 'Turning'),
  ('Creating and Execution', 'Mosaic'),
  ('Creating and Execution', 'Melody'),
  ('Performing and Display', 'Singing Games- Western Style'),
  ('Performing and Display', 'Kicking'),
  ('Performing and Display', 'Plaited Ornaments'),
  ('Performing and Display', 'Egg Roll and Swan Balance'),
  ('Performing and Display', 'Wind Musical Instruments'),
  ('Performing and Display', 'Modelling'),
  ('Appreciation', 'Singing Games - Western Style'),
  ('Appreciation', 'Water Safety Awareness')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Creative Activities')
  and st.grade_id = (select id from grades where name = 'Grade 2')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Creating and Execution', 'Hopping', 'The learner should be able to hop on one foot maintaining balance'),
  ('Creating and Execution', 'Hopping', 'The learner should be able to hop over a series of small obstacles'),
  ('Creating and Execution', 'Drawing and Painting', 'The learner should be able to draw and paint familiar objects with more detail'),
  ('Creating and Execution', 'Drawing and Painting', 'The learner should be able to use different painting techniques to create a picture'),
  ('Creating and Execution', 'Rhythm and Pattern Making', 'The learner should be able to create a simple rhythmic pattern using body movements'),
  ('Creating and Execution', 'Rhythm and Pattern Making', 'The learner should be able to make a repeating pattern using different materials'),
  ('Creating and Execution', 'Turning', 'The learner should be able to perform a simple turn while maintaining balance'),
  ('Creating and Execution', 'Turning', 'The learner should be able to turn in different directions on command'),
  ('Creating and Execution', 'Mosaic', 'The learner should be able to create a simple mosaic using small pieces of material'),
  ('Creating and Execution', 'Mosaic', 'The learner should be able to arrange mosaic pieces to form a picture'),
  ('Creating and Execution', 'Melody', 'The learner should be able to sing a simple melody in tune'),
  ('Creating and Execution', 'Melody', 'The learner should be able to identify high and low sounds in a melody'),
  ('Performing and Display', 'Singing Games- Western Style', 'The learner should be able to participate in western-style singing games with correct actions'),
  ('Performing and Display', 'Singing Games- Western Style', 'The learner should be able to sing along to a familiar western-style singing game'),
  ('Performing and Display', 'Kicking', 'The learner should be able to kick a stationary ball towards a target'),
  ('Performing and Display', 'Kicking', 'The learner should be able to kick a moving ball with control'),
  ('Performing and Display', 'Plaited Ornaments', 'The learner should be able to plait simple materials to make an ornament'),
  ('Performing and Display', 'Plaited Ornaments', 'The learner should be able to describe the materials used to make a plaited ornament'),
  ('Performing and Display', 'Egg Roll and Swan Balance', 'The learner should be able to perform an egg roll safely on a mat'),
  ('Performing and Display', 'Egg Roll and Swan Balance', 'The learner should be able to hold a swan balance position with control'),
  ('Performing and Display', 'Wind Musical Instruments', 'The learner should be able to identify simple wind instruments'),
  ('Performing and Display', 'Wind Musical Instruments', 'The learner should be able to produce a sound using a simple wind instrument'),
  ('Performing and Display', 'Modelling', 'The learner should be able to model objects with increasing detail using clay'),
  ('Performing and Display', 'Modelling', 'The learner should be able to explain the process used to model an object'),
  ('Appreciation', 'Singing Games - Western Style', 'The learner should be able to appreciate the value of western-style singing games'),
  ('Appreciation', 'Singing Games - Western Style', 'The learner should be able to enjoy participating in group singing games'),
  ('Appreciation', 'Water Safety Awareness', 'The learner should be able to identify safe practices when playing near water'),
  ('Appreciation', 'Water Safety Awareness', 'The learner should be able to explain simple water rescue precautions')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Creative Activities')
  and st.grade_id = (select id from grades where name = 'Grade 2')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Environmental Activities / Grade 2 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Social Environment'),
  ('Natural Environment'),
  ('Resources in Our Environment')
) as v(name)
join subjects s on s.name = 'Environmental Activities'
join grades g on g.name = 'Grade 2'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Social Environment', 'Our Home'),
  ('Social Environment', 'Family Needs and Wants'),
  ('Social Environment', 'Our School'),
  ('Social Environment', 'Our National Flag'),
  ('Social Environment', 'Our Rights and Responsibilities'),
  ('Social Environment', 'Our Market'),
  ('Natural Environment', 'Weather'),
  ('Natural Environment', 'Soil'),
  ('Natural Environment', 'Light'),
  ('Resources in Our Environment', 'Water'),
  ('Resources in Our Environment', 'Plants'),
  ('Resources in Our Environment', 'Animals')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Environmental Activities')
  and st.grade_id = (select id from grades where name = 'Grade 2')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Social Environment', 'Our Home', 'The learner should be able to describe the different rooms and their uses in a home'),
  ('Social Environment', 'Our Home', 'The learner should be able to explain the roles of different family members at home'),
  ('Social Environment', 'Family Needs and Wants', 'The learner should be able to distinguish between needs and wants of a family'),
  ('Social Environment', 'Family Needs and Wants', 'The learner should be able to explain how a family can meet its basic needs'),
  ('Social Environment', 'Our School', 'The learner should be able to identify different departments and their roles in school'),
  ('Social Environment', 'Our School', 'The learner should be able to explain the importance of school rules'),
  ('Social Environment', 'Our National Flag', 'The learner should be able to identify the colours and symbols of the Kenyan flag'),
  ('Social Environment', 'Our National Flag', 'The learner should be able to explain the meaning of the colours of the national flag'),
  ('Social Environment', 'Our Rights and Responsibilities', 'The learner should be able to identify their basic rights as a child'),
  ('Social Environment', 'Our Rights and Responsibilities', 'The learner should be able to explain their responsibilities at home and school'),
  ('Social Environment', 'Our Market', 'The learner should be able to describe activities that take place in a market'),
  ('Social Environment', 'Our Market', 'The learner should be able to explain the role of buyers and sellers in a market'),
  ('Natural Environment', 'Weather', 'The learner should be able to record daily weather conditions using simple symbols'),
  ('Natural Environment', 'Weather', 'The learner should be able to explain how weather affects daily activities'),
  ('Natural Environment', 'Soil', 'The learner should be able to describe different types of soil found in the environment'),
  ('Natural Environment', 'Soil', 'The learner should be able to explain how soil is used in farming'),
  ('Natural Environment', 'Light', 'The learner should be able to identify sources of light in the environment'),
  ('Natural Environment', 'Light', 'The learner should be able to explain the importance of light to living things'),
  ('Resources in Our Environment', 'Water', 'The learner should be able to describe different sources and uses of water'),
  ('Resources in Our Environment', 'Water', 'The learner should be able to explain ways of conserving water'),
  ('Resources in Our Environment', 'Plants', 'The learner should be able to describe the parts of a plant and their uses'),
  ('Resources in Our Environment', 'Plants', 'The learner should be able to explain the importance of caring for plants'),
  ('Resources in Our Environment', 'Animals', 'The learner should be able to classify animals as domestic or wild'),
  ('Resources in Our Environment', 'Animals', 'The learner should be able to explain the importance of caring for animals')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Environmental Activities')
  and st.grade_id = (select id from grades where name = 'Grade 2')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Mathematics / Grade 2 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Numbers'),
  ('Measurements'),
  ('Geometry')
) as v(name)
join subjects s on s.name = 'Mathematics'
join grades g on g.name = 'Grade 2'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Numbers', 'Number Concept'),
  ('Numbers', 'Whole Numbers'),
  ('Numbers', 'Addition'),
  ('Numbers', 'Subtraction'),
  ('Numbers', 'Multiplication'),
  ('Numbers', 'Division'),
  ('Numbers', 'Fractions'),
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
  and st.grade_id = (select id from grades where name = 'Grade 2')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Numbers', 'Number Concept', 'The learner should be able to count objects and represent the count using numerals'),
  ('Numbers', 'Number Concept', 'The learner should be able to compare quantities using more than, less than and equal to'),
  ('Numbers', 'Whole Numbers', 'The learner should be able to read, write and order numbers up to 100'),
  ('Numbers', 'Whole Numbers', 'The learner should be able to identify the place value of digits in a two-digit number'),
  ('Numbers', 'Addition', 'The learner should be able to add numbers with a sum up to 100'),
  ('Numbers', 'Addition', 'The learner should be able to solve real-life problems involving addition'),
  ('Numbers', 'Subtraction', 'The learner should be able to subtract numbers within 100'),
  ('Numbers', 'Subtraction', 'The learner should be able to solve real-life problems involving subtraction'),
  ('Numbers', 'Multiplication', 'The learner should be able to multiply numbers using repeated addition'),
  ('Numbers', 'Multiplication', 'The learner should be able to recall multiplication facts up to 5 times table'),
  ('Numbers', 'Division', 'The learner should be able to divide numbers into equal groups'),
  ('Numbers', 'Division', 'The learner should be able to solve simple real-life division problems'),
  ('Numbers', 'Fractions', 'The learner should be able to identify halves and quarters of a whole'),
  ('Numbers', 'Fractions', 'The learner should be able to represent simple fractions using diagrams'),
  ('Measurements', 'Length', 'The learner should be able to measure length using standard units such as the metre'),
  ('Measurements', 'Length', 'The learner should be able to compare and order objects by length'),
  ('Measurements', 'Mass', 'The learner should be able to measure mass using standard units such as the kilogram'),
  ('Measurements', 'Mass', 'The learner should be able to compare objects by mass'),
  ('Measurements', 'Capacity', 'The learner should be able to measure capacity using standard units such as the litre'),
  ('Measurements', 'Capacity', 'The learner should be able to compare containers by capacity'),
  ('Measurements', 'Time', 'The learner should be able to tell time to the hour and half hour'),
  ('Measurements', 'Time', 'The learner should be able to name the months of the year in order'),
  ('Measurements', 'Money', 'The learner should be able to identify and count Kenyan coins and notes'),
  ('Measurements', 'Money', 'The learner should be able to solve simple problems involving buying and selling'),
  ('Geometry', 'Lines', 'The learner should be able to identify horizontal, vertical and slanting lines'),
  ('Geometry', 'Lines', 'The learner should be able to draw different types of lines using a ruler'),
  ('Geometry', 'Shapes', 'The learner should be able to identify and name common two-dimensional shapes'),
  ('Geometry', 'Shapes', 'The learner should be able to describe the properties of common shapes')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Mathematics')
  and st.grade_id = (select id from grades where name = 'Grade 2')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);

-- ---- Kiswahili / Grade 2 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Kusikiliza na Kuzungumza'),
  ('Kusoma'),
  ('Kuandika'),
  ('Sarufi')
) as v(name)
join subjects s on s.name = 'Kiswahili'
join grades g on g.name = 'Grade 2'
where not exists (
  select 1 from strands x
  where x.subject_id = s.id and x.grade_id = g.id and x.name = v.name
);

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Kusikiliza na Kuzungumza', 'Maamkuzi na Maagano'),
  ('Kusikiliza na Kuzungumza', 'Matamshi Bora'),
  ('Kusikiliza na Kuzungumza', 'Maneno ya Heshima na Adabu'),
  ('Kusikiliza na Kuzungumza', 'Hadithi'),
  ('Kusikiliza na Kuzungumza', 'Maagizo'),
  ('Kusikiliza na Kuzungumza', 'Mazungumzo ya Papo kwa Hapo'),
  ('Kusoma', 'Kusoma Ufahamu'),
  ('Kusoma', 'Kusoma kwa Ufasaha'),
  ('Kuandika', 'Hati nadhifu: Sentensi'),
  ('Kuandika', 'Hati Nadhifu Herufi kubwa'),
  ('Kuandika', 'Mpangilio wa Herufi Ndogo'),
  ('Kuandika', 'Nafasi katika maandishi'),
  ('Kuandika', 'Uakifishi: Matumizi ya Kiulizi'),
  ('Kuandika', 'Tahajia: Imla'),
  ('Kuandika', 'Uhariri'),
  ('Kuandika', 'Tahajia'),
  ('Kuandika', 'Kuandika Kifungu'),
  ('Kuandika', 'Maneno na Sentensi'),
  ('Sarufi', 'Matumizi ya wewe na nyinyi'),
  ('Sarufi', 'Umoja na Wingi wa Vifungu'),
  ('Sarufi', 'Matumizi ya Huyo na Hao'),
  ('Sarufi', 'Umoja na wingi wa vifungu vya maneno'),
  ('Sarufi', 'Matumizi ya -ako na -enu'),
  ('Sarufi', 'Matumizi ya -refu, -kubwa, -tamu'),
  ('Sarufi', 'Ukanusho wa nafsi ya pili, umoja na wingi'),
  ('Sarufi', 'Matumizi ya huu na hii'),
  ('Sarufi', 'Matumizi ya vizuri na vibaya, polepole na haraka'),
  ('Sarufi', 'Vinyume vya Vitendo')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Kiswahili')
  and st.grade_id = (select id from grades where name = 'Grade 2')
where not exists (
  select 1 from sub_strands x
  where x.strand_id = st.id and x.name = v.sub_name
);

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Kusikiliza na Kuzungumza', 'Maamkuzi na Maagano', 'The learner should be able to toa maamkuzi yanayofaa wakati mbalimbali wa siku'),
  ('Kusikiliza na Kuzungumza', 'Maamkuzi na Maagano', 'The learner should be able to aga kwa njia mwafaka anapoondoka mahali'),
  ('Kusikiliza na Kuzungumza', 'Matamshi Bora', 'The learner should be able to tamka maneno ya Kiswahili kwa ufasaha zaidi'),
  ('Kusikiliza na Kuzungumza', 'Matamshi Bora', 'The learner should be able to tamka sentensi fupi kwa mahadhi sahihi'),
  ('Kusikiliza na Kuzungumza', 'Maneno ya Heshima na Adabu', 'The learner should be able to tumia maneno ya heshima anapozungumza na wakubwa'),
  ('Kusikiliza na Kuzungumza', 'Maneno ya Heshima na Adabu', 'The learner should be able to onyesha adabu katika mazungumzo ya kila siku'),
  ('Kusikiliza na Kuzungumza', 'Hadithi', 'The learner should be able to sikiliza hadithi na kutambua wahusika wake'),
  ('Kusikiliza na Kuzungumza', 'Hadithi', 'The learner should be able to simulia hadithi fupi aliyosikiliza kwa maneno yake'),
  ('Kusikiliza na Kuzungumza', 'Maagizo', 'The learner should be able to sikiliza na kutekeleza maagizo ya hatua mbili'),
  ('Kusikiliza na Kuzungumza', 'Maagizo', 'The learner should be able to toa maagizo sahihi kwa mwenzake'),
  ('Kusikiliza na Kuzungumza', 'Mazungumzo ya Papo kwa Hapo', 'The learner should be able to shiriki mazungumzo ya papo kwa hapo kwa ujasiri'),
  ('Kusikiliza na Kuzungumza', 'Mazungumzo ya Papo kwa Hapo', 'The learner should be able to jibu maswali ya papo kwa hapo kwa haraka na usahihi'),
  ('Kusoma', 'Kusoma Ufahamu', 'The learner should be able to soma kifungu na kuelewa maudhui yake'),
  ('Kusoma', 'Kusoma Ufahamu', 'The learner should be able to jibu maswali ya ufahamu kwa usahihi zaidi'),
  ('Kusoma', 'Kusoma kwa Ufasaha', 'The learner should be able to soma kifungu kirefu zaidi kwa ufasaha'),
  ('Kusoma', 'Kusoma kwa Ufasaha', 'The learner should be able to soma kwa kasi na mahadhi yanayofaa'),
  ('Kuandika', 'Hati nadhifu: Sentensi', 'The learner should be able to andika sentensi kamili kwa hati nadhifu'),
  ('Kuandika', 'Hati nadhifu: Sentensi', 'The learner should be able to panga maneno vizuri wakati wa kuandika sentensi'),
  ('Kuandika', 'Hati Nadhifu Herufi kubwa', 'The learner should be able to andika herufi kubwa kwa umbo sahihi'),
  ('Kuandika', 'Hati Nadhifu Herufi kubwa', 'The learner should be able to tumia herufi kubwa mwanzoni mwa majina na sentensi'),
  ('Kuandika', 'Mpangilio wa Herufi Ndogo', 'The learner should be able to andika herufi ndogo kwa mpangilio unaofaa'),
  ('Kuandika', 'Mpangilio wa Herufi Ndogo', 'The learner should be able to unganisha herufi ndogo kuunda maneno kwa usahihi'),
  ('Kuandika', 'Nafasi katika maandishi', 'The learner should be able to acha nafasi sahihi kati ya maneno'),
  ('Kuandika', 'Nafasi katika maandishi', 'The learner should be able to panga maandishi yake kwa mpangilio mzuri kwenye ukurasa'),
  ('Kuandika', 'Uakifishi: Matumizi ya Kiulizi', 'The learner should be able to tambua sentensi ya kiulizi'),
  ('Kuandika', 'Uakifishi: Matumizi ya Kiulizi', 'The learner should be able to tumia alama ya kiulizi mwishoni mwa swali'),
  ('Kuandika', 'Tahajia: Imla', 'The learner should be able to andika maneno ya imla kwa usahihi'),
  ('Kuandika', 'Tahajia: Imla', 'The learner should be able to andika sentensi za imla bila kukosea'),
  ('Kuandika', 'Uhariri', 'The learner should be able to soma kazi yake na kutambua makosa'),
  ('Kuandika', 'Uhariri', 'The learner should be able to sahihisha makosa rahisi katika kazi yake'),
  ('Kuandika', 'Tahajia', 'The learner should be able to tahajia maneno magumu kidogo kwa usahihi'),
  ('Kuandika', 'Tahajia', 'The learner should be able to tambua herufi zinazokosekana katika neno'),
  ('Kuandika', 'Kuandika Kifungu', 'The learner should be able to andika kifungu kifupi chenye mshikamano'),
  ('Kuandika', 'Kuandika Kifungu', 'The learner should be able to panga sentensi kwa mpangilio unaofaa katika kifungu'),
  ('Kuandika', 'Maneno na Sentensi', 'The learner should be able to tunga sentensi kamili kutumia maneno aliyopewa'),
  ('Kuandika', 'Maneno na Sentensi', 'The learner should be able to tambua maneno yanayounda sentensi sahihi'),
  ('Sarufi', 'Matumizi ya wewe na nyinyi', 'The learner should be able to tumia neno wewe kumwelekeza mtu mmoja'),
  ('Sarufi', 'Matumizi ya wewe na nyinyi', 'The learner should be able to tumia neno nyinyi kuelekeza watu wengi'),
  ('Sarufi', 'Umoja na Wingi wa Vifungu', 'The learner should be able to badilisha vifungu vya maneno kutoka umoja kwenda wingi'),
  ('Sarufi', 'Umoja na Wingi wa Vifungu', 'The learner should be able to tambua umoja na wingi katika vifungu vya sentensi'),
  ('Sarufi', 'Matumizi ya Huyo na Hao', 'The learner should be able to tumia neno huyo kuelekeza mtu aliyetajwa'),
  ('Sarufi', 'Matumizi ya Huyo na Hao', 'The learner should be able to tumia neno hao kuelekeza watu waliotajwa'),
  ('Sarufi', 'Umoja na wingi wa vifungu vya maneno', 'The learner should be able to tambua vifungu vya maneno katika umoja'),
  ('Sarufi', 'Umoja na wingi wa vifungu vya maneno', 'The learner should be able to badilisha vifungu vya maneno kuwa wingi'),
  ('Sarufi', 'Matumizi ya -ako na -enu', 'The learner should be able to tumia kiambishi -ako kuonyesha umiliki wa mtu mmoja'),
  ('Sarufi', 'Matumizi ya -ako na -enu', 'The learner should be able to tumia kiambishi -enu kuonyesha umiliki wa kikundi'),
  ('Sarufi', 'Matumizi ya -refu, -kubwa, -tamu', 'The learner should be able to tumia vivumishi -refu, -kubwa na -tamu kueleza sifa za vitu'),
  ('Sarufi', 'Matumizi ya -refu, -kubwa, -tamu', 'The learner should be able to tunga sentensi akitumia vivumishi hivyo ipasavyo'),
  ('Sarufi', 'Ukanusho wa nafsi ya pili, umoja na wingi', 'The learner should be able to kanusha sentensi za nafsi ya pili umoja'),
  ('Sarufi', 'Ukanusho wa nafsi ya pili, umoja na wingi', 'The learner should be able to kanusha sentensi za nafsi ya pili wingi'),
  ('Sarufi', 'Matumizi ya huu na hii', 'The learner should be able to tumia neno huu kuelekeza nomino za kiume'),
  ('Sarufi', 'Matumizi ya huu na hii', 'The learner should be able to tumia neno hii kuelekeza nomino za kike'),
  ('Sarufi', 'Matumizi ya vizuri na vibaya, polepole na haraka', 'The learner should be able to tumia vielezi vizuri na vibaya kueleza jinsi kitendo kinavyofanyika'),
  ('Sarufi', 'Matumizi ya vizuri na vibaya, polepole na haraka', 'The learner should be able to tumia vielezi polepole na haraka katika sentensi'),
  ('Sarufi', 'Vinyume vya Vitendo', 'The learner should be able to tambua vitendo na vinyume vyake katika mazingira yake'),
  ('Sarufi', 'Vinyume vya Vitendo', 'The learner should be able to tumia vinyume vya vitendo katika sentensi fupi')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Kiswahili')
  and st.grade_id = (select id from grades where name = 'Grade 2')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id
where not exists (
  select 1 from learning_outcomes x
  where x.sub_strand_id = ss.id and x.description = v.description
);
