-- ============================================================================
-- Checkpoint 3B: AI-generated curriculum structure (strands/sub_strands/
-- learning_outcomes) — approximate content for MVP, to be refined against
-- official KICD sources later.
-- NOT YET APPLIED — for review.
-- ============================================================================

-- ---- English / Grade 7 ----

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
join grades g on g.name = 'Grade 7';

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Listening and Speaking', 'Pronunciation and Public Speaking'),
  ('Listening and Speaking', 'Conversational Skills'),
  ('Reading', 'Intensive Reading (Comprehension)'),
  ('Reading', 'Extensive Reading (Class Readers)'),
  ('Writing', 'Composition Writing'),
  ('Writing', 'Functional Writing'),
  ('Grammar in Use', 'Parts of Speech'),
  ('Grammar in Use', 'Sentence Structure and Punctuation'),
  ('Literature in English', 'Oral Literature'),
  ('Literature in English', 'Poetry')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'English')
  and st.grade_id = (select id from grades where name = 'Grade 7');

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Listening and Speaking', 'Pronunciation and Public Speaking', 'The learner should be able to articulate sounds and words correctly in spoken English'),
  ('Listening and Speaking', 'Pronunciation and Public Speaking', 'The learner should be able to make a short speech confidently on a familiar topic'),
  ('Listening and Speaking', 'Conversational Skills', 'The learner should be able to engage in polite conversation using appropriate turn-taking'),
  ('Listening and Speaking', 'Conversational Skills', 'The learner should be able to use appropriate non-verbal cues when speaking and listening'),
  ('Reading', 'Intensive Reading (Comprehension)', 'The learner should be able to read a passage and answer comprehension questions accurately'),
  ('Reading', 'Intensive Reading (Comprehension)', 'The learner should be able to identify the main idea and supporting details in a text'),
  ('Reading', 'Extensive Reading (Class Readers)', 'The learner should be able to read a class reader and summarise its plot'),
  ('Reading', 'Extensive Reading (Class Readers)', 'The learner should be able to develop a habit of independent reading for pleasure'),
  ('Writing', 'Composition Writing', 'The learner should be able to write a well-organised composition with a clear beginning, middle and end'),
  ('Writing', 'Composition Writing', 'The learner should be able to use appropriate vocabulary and tone for a given audience'),
  ('Writing', 'Functional Writing', 'The learner should be able to write a friendly letter following the correct format'),
  ('Writing', 'Functional Writing', 'The learner should be able to write a simple notice or memo for a given purpose'),
  ('Grammar in Use', 'Parts of Speech', 'The learner should be able to identify and use the different parts of speech correctly'),
  ('Grammar in Use', 'Parts of Speech', 'The learner should be able to use nouns, pronouns and adjectives accurately in sentences'),
  ('Grammar in Use', 'Sentence Structure and Punctuation', 'The learner should be able to construct grammatically correct simple and compound sentences'),
  ('Grammar in Use', 'Sentence Structure and Punctuation', 'The learner should be able to apply correct punctuation marks in writing'),
  ('Literature in English', 'Oral Literature', 'The learner should be able to narrate an oral narrative citing its features'),
  ('Literature in English', 'Oral Literature', 'The learner should be able to appreciate the role of oral literature in society'),
  ('Literature in English', 'Poetry', 'The learner should be able to recite a poem with correct rhythm and expression'),
  ('Literature in English', 'Poetry', 'The learner should be able to identify simple poetic devices in a given poem')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'English')
  and st.grade_id = (select id from grades where name = 'Grade 7')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id;

-- ---- English / Grade 8 ----

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
join grades g on g.name = 'Grade 8';

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Listening and Speaking', 'Public Speaking and Debate'),
  ('Listening and Speaking', 'Listening Comprehension'),
  ('Reading', 'Comprehension Skills'),
  ('Reading', 'Class Reader Study'),
  ('Writing', 'Creative Writing'),
  ('Writing', 'Formal and Informal Letters'),
  ('Grammar in Use', 'Tenses and Concord'),
  ('Grammar in Use', 'Direct and Reported Speech'),
  ('Literature in English', 'Prose (Short Stories)'),
  ('Literature in English', 'Poetry Appreciation')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'English')
  and st.grade_id = (select id from grades where name = 'Grade 8');

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Listening and Speaking', 'Public Speaking and Debate', 'The learner should be able to present a persuasive argument on a given motion'),
  ('Listening and Speaking', 'Public Speaking and Debate', 'The learner should be able to listen attentively and respond appropriately during a debate'),
  ('Listening and Speaking', 'Listening Comprehension', 'The learner should be able to listen to an oral text and answer questions correctly'),
  ('Listening and Speaking', 'Listening Comprehension', 'The learner should be able to take accurate notes while listening to a talk'),
  ('Reading', 'Comprehension Skills', 'The learner should be able to infer meaning of unfamiliar words from context'),
  ('Reading', 'Comprehension Skills', 'The learner should be able to distinguish fact from opinion in a given text'),
  ('Reading', 'Class Reader Study', 'The learner should be able to analyse the characters and themes in a set text'),
  ('Reading', 'Class Reader Study', 'The learner should be able to relate the events in a class reader to real-life experiences'),
  ('Writing', 'Creative Writing', 'The learner should be able to write an imaginative story with a clear plot structure'),
  ('Writing', 'Creative Writing', 'The learner should be able to use descriptive language to bring a setting to life'),
  ('Writing', 'Formal and Informal Letters', 'The learner should be able to write a formal letter of request following the correct format'),
  ('Writing', 'Formal and Informal Letters', 'The learner should be able to write an informal letter to a friend using appropriate tone'),
  ('Grammar in Use', 'Tenses and Concord', 'The learner should be able to use the correct tense forms consistently in writing'),
  ('Grammar in Use', 'Tenses and Concord', 'The learner should be able to apply subject-verb agreement correctly in sentences'),
  ('Grammar in Use', 'Direct and Reported Speech', 'The learner should be able to convert direct speech to reported speech accurately'),
  ('Grammar in Use', 'Direct and Reported Speech', 'The learner should be able to punctuate direct speech correctly'),
  ('Literature in English', 'Prose (Short Stories)', 'The learner should be able to identify the theme and message of a short story'),
  ('Literature in English', 'Prose (Short Stories)', 'The learner should be able to describe the setting and its effect on the story'),
  ('Literature in English', 'Poetry Appreciation', 'The learner should be able to identify the mood and tone of a given poem'),
  ('Literature in English', 'Poetry Appreciation', 'The learner should be able to explain the use of figurative language in a poem')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'English')
  and st.grade_id = (select id from grades where name = 'Grade 8')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id;

-- ---- English / Grade 9 ----

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
join grades g on g.name = 'Grade 9';

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Listening and Speaking', 'Interview Skills'),
  ('Listening and Speaking', 'Group Discussions'),
  ('Reading', 'Critical Reading and Comprehension'),
  ('Reading', 'Novel Study'),
  ('Writing', 'Essay Writing (Narrative, Descriptive, Argumentative)'),
  ('Writing', 'Report Writing'),
  ('Grammar in Use', 'Clauses and Complex Sentences'),
  ('Grammar in Use', 'Figures of Speech'),
  ('Literature in English', 'Drama'),
  ('Literature in English', 'Novel Study')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'English')
  and st.grade_id = (select id from grades where name = 'Grade 9');

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Listening and Speaking', 'Interview Skills', 'The learner should be able to conduct a simple interview using well-structured questions'),
  ('Listening and Speaking', 'Interview Skills', 'The learner should be able to respond confidently to interview questions'),
  ('Listening and Speaking', 'Group Discussions', 'The learner should be able to contribute constructively to a group discussion'),
  ('Listening and Speaking', 'Group Discussions', 'The learner should be able to summarise the outcome of a group discussion'),
  ('Reading', 'Critical Reading and Comprehension', 'The learner should be able to evaluate the writer''s purpose and viewpoint in a text'),
  ('Reading', 'Critical Reading and Comprehension', 'The learner should be able to draw logical conclusions from a given passage'),
  ('Reading', 'Novel Study', 'The learner should be able to analyse the plot, characters and themes of a novel'),
  ('Reading', 'Novel Study', 'The learner should be able to discuss the relevance of a novel''s themes to society today'),
  ('Writing', 'Essay Writing (Narrative, Descriptive, Argumentative)', 'The learner should be able to write a well-structured argumentative essay defending a position'),
  ('Writing', 'Essay Writing (Narrative, Descriptive, Argumentative)', 'The learner should be able to write a descriptive essay using vivid sensory detail'),
  ('Writing', 'Report Writing', 'The learner should be able to write a factual report following the correct structure'),
  ('Writing', 'Report Writing', 'The learner should be able to present information in a report clearly and objectively'),
  ('Grammar in Use', 'Clauses and Complex Sentences', 'The learner should be able to construct complex sentences using subordinate clauses'),
  ('Grammar in Use', 'Clauses and Complex Sentences', 'The learner should be able to identify and correct sentence fragments and run-ons'),
  ('Grammar in Use', 'Figures of Speech', 'The learner should be able to identify figures of speech such as simile, metaphor and personification'),
  ('Grammar in Use', 'Figures of Speech', 'The learner should be able to use figurative language appropriately in own writing'),
  ('Literature in English', 'Drama', 'The learner should be able to analyse the characters and conflict in a play'),
  ('Literature in English', 'Drama', 'The learner should be able to perform a scripted scene expressively'),
  ('Literature in English', 'Novel Study', 'The learner should be able to evaluate the author''s style and its effect on the reader'),
  ('Literature in English', 'Novel Study', 'The learner should be able to compare themes across two different literary texts')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'English')
  and st.grade_id = (select id from grades where name = 'Grade 9')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id;

-- ---- Kiswahili / Grade 7 ----

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
join grades g on g.name = 'Grade 7';

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Kusikiliza na Kuzungumza', 'Matamshi Bora'),
  ('Kusikiliza na Kuzungumza', 'Mazungumzo'),
  ('Kusoma', 'Ufahamu'),
  ('Kusoma', 'Usomaji wa Ziada'),
  ('Kuandika', 'Insha'),
  ('Kuandika', 'Uandishi wa Kiutendaji'),
  ('Sarufi na Matumizi ya Lugha', 'Aina za Maneno'),
  ('Sarufi na Matumizi ya Lugha', 'Muundo wa Sentensi'),
  ('Fasihi', 'Fasihi Simulizi'),
  ('Fasihi', 'Ushairi')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Kiswahili')
  and st.grade_id = (select id from grades where name = 'Grade 7');

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Kusikiliza na Kuzungumza', 'Matamshi Bora', 'The learner should be able to tamka sauti na maneno ya Kiswahili kwa usahihi'),
  ('Kusikiliza na Kuzungumza', 'Matamshi Bora', 'The learner should be able to zungumza kwa ujasiri mbele ya hadhira kuhusu mada anayoifahamu'),
  ('Kusikiliza na Kuzungumza', 'Mazungumzo', 'The learner should be able to shiriki mazungumzo kwa adabu na kwa zamu'),
  ('Kusikiliza na Kuzungumza', 'Mazungumzo', 'The learner should be able to tumia ishara sahihi za mwili wakati wa mazungumzo'),
  ('Kusoma', 'Ufahamu', 'The learner should be able to soma kifungu na kujibu maswali ya ufahamu kwa usahihi'),
  ('Kusoma', 'Ufahamu', 'The learner should be able to tambua wazo kuu na vipengele vinavyoliunga mkono katika kifungu'),
  ('Kusoma', 'Usomaji wa Ziada', 'The learner should be able to soma kitabu cha ziada na kufupisha visa vyake'),
  ('Kusoma', 'Usomaji wa Ziada', 'The learner should be able to sitawisha tabia ya kusoma kwa starehe'),
  ('Kuandika', 'Insha', 'The learner should be able to andika insha yenye mpangilio mzuri wa mawazo'),
  ('Kuandika', 'Insha', 'The learner should be able to tumia msamiati na mtindo unaofaa kulingana na hadhira'),
  ('Kuandika', 'Uandishi wa Kiutendaji', 'The learner should be able to andika barua pepe rasmi kwa kufuata muundo unaofaa'),
  ('Kuandika', 'Uandishi wa Kiutendaji', 'The learner should be able to andika tangazo fupi kulingana na madhumuni'),
  ('Sarufi na Matumizi ya Lugha', 'Aina za Maneno', 'The learner should be able to tambua na kutumia aina mbalimbali za maneno kwa usahihi'),
  ('Sarufi na Matumizi ya Lugha', 'Aina za Maneno', 'The learner should be able to tumia nomino na vivumishi ipasavyo katika sentensi'),
  ('Sarufi na Matumizi ya Lugha', 'Muundo wa Sentensi', 'The learner should be able to tunga sentensi sahili na ambatano kwa usahihi'),
  ('Sarufi na Matumizi ya Lugha', 'Muundo wa Sentensi', 'The learner should be able to tumia alama za uakifishaji ipasavyo'),
  ('Fasihi', 'Fasihi Simulizi', 'The learner should be able to simulia hadithi ya kimapokeo akitaja sifa zake'),
  ('Fasihi', 'Fasihi Simulizi', 'The learner should be able to athamini nafasi ya fasihi simulizi katika jamii'),
  ('Fasihi', 'Ushairi', 'The learner should be able to ghani shairi kwa mahadhi na hisia zinazofaa'),
  ('Fasihi', 'Ushairi', 'The learner should be able to tambua vipengele sahili vya kishairi katika shairi teule')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Kiswahili')
  and st.grade_id = (select id from grades where name = 'Grade 7')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id;

-- ---- Kiswahili / Grade 8 ----

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
join grades g on g.name = 'Grade 8';

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Kusikiliza na Kuzungumza', 'Hotuba'),
  ('Kusikiliza na Kuzungumza', 'Midahalo'),
  ('Kusoma', 'Ufahamu wa Kina'),
  ('Kusoma', 'Riwaya Teule'),
  ('Kuandika', 'Insha za Kiubunifu'),
  ('Kuandika', 'Barua Rasmi na Zisizo Rasmi'),
  ('Sarufi na Matumizi ya Lugha', 'Nyakati na Hali'),
  ('Sarufi na Matumizi ya Lugha', 'Msemo wa Moja kwa Moja na Taarifa'),
  ('Fasihi', 'Hadithi Fupi'),
  ('Fasihi', 'Ushairi')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Kiswahili')
  and st.grade_id = (select id from grades where name = 'Grade 8');

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Kusikiliza na Kuzungumza', 'Hotuba', 'The learner should be able to toa hoja za kuridhisha kuhusu mada aliyopewa'),
  ('Kusikiliza na Kuzungumza', 'Hotuba', 'The learner should be able to sikiliza kwa makini na kujibu maswali baada ya hotuba'),
  ('Kusikiliza na Kuzungumza', 'Midahalo', 'The learner should be able to shiriki kikamilifu katika mdahalo akitetea msimamo wake'),
  ('Kusikiliza na Kuzungumza', 'Midahalo', 'The learner should be able to andika maelezo muhimu wakati wa kusikiliza majadiliano'),
  ('Kusoma', 'Ufahamu wa Kina', 'The learner should be able to elewa maana ya maneno magumu kwa kutumia muktadha'),
  ('Kusoma', 'Ufahamu wa Kina', 'The learner should be able to tofautisha kati ya ukweli na maoni katika kifungu'),
  ('Kusoma', 'Riwaya Teule', 'The learner should be able to changanua wahusika na maudhui katika riwaya teule'),
  ('Kusoma', 'Riwaya Teule', 'The learner should be able to husisha matukio ya riwaya na maisha halisi'),
  ('Kuandika', 'Insha za Kiubunifu', 'The learner should be able to andika hadithi ya kubuni yenye muundo dhahiri'),
  ('Kuandika', 'Insha za Kiubunifu', 'The learner should be able to tumia lugha ya kuvutia kuelezea mandhari'),
  ('Kuandika', 'Barua Rasmi na Zisizo Rasmi', 'The learner should be able to andika barua rasmi ya kuomba huduma kwa muundo sahihi'),
  ('Kuandika', 'Barua Rasmi na Zisizo Rasmi', 'The learner should be able to andika barua isiyo rasmi kwa rafiki kwa mtindo unaofaa'),
  ('Sarufi na Matumizi ya Lugha', 'Nyakati na Hali', 'The learner should be able to tumia nyakati mbalimbali kwa usahihi katika uandishi'),
  ('Sarufi na Matumizi ya Lugha', 'Nyakati na Hali', 'The learner should be able to onyesha upatanisho wa kisarufi kati ya kiima na kiarifu'),
  ('Sarufi na Matumizi ya Lugha', 'Msemo wa Moja kwa Moja na Taarifa', 'The learner should be able to geuza msemo wa moja kwa moja kuwa msemo wa taarifa'),
  ('Sarufi na Matumizi ya Lugha', 'Msemo wa Moja kwa Moja na Taarifa', 'The learner should be able to tumia alama za uakifishaji katika msemo wa moja kwa moja'),
  ('Fasihi', 'Hadithi Fupi', 'The learner should be able to tambua maudhui na ujumbe wa hadithi fupi'),
  ('Fasihi', 'Hadithi Fupi', 'The learner should be able to eleza mandhari na athari yake katika hadithi'),
  ('Fasihi', 'Ushairi', 'The learner should be able to tambua hali na toni ya shairi teule'),
  ('Fasihi', 'Ushairi', 'The learner should be able to eleza matumizi ya tamathali za semi katika shairi')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Kiswahili')
  and st.grade_id = (select id from grades where name = 'Grade 8')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id;

-- ---- Kiswahili / Grade 9 ----

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
join grades g on g.name = 'Grade 9';

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Kusikiliza na Kuzungumza', 'Mahojiano'),
  ('Kusikiliza na Kuzungumza', 'Majadiliano ya Kikundi'),
  ('Kusoma', 'Ufahamu wa Uchambuzi'),
  ('Kusoma', 'Riwaya'),
  ('Kuandika', 'Insha za Hoja'),
  ('Kuandika', 'Ripoti'),
  ('Sarufi na Matumizi ya Lugha', 'Vishazi na Sentensi Changamano'),
  ('Sarufi na Matumizi ya Lugha', 'Tamathali za Semi'),
  ('Fasihi', 'Tamthilia'),
  ('Fasihi', 'Riwaya')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Kiswahili')
  and st.grade_id = (select id from grades where name = 'Grade 9');

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Kusikiliza na Kuzungumza', 'Mahojiano', 'The learner should be able to fanya mahojiano sahili kwa kutumia maswali yaliyopangwa vyema'),
  ('Kusikiliza na Kuzungumza', 'Mahojiano', 'The learner should be able to jibu maswali ya mahojiano kwa ujasiri'),
  ('Kusikiliza na Kuzungumza', 'Majadiliano ya Kikundi', 'The learner should be able to changia kwa ufanisi katika majadiliano ya kikundi'),
  ('Kusikiliza na Kuzungumza', 'Majadiliano ya Kikundi', 'The learner should be able to fupisha matokeo ya majadiliano ya kikundi'),
  ('Kusoma', 'Ufahamu wa Uchambuzi', 'The learner should be able to tathmini lengo na mtazamo wa mwandishi katika kifungu'),
  ('Kusoma', 'Ufahamu wa Uchambuzi', 'The learner should be able to toa hitimisho la kimantiki kutokana na kifungu'),
  ('Kusoma', 'Riwaya', 'The learner should be able to changanua njama, wahusika na maudhui ya riwaya'),
  ('Kusoma', 'Riwaya', 'The learner should be able to jadili uhusiano wa maudhui ya riwaya na jamii ya sasa'),
  ('Kuandika', 'Insha za Hoja', 'The learner should be able to andika insha ya kuhoji akitetea msimamo wake kwa mantiki'),
  ('Kuandika', 'Insha za Hoja', 'The learner should be able to andika insha ya maelezo kwa kutumia lugha ya taswira'),
  ('Kuandika', 'Ripoti', 'The learner should be able to andika ripoti sahihi kwa kufuata muundo unaofaa'),
  ('Kuandika', 'Ripoti', 'The learner should be able to wasilisha habari katika ripoti kwa uwazi na uhalisia'),
  ('Sarufi na Matumizi ya Lugha', 'Vishazi na Sentensi Changamano', 'The learner should be able to tunga sentensi changamano kwa kutumia vishazi tegemezi'),
  ('Sarufi na Matumizi ya Lugha', 'Vishazi na Sentensi Changamano', 'The learner should be able to tambua na kurekebisha sentensi butu'),
  ('Sarufi na Matumizi ya Lugha', 'Tamathali za Semi', 'The learner should be able to tambua tamathali za semi kama sitiari na tashbihi'),
  ('Sarufi na Matumizi ya Lugha', 'Tamathali za Semi', 'The learner should be able to tumia tamathali za semi ipasavyo katika uandishi'),
  ('Fasihi', 'Tamthilia', 'The learner should be able to changanua wahusika na mgogoro katika tamthilia'),
  ('Fasihi', 'Tamthilia', 'The learner should be able to igiza tukio la tamthilia kwa hisia zinazofaa'),
  ('Fasihi', 'Riwaya', 'The learner should be able to tathmini mtindo wa mwandishi na athari yake kwa msomaji'),
  ('Fasihi', 'Riwaya', 'The learner should be able to linganisha maudhui ya kazi mbili tofauti za kifasihi')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Kiswahili')
  and st.grade_id = (select id from grades where name = 'Grade 9')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id;

-- ---- Mathematics / Grade 7 ----

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
join grades g on g.name = 'Grade 7';

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Numbers', 'Natural Numbers'),
  ('Numbers', 'Fractions, Decimals and Percentages'),
  ('Numbers', 'Squares and Square Roots'),
  ('Algebra', 'Algebraic Expressions'),
  ('Algebra', 'Linear Equations'),
  ('Measurement', 'Length, Area and Volume'),
  ('Measurement', 'Time and Money'),
  ('Geometry', 'Angles'),
  ('Geometry', 'Geometrical Constructions'),
  ('Data Handling and Probability', 'Data Representation'),
  ('Data Handling and Probability', 'Probability')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Mathematics')
  and st.grade_id = (select id from grades where name = 'Grade 7');

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Numbers', 'Natural Numbers', 'The learner should be able to read and write natural numbers in symbols and words'),
  ('Numbers', 'Natural Numbers', 'The learner should be able to perform the four basic operations on natural numbers'),
  ('Numbers', 'Fractions, Decimals and Percentages', 'The learner should be able to perform operations on fractions and decimals'),
  ('Numbers', 'Fractions, Decimals and Percentages', 'The learner should be able to convert fractions, decimals and percentages interchangeably'),
  ('Numbers', 'Squares and Square Roots', 'The learner should be able to work out squares of whole numbers'),
  ('Numbers', 'Squares and Square Roots', 'The learner should be able to determine square roots of perfect squares'),
  ('Algebra', 'Algebraic Expressions', 'The learner should be able to form algebraic expressions from real-life situations'),
  ('Algebra', 'Algebraic Expressions', 'The learner should be able to simplify algebraic expressions by collecting like terms'),
  ('Algebra', 'Linear Equations', 'The learner should be able to form simple linear equations in one unknown'),
  ('Algebra', 'Linear Equations', 'The learner should be able to solve linear equations in one unknown'),
  ('Measurement', 'Length, Area and Volume', 'The learner should be able to convert units of length, area and volume'),
  ('Measurement', 'Length, Area and Volume', 'The learner should be able to calculate the perimeter and area of simple shapes'),
  ('Measurement', 'Time and Money', 'The learner should be able to convert between units of time'),
  ('Measurement', 'Time and Money', 'The learner should be able to perform calculations involving money in real-life contexts'),
  ('Geometry', 'Angles', 'The learner should be able to identify and measure different types of angles'),
  ('Geometry', 'Angles', 'The learner should be able to calculate angles on a straight line and at a point'),
  ('Geometry', 'Geometrical Constructions', 'The learner should be able to construct simple geometrical figures using a ruler and protractor'),
  ('Geometry', 'Geometrical Constructions', 'The learner should be able to bisect a given line segment'),
  ('Data Handling and Probability', 'Data Representation', 'The learner should be able to collect and organise data using tally marks and frequency tables'),
  ('Data Handling and Probability', 'Data Representation', 'The learner should be able to represent data using a bar graph or pictograph'),
  ('Data Handling and Probability', 'Probability', 'The learner should be able to identify events that are certain, possible or impossible'),
  ('Data Handling and Probability', 'Probability', 'The learner should be able to carry out a simple probability experiment and record results')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Mathematics')
  and st.grade_id = (select id from grades where name = 'Grade 7')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id;

-- ---- Mathematics / Grade 9 ----

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
join grades g on g.name = 'Grade 9';

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Numbers', 'Number Bases'),
  ('Numbers', 'Indices and Logarithms'),
  ('Numbers', 'Rational and Irrational Numbers'),
  ('Algebra', 'Quadratic Expressions and Equations'),
  ('Algebra', 'Linear Inequalities'),
  ('Measurement', 'Trigonometry'),
  ('Measurement', 'Volume and Surface Area'),
  ('Geometry', 'Similarity and Enlargement'),
  ('Geometry', 'Vectors'),
  ('Data Handling and Probability', 'Statistics'),
  ('Data Handling and Probability', 'Probability')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Mathematics')
  and st.grade_id = (select id from grades where name = 'Grade 9');

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Numbers', 'Number Bases', 'The learner should be able to convert numbers from base ten to other bases and vice versa'),
  ('Numbers', 'Number Bases', 'The learner should be able to perform basic operations on numbers in different bases'),
  ('Numbers', 'Indices and Logarithms', 'The learner should be able to apply the laws of indices to simplify expressions'),
  ('Numbers', 'Indices and Logarithms', 'The learner should be able to use logarithm tables to perform calculations'),
  ('Numbers', 'Rational and Irrational Numbers', 'The learner should be able to distinguish between rational and irrational numbers'),
  ('Numbers', 'Rational and Irrational Numbers', 'The learner should be able to simplify expressions involving surds'),
  ('Algebra', 'Quadratic Expressions and Equations', 'The learner should be able to factorise quadratic expressions'),
  ('Algebra', 'Quadratic Expressions and Equations', 'The learner should be able to solve quadratic equations by factorisation'),
  ('Algebra', 'Linear Inequalities', 'The learner should be able to form and solve linear inequalities in one unknown'),
  ('Algebra', 'Linear Inequalities', 'The learner should be able to represent solutions of linear inequalities on a number line'),
  ('Measurement', 'Trigonometry', 'The learner should be able to define sine, cosine and tangent of an angle'),
  ('Measurement', 'Trigonometry', 'The learner should be able to apply trigonometric ratios to solve right-angled triangle problems'),
  ('Measurement', 'Volume and Surface Area', 'The learner should be able to calculate the volume of prisms, cylinders and pyramids'),
  ('Measurement', 'Volume and Surface Area', 'The learner should be able to calculate the surface area of common solids'),
  ('Geometry', 'Similarity and Enlargement', 'The learner should be able to identify similar figures and their properties'),
  ('Geometry', 'Similarity and Enlargement', 'The learner should be able to construct an enlargement of a given figure using a scale factor'),
  ('Geometry', 'Vectors', 'The learner should be able to represent a vector in column and coordinate form'),
  ('Geometry', 'Vectors', 'The learner should be able to add and subtract vectors geometrically and algebraically'),
  ('Data Handling and Probability', 'Statistics', 'The learner should be able to calculate the mean, median and mode of grouped data'),
  ('Data Handling and Probability', 'Statistics', 'The learner should be able to draw and interpret a cumulative frequency curve'),
  ('Data Handling and Probability', 'Probability', 'The learner should be able to calculate the probability of combined events'),
  ('Data Handling and Probability', 'Probability', 'The learner should be able to distinguish between independent and dependent events')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Mathematics')
  and st.grade_id = (select id from grades where name = 'Grade 9')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id;

-- ---- Integrated Science / Grade 7 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Living Things and Their Environment'),
  ('Mixtures, Elements and Compounds'),
  ('Force and Energy'),
  ('Human Body Systems')
) as v(name)
join subjects s on s.name = 'Integrated Science'
join grades g on g.name = 'Grade 7';

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Living Things and Their Environment', 'Classification of Living Things'),
  ('Living Things and Their Environment', 'Ecosystems'),
  ('Mixtures, Elements and Compounds', 'Simple Classification of Substances'),
  ('Mixtures, Elements and Compounds', 'Acids, Bases and Salts'),
  ('Force and Energy', 'Forms of Energy'),
  ('Force and Energy', 'Simple Machines'),
  ('Human Body Systems', 'Nutrition'),
  ('Human Body Systems', 'Reproductive Health')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Integrated Science')
  and st.grade_id = (select id from grades where name = 'Grade 7');

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Living Things and Their Environment', 'Classification of Living Things', 'The learner should be able to classify living things into major groups based on observable features'),
  ('Living Things and Their Environment', 'Classification of Living Things', 'The learner should be able to explain the importance of classification in science'),
  ('Living Things and Their Environment', 'Ecosystems', 'The learner should be able to describe the components of an ecosystem'),
  ('Living Things and Their Environment', 'Ecosystems', 'The learner should be able to explain the interdependence between living and non-living things'),
  ('Mixtures, Elements and Compounds', 'Simple Classification of Substances', 'The learner should be able to classify substances as elements, compounds or mixtures'),
  ('Mixtures, Elements and Compounds', 'Simple Classification of Substances', 'The learner should be able to identify properties used to classify matter'),
  ('Mixtures, Elements and Compounds', 'Acids, Bases and Salts', 'The learner should be able to identify common acids and bases in the environment'),
  ('Mixtures, Elements and Compounds', 'Acids, Bases and Salts', 'The learner should be able to test substances using litmus paper to classify them'),
  ('Force and Energy', 'Forms of Energy', 'The learner should be able to identify different forms of energy and their sources'),
  ('Force and Energy', 'Forms of Energy', 'The learner should be able to explain energy transformation in everyday devices'),
  ('Force and Energy', 'Simple Machines', 'The learner should be able to identify types of simple machines and their uses'),
  ('Force and Energy', 'Simple Machines', 'The learner should be able to explain how simple machines make work easier'),
  ('Human Body Systems', 'Nutrition', 'The learner should be able to classify foods according to their nutrient content'),
  ('Human Body Systems', 'Nutrition', 'The learner should be able to explain the importance of a balanced diet'),
  ('Human Body Systems', 'Reproductive Health', 'The learner should be able to describe the changes that occur during adolescence'),
  ('Human Body Systems', 'Reproductive Health', 'The learner should be able to explain the importance of personal hygiene during adolescence')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Integrated Science')
  and st.grade_id = (select id from grades where name = 'Grade 7')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id;

-- ---- Integrated Science / Grade 8 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Living Things and Their Environment'),
  ('Mixtures, Elements and Compounds'),
  ('Force and Energy'),
  ('Human Body Systems')
) as v(name)
join subjects s on s.name = 'Integrated Science'
join grades g on g.name = 'Grade 8';

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Living Things and Their Environment', 'Micro-organisms'),
  ('Living Things and Their Environment', 'Conservation of Environment'),
  ('Mixtures, Elements and Compounds', 'Separation Techniques'),
  ('Mixtures, Elements and Compounds', 'Elements, Compounds and Mixtures'),
  ('Force and Energy', 'Magnetism and Electricity'),
  ('Force and Energy', 'Sound and Light'),
  ('Human Body Systems', 'Circulatory System'),
  ('Human Body Systems', 'Respiratory System')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Integrated Science')
  and st.grade_id = (select id from grades where name = 'Grade 8');

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Living Things and Their Environment', 'Micro-organisms', 'The learner should be able to identify common micro-organisms and their characteristics'),
  ('Living Things and Their Environment', 'Micro-organisms', 'The learner should be able to explain the beneficial and harmful effects of micro-organisms'),
  ('Living Things and Their Environment', 'Conservation of Environment', 'The learner should be able to identify human activities that degrade the environment'),
  ('Living Things and Their Environment', 'Conservation of Environment', 'The learner should be able to explain measures for conserving the environment'),
  ('Mixtures, Elements and Compounds', 'Separation Techniques', 'The learner should be able to select an appropriate method to separate a given mixture'),
  ('Mixtures, Elements and Compounds', 'Separation Techniques', 'The learner should be able to carry out simple separation techniques such as filtration and evaporation'),
  ('Mixtures, Elements and Compounds', 'Elements, Compounds and Mixtures', 'The learner should be able to distinguish between elements, compounds and mixtures using examples'),
  ('Mixtures, Elements and Compounds', 'Elements, Compounds and Mixtures', 'The learner should be able to represent simple compounds using chemical symbols'),
  ('Force and Energy', 'Magnetism and Electricity', 'The learner should be able to demonstrate properties of magnets through simple experiments'),
  ('Force and Energy', 'Magnetism and Electricity', 'The learner should be able to construct a simple electric circuit'),
  ('Force and Energy', 'Sound and Light', 'The learner should be able to explain how sound is produced and transmitted'),
  ('Force and Energy', 'Sound and Light', 'The learner should be able to describe the properties of light including reflection'),
  ('Human Body Systems', 'Circulatory System', 'The learner should be able to describe the structure and function of the heart'),
  ('Human Body Systems', 'Circulatory System', 'The learner should be able to explain the importance of blood circulation in the body'),
  ('Human Body Systems', 'Respiratory System', 'The learner should be able to describe the structure and function of the respiratory system'),
  ('Human Body Systems', 'Respiratory System', 'The learner should be able to explain the process of gaseous exchange')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Integrated Science')
  and st.grade_id = (select id from grades where name = 'Grade 8')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id;

-- ---- Integrated Science / Grade 9 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Living Things and Their Environment'),
  ('Mixtures, Elements and Compounds'),
  ('Force and Energy'),
  ('Human Body Systems')
) as v(name)
join subjects s on s.name = 'Integrated Science'
join grades g on g.name = 'Grade 9';

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Living Things and Their Environment', 'Genetics and Heredity'),
  ('Living Things and Their Environment', 'Ecosystem Interactions'),
  ('Mixtures, Elements and Compounds', 'Periodic Table'),
  ('Mixtures, Elements and Compounds', 'Chemical Reactions'),
  ('Force and Energy', 'Electricity and Circuits'),
  ('Force and Energy', 'Work, Energy and Power'),
  ('Human Body Systems', 'Nervous System'),
  ('Human Body Systems', 'Excretory System')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Integrated Science')
  and st.grade_id = (select id from grades where name = 'Grade 9');

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Living Things and Their Environment', 'Genetics and Heredity', 'The learner should be able to explain basic concepts of inheritance of traits'),
  ('Living Things and Their Environment', 'Genetics and Heredity', 'The learner should be able to distinguish between dominant and recessive traits using simple examples'),
  ('Living Things and Their Environment', 'Ecosystem Interactions', 'The learner should be able to describe energy flow in an ecosystem using food chains and food webs'),
  ('Living Things and Their Environment', 'Ecosystem Interactions', 'The learner should be able to explain the effects of human activity on ecosystem balance'),
  ('Mixtures, Elements and Compounds', 'Periodic Table', 'The learner should be able to describe the arrangement of elements in the periodic table'),
  ('Mixtures, Elements and Compounds', 'Periodic Table', 'The learner should be able to relate the position of an element to its properties'),
  ('Mixtures, Elements and Compounds', 'Chemical Reactions', 'The learner should be able to describe types of chemical reactions with examples'),
  ('Mixtures, Elements and Compounds', 'Chemical Reactions', 'The learner should be able to write simple word equations for chemical reactions'),
  ('Force and Energy', 'Electricity and Circuits', 'The learner should be able to distinguish between series and parallel circuits'),
  ('Force and Energy', 'Electricity and Circuits', 'The learner should be able to calculate simple quantities using Ohm''s law'),
  ('Force and Energy', 'Work, Energy and Power', 'The learner should be able to calculate work done in simple real-life situations'),
  ('Force and Energy', 'Work, Energy and Power', 'The learner should be able to explain the relationship between work, energy and power'),
  ('Human Body Systems', 'Nervous System', 'The learner should be able to describe the structure and function of the nervous system'),
  ('Human Body Systems', 'Nervous System', 'The learner should be able to explain the role of reflex actions in protecting the body'),
  ('Human Body Systems', 'Excretory System', 'The learner should be able to describe the structure and function of the excretory system'),
  ('Human Body Systems', 'Excretory System', 'The learner should be able to explain the importance of excretion in maintaining health')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Integrated Science')
  and st.grade_id = (select id from grades where name = 'Grade 9')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id;

-- ---- Social Studies / Grade 7 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Citizenship'),
  ('Governance and Leadership'),
  ('Natural Resources'),
  ('Money and Economics')
) as v(name)
join subjects s on s.name = 'Social Studies'
join grades g on g.name = 'Grade 7';

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Citizenship', 'National Values and Principles'),
  ('Citizenship', 'Rights and Responsibilities'),
  ('Governance and Leadership', 'Levels of Government'),
  ('Governance and Leadership', 'Leadership Qualities'),
  ('Natural Resources', 'Conservation of Resources'),
  ('Natural Resources', 'Environmental Sustainability'),
  ('Money and Economics', 'Sources of Income'),
  ('Money and Economics', 'Saving and Budgeting')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Social Studies')
  and st.grade_id = (select id from grades where name = 'Grade 7');

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Citizenship', 'National Values and Principles', 'The learner should be able to explain the national values and principles of governance'),
  ('Citizenship', 'National Values and Principles', 'The learner should be able to demonstrate patriotism through responsible actions'),
  ('Citizenship', 'Rights and Responsibilities', 'The learner should be able to identify the rights and responsibilities of a citizen'),
  ('Citizenship', 'Rights and Responsibilities', 'The learner should be able to explain the importance of respecting the rights of others'),
  ('Governance and Leadership', 'Levels of Government', 'The learner should be able to describe the levels and structure of government in Kenya'),
  ('Governance and Leadership', 'Levels of Government', 'The learner should be able to explain the functions of the different levels of government'),
  ('Governance and Leadership', 'Leadership Qualities', 'The learner should be able to identify qualities of a good leader'),
  ('Governance and Leadership', 'Leadership Qualities', 'The learner should be able to demonstrate leadership skills in a group activity'),
  ('Natural Resources', 'Conservation of Resources', 'The learner should be able to identify the natural resources found in Kenya'),
  ('Natural Resources', 'Conservation of Resources', 'The learner should be able to explain ways of conserving natural resources'),
  ('Natural Resources', 'Environmental Sustainability', 'The learner should be able to explain the causes and effects of environmental degradation'),
  ('Natural Resources', 'Environmental Sustainability', 'The learner should be able to propose ways of promoting environmental sustainability'),
  ('Money and Economics', 'Sources of Income', 'The learner should be able to identify different sources of income available to individuals'),
  ('Money and Economics', 'Sources of Income', 'The learner should be able to explain the importance of earning an honest income'),
  ('Money and Economics', 'Saving and Budgeting', 'The learner should be able to prepare a simple personal budget'),
  ('Money and Economics', 'Saving and Budgeting', 'The learner should be able to explain the importance of saving money')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Social Studies')
  and st.grade_id = (select id from grades where name = 'Grade 7')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id;

-- ---- Social Studies / Grade 8 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Citizenship'),
  ('Governance and Leadership'),
  ('Natural Resources'),
  ('Money and Economics')
) as v(name)
join subjects s on s.name = 'Social Studies'
join grades g on g.name = 'Grade 8';

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Citizenship', 'National Cohesion and Integration'),
  ('Citizenship', 'Human Rights'),
  ('Governance and Leadership', 'Devolution'),
  ('Governance and Leadership', 'Democratic Processes'),
  ('Natural Resources', 'Sustainable Resource Use'),
  ('Natural Resources', 'Climate Change'),
  ('Money and Economics', 'Banking and Financial Services'),
  ('Money and Economics', 'Entrepreneurship')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Social Studies')
  and st.grade_id = (select id from grades where name = 'Grade 8');

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Citizenship', 'National Cohesion and Integration', 'The learner should be able to explain the importance of national cohesion and integration'),
  ('Citizenship', 'National Cohesion and Integration', 'The learner should be able to identify factors that promote unity among Kenyan communities'),
  ('Citizenship', 'Human Rights', 'The learner should be able to explain the basic human rights guaranteed in the Constitution'),
  ('Citizenship', 'Human Rights', 'The learner should be able to describe ways of protecting human rights in society'),
  ('Governance and Leadership', 'Devolution', 'The learner should be able to explain the concept and structure of devolved government'),
  ('Governance and Leadership', 'Devolution', 'The learner should be able to describe the functions of county governments'),
  ('Governance and Leadership', 'Democratic Processes', 'The learner should be able to explain the electoral process in Kenya'),
  ('Governance and Leadership', 'Democratic Processes', 'The learner should be able to describe the role of citizens in a democracy'),
  ('Natural Resources', 'Sustainable Resource Use', 'The learner should be able to explain the concept of sustainable use of natural resources'),
  ('Natural Resources', 'Sustainable Resource Use', 'The learner should be able to evaluate the impact of over-exploitation of resources'),
  ('Natural Resources', 'Climate Change', 'The learner should be able to explain the causes and effects of climate change'),
  ('Natural Resources', 'Climate Change', 'The learner should be able to describe measures for mitigating climate change'),
  ('Money and Economics', 'Banking and Financial Services', 'The learner should be able to describe the services offered by banks and financial institutions'),
  ('Money and Economics', 'Banking and Financial Services', 'The learner should be able to explain the importance of financial institutions to the economy'),
  ('Money and Economics', 'Entrepreneurship', 'The learner should be able to identify qualities of a successful entrepreneur'),
  ('Money and Economics', 'Entrepreneurship', 'The learner should be able to describe the steps involved in starting a small business')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Social Studies')
  and st.grade_id = (select id from grades where name = 'Grade 8')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id;

-- ---- Social Studies / Grade 9 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Citizenship'),
  ('Governance and Leadership'),
  ('Natural Resources'),
  ('Money and Economics')
) as v(name)
join subjects s on s.name = 'Social Studies'
join grades g on g.name = 'Grade 9';

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Citizenship', 'Constitutionalism'),
  ('Citizenship', 'Civic Responsibility'),
  ('Governance and Leadership', 'Public Participation'),
  ('Governance and Leadership', 'Regional and International Organisations'),
  ('Natural Resources', 'Resource-based Conflicts'),
  ('Natural Resources', 'Environmental Management'),
  ('Money and Economics', 'Trade and Commerce'),
  ('Money and Economics', 'Personal Financial Management')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Social Studies')
  and st.grade_id = (select id from grades where name = 'Grade 9');

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Citizenship', 'Constitutionalism', 'The learner should be able to explain the importance of constitutionalism in governance'),
  ('Citizenship', 'Constitutionalism', 'The learner should be able to describe the process of amending the Constitution'),
  ('Citizenship', 'Civic Responsibility', 'The learner should be able to explain the responsibilities of citizens in nation-building'),
  ('Citizenship', 'Civic Responsibility', 'The learner should be able to participate in activities that promote civic responsibility'),
  ('Governance and Leadership', 'Public Participation', 'The learner should be able to explain the importance of public participation in governance'),
  ('Governance and Leadership', 'Public Participation', 'The learner should be able to describe avenues for public participation in decision-making'),
  ('Governance and Leadership', 'Regional and International Organisations', 'The learner should be able to identify regional and international organisations that Kenya belongs to'),
  ('Governance and Leadership', 'Regional and International Organisations', 'The learner should be able to explain the benefits of Kenya''s membership in these organisations'),
  ('Natural Resources', 'Resource-based Conflicts', 'The learner should be able to explain the causes of resource-based conflicts'),
  ('Natural Resources', 'Resource-based Conflicts', 'The learner should be able to describe ways of resolving resource-based conflicts'),
  ('Natural Resources', 'Environmental Management', 'The learner should be able to explain strategies for effective environmental management'),
  ('Natural Resources', 'Environmental Management', 'The learner should be able to evaluate the role of communities in environmental management'),
  ('Money and Economics', 'Trade and Commerce', 'The learner should be able to explain the importance of trade to the economy'),
  ('Money and Economics', 'Trade and Commerce', 'The learner should be able to distinguish between local and international trade'),
  ('Money and Economics', 'Personal Financial Management', 'The learner should be able to prepare a personal financial plan'),
  ('Money and Economics', 'Personal Financial Management', 'The learner should be able to explain the importance of prudent financial management')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Social Studies')
  and st.grade_id = (select id from grades where name = 'Grade 9')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id;

-- ---- Christian Religious Education / Grade 7 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('The Bible'),
  ('Christian Values'),
  ('Christian Living'),
  ('The Church')
) as v(name)
join subjects s on s.name = 'Christian Religious Education'
join grades g on g.name = 'Grade 7';

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('The Bible', 'Composition of the Bible'),
  ('The Bible', 'Creation Stories'),
  ('Christian Values', 'Love and Forgiveness'),
  ('Christian Values', 'Honesty and Integrity'),
  ('Christian Living', 'Prayer'),
  ('Christian Living', 'Relationships (Family and Friends)'),
  ('The Church', 'Role of the Church'),
  ('The Church', 'Christian Worship')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Christian Religious Education')
  and st.grade_id = (select id from grades where name = 'Grade 7');

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('The Bible', 'Composition of the Bible', 'The learner should be able to describe how the Bible is organised into the Old and New Testaments'),
  ('The Bible', 'Composition of the Bible', 'The learner should be able to explain the importance of the Bible to Christians'),
  ('The Bible', 'Creation Stories', 'The learner should be able to narrate the biblical accounts of creation'),
  ('The Bible', 'Creation Stories', 'The learner should be able to explain the lessons learnt from the creation stories'),
  ('Christian Values', 'Love and Forgiveness', 'The learner should be able to explain the Christian teaching on love and forgiveness'),
  ('Christian Values', 'Love and Forgiveness', 'The learner should be able to demonstrate love and forgiveness in day-to-day life'),
  ('Christian Values', 'Honesty and Integrity', 'The learner should be able to explain the importance of honesty and integrity in society'),
  ('Christian Values', 'Honesty and Integrity', 'The learner should be able to identify biblical examples that teach honesty'),
  ('Christian Living', 'Prayer', 'The learner should be able to explain the significance of prayer in a Christian''s life'),
  ('Christian Living', 'Prayer', 'The learner should be able to practise different forms of prayer'),
  ('Christian Living', 'Relationships (Family and Friends)', 'The learner should be able to explain the Christian teaching on family relationships'),
  ('Christian Living', 'Relationships (Family and Friends)', 'The learner should be able to demonstrate respect and responsibility within the family'),
  ('The Church', 'Role of the Church', 'The learner should be able to explain the role of the Church in society'),
  ('The Church', 'Role of the Church', 'The learner should be able to describe ways the Church contributes to community development'),
  ('The Church', 'Christian Worship', 'The learner should be able to describe the different forms of Christian worship'),
  ('The Church', 'Christian Worship', 'The learner should be able to explain the importance of corporate worship')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Christian Religious Education')
  and st.grade_id = (select id from grades where name = 'Grade 7')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id;

-- ---- Christian Religious Education / Grade 8 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('The Bible'),
  ('Christian Values'),
  ('Christian Living'),
  ('The Church')
) as v(name)
join subjects s on s.name = 'Christian Religious Education'
join grades g on g.name = 'Grade 8';

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('The Bible', 'The Life of Jesus Christ'),
  ('The Bible', 'Parables and Teachings of Jesus'),
  ('Christian Values', 'Justice and Peace'),
  ('Christian Values', 'Responsible Citizenship'),
  ('Christian Living', 'Temptation and Self-control'),
  ('Christian Living', 'Work and Vocation'),
  ('The Church', 'Sacraments/Ordinances'),
  ('The Church', 'Church and Society')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Christian Religious Education')
  and st.grade_id = (select id from grades where name = 'Grade 8');

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('The Bible', 'The Life of Jesus Christ', 'The learner should be able to narrate key events in the life of Jesus Christ'),
  ('The Bible', 'The Life of Jesus Christ', 'The learner should be able to explain the significance of the life of Jesus to Christians'),
  ('The Bible', 'Parables and Teachings of Jesus', 'The learner should be able to explain the meaning of selected parables of Jesus'),
  ('The Bible', 'Parables and Teachings of Jesus', 'The learner should be able to relate the teachings of Jesus to everyday life'),
  ('Christian Values', 'Justice and Peace', 'The learner should be able to explain the Christian teaching on justice and peace'),
  ('Christian Values', 'Justice and Peace', 'The learner should be able to identify ways of promoting justice and peace in society'),
  ('Christian Values', 'Responsible Citizenship', 'The learner should be able to explain the Christian view of responsible citizenship'),
  ('Christian Values', 'Responsible Citizenship', 'The learner should be able to demonstrate responsible behaviour as a citizen'),
  ('Christian Living', 'Temptation and Self-control', 'The learner should be able to explain the Christian teaching on temptation and self-control'),
  ('Christian Living', 'Temptation and Self-control', 'The learner should be able to identify strategies for overcoming temptation'),
  ('Christian Living', 'Work and Vocation', 'The learner should be able to explain the Christian understanding of work and vocation'),
  ('Christian Living', 'Work and Vocation', 'The learner should be able to demonstrate a positive attitude towards work'),
  ('The Church', 'Sacraments/Ordinances', 'The learner should be able to describe the meaning of key Christian sacraments/ordinances'),
  ('The Church', 'Sacraments/Ordinances', 'The learner should be able to explain the significance of sacraments/ordinances in Christian life'),
  ('The Church', 'Church and Society', 'The learner should be able to explain the role of the Church in addressing social issues'),
  ('The Church', 'Church and Society', 'The learner should be able to describe ways Christians can engage with society responsibly')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Christian Religious Education')
  and st.grade_id = (select id from grades where name = 'Grade 8')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id;

-- ---- Christian Religious Education / Grade 9 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('The Bible'),
  ('Christian Values'),
  ('Christian Living'),
  ('The Church')
) as v(name)
join subjects s on s.name = 'Christian Religious Education'
join grades g on g.name = 'Grade 9';

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('The Bible', 'The Early Church (Acts)'),
  ('The Bible', 'Pauline Letters'),
  ('Christian Values', 'Human Sexuality and Christian Values'),
  ('Christian Values', 'Marriage and Family'),
  ('Christian Living', 'Handling Peer Pressure'),
  ('Christian Living', 'Christian Response to Contemporary Issues'),
  ('The Church', 'Christian Leadership'),
  ('The Church', 'Ecumenism')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Christian Religious Education')
  and st.grade_id = (select id from grades where name = 'Grade 9');

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('The Bible', 'The Early Church (Acts)', 'The learner should be able to describe the growth and spread of the early Church'),
  ('The Bible', 'The Early Church (Acts)', 'The learner should be able to explain the challenges faced by the early Church'),
  ('The Bible', 'Pauline Letters', 'The learner should be able to outline the key teachings in selected letters of Paul'),
  ('The Bible', 'Pauline Letters', 'The learner should be able to relate the teachings of Paul to Christian living today'),
  ('Christian Values', 'Human Sexuality and Christian Values', 'The learner should be able to explain the Christian teaching on human sexuality'),
  ('Christian Values', 'Human Sexuality and Christian Values', 'The learner should be able to demonstrate responsible behaviour regarding sexuality'),
  ('Christian Values', 'Marriage and Family', 'The learner should be able to explain the Christian understanding of marriage and family'),
  ('Christian Values', 'Marriage and Family', 'The learner should be able to describe the responsibilities of family members'),
  ('Christian Living', 'Handling Peer Pressure', 'The learner should be able to explain the Christian response to peer pressure'),
  ('Christian Living', 'Handling Peer Pressure', 'The learner should be able to demonstrate strategies for resisting negative peer pressure'),
  ('Christian Living', 'Christian Response to Contemporary Issues', 'The learner should be able to explain the Christian response to selected contemporary issues'),
  ('Christian Living', 'Christian Response to Contemporary Issues', 'The learner should be able to evaluate the role of the Christian in addressing societal challenges'),
  ('The Church', 'Christian Leadership', 'The learner should be able to explain qualities of good Christian leadership'),
  ('The Church', 'Christian Leadership', 'The learner should be able to identify biblical examples of Christian leadership'),
  ('The Church', 'Ecumenism', 'The learner should be able to explain the meaning and importance of ecumenism'),
  ('The Church', 'Ecumenism', 'The learner should be able to describe efforts towards Christian unity')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Christian Religious Education')
  and st.grade_id = (select id from grades where name = 'Grade 9')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id;

