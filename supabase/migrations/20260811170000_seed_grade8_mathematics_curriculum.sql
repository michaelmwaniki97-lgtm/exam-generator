-- ============================================================================
-- Checkpoint 3B: AI-generated curriculum structure (strands/sub_strands/
-- learning_outcomes) — approximate content for MVP, to be refined against
-- official KICD sources later.
-- NOT YET APPLIED — for review.
-- ============================================================================

-- ---- Mathematics / Grade 8 ----

insert into strands (subject_id, grade_id, name)
select s.id, g.id, v.name
from (values
  ('Numbers'),
  ('Algebra'),
  ('Measurements'),
  ('Geometry'),
  ('Data Handling and Probability')
) as v(name)
join subjects s on s.name = 'Mathematics'
join grades g on g.name = 'Grade 8';

insert into sub_strands (strand_id, name)
select st.id, v.sub_name
from (values
  ('Numbers', 'Integers'),
  ('Numbers', 'Fractions'),
  ('Numbers', 'Decimals'),
  ('Numbers', 'Squares and Square Roots'),
  ('Numbers', 'Rates, Ratio, Proportions and Percentages'),
  ('Algebra', 'Algebraic Expressions'),
  ('Algebra', 'Linear Equations'),
  ('Measurements', 'Circles'),
  ('Measurements', 'Area'),
  ('Measurements', 'Money'),
  ('Geometry', 'Geometrical Constructions'),
  ('Geometry', 'Coordinates and graphs'),
  ('Geometry', 'Scale Drawing'),
  ('Geometry', 'Common Solids'),
  ('Data Handling and Probability', 'Data Presentation and Interpretation'),
  ('Data Handling and Probability', 'Probability')
) as v(strand_name, sub_name)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Mathematics')
  and st.grade_id = (select id from grades where name = 'Grade 8');

insert into learning_outcomes (sub_strand_id, description)
select ss.id, v.description
from (values
  ('Numbers', 'Integers', 'The learner should be able to work out combined operations on integers using the correct order of operations'),
  ('Numbers', 'Integers', 'The learner should be able to apply integers to real-life situations such as temperature and altitude'),
  ('Numbers', 'Integers', 'The learner should be able to represent and compare integers on a number line'),
  ('Numbers', 'Fractions', 'The learner should be able to perform combined operations on fractions'),
  ('Numbers', 'Fractions', 'The learner should be able to convert fractions to decimals and percentages and vice versa'),
  ('Numbers', 'Fractions', 'The learner should be able to apply fractions to solve problems in real-life situations'),
  ('Numbers', 'Decimals', 'The learner should be able to perform the four basic operations on decimals'),
  ('Numbers', 'Decimals', 'The learner should be able to round off decimals to a required number of decimal places'),
  ('Numbers', 'Decimals', 'The learner should be able to apply decimals to solve problems in real-life situations'),
  ('Numbers', 'Squares and Square Roots', 'The learner should be able to work out squares of numbers by multiplication'),
  ('Numbers', 'Squares and Square Roots', 'The learner should be able to determine square roots of perfect squares using factorisation or division'),
  ('Numbers', 'Squares and Square Roots', 'The learner should be able to apply squares and square roots to solve real-life problems'),
  ('Numbers', 'Rates, Ratio, Proportions and Percentages', 'The learner should be able to work out rates in different real-life contexts such as speed and density'),
  ('Numbers', 'Rates, Ratio, Proportions and Percentages', 'The learner should be able to share out quantities in a given ratio'),
  ('Numbers', 'Rates, Ratio, Proportions and Percentages', 'The learner should be able to solve problems involving direct and inverse proportion'),
  ('Numbers', 'Rates, Ratio, Proportions and Percentages', 'The learner should be able to calculate percentage increase and decrease in real-life situations'),
  ('Algebra', 'Algebraic Expressions', 'The learner should be able to simplify algebraic expressions involving different operations'),
  ('Algebra', 'Algebraic Expressions', 'The learner should be able to factorise algebraic expressions'),
  ('Algebra', 'Algebraic Expressions', 'The learner should be able to substitute values into algebraic expressions to evaluate them'),
  ('Algebra', 'Linear Equations', 'The learner should be able to form linear equations in one unknown from real-life situations'),
  ('Algebra', 'Linear Equations', 'The learner should be able to solve linear equations in one unknown'),
  ('Algebra', 'Linear Equations', 'The learner should be able to apply linear equations to solve problems in real-life situations'),
  ('Measurements', 'Circles', 'The learner should be able to identify parts of a circle including radius, diameter and circumference'),
  ('Measurements', 'Circles', 'The learner should be able to calculate the circumference of a circle'),
  ('Measurements', 'Circles', 'The learner should be able to calculate the area of a circle'),
  ('Measurements', 'Circles', 'The learner should be able to apply knowledge of circles to solve real-life problems'),
  ('Measurements', 'Area', 'The learner should be able to calculate the area of a sector of a circle'),
  ('Measurements', 'Area', 'The learner should be able to calculate the area of composite shapes'),
  ('Measurements', 'Area', 'The learner should be able to apply area to solve problems in real-life situations'),
  ('Measurements', 'Money', 'The learner should be able to convert currency from one denomination to another'),
  ('Measurements', 'Money', 'The learner should be able to calculate profit and loss in business transactions'),
  ('Measurements', 'Money', 'The learner should be able to calculate simple and compound interest'),
  ('Measurements', 'Money', 'The learner should be able to prepare a simple budget applying knowledge of money'),
  ('Geometry', 'Geometrical Constructions', 'The learner should be able to construct angles using a pair of compasses and ruler'),
  ('Geometry', 'Geometrical Constructions', 'The learner should be able to construct triangles given different sets of measurements'),
  ('Geometry', 'Geometrical Constructions', 'The learner should be able to bisect lines and angles using a pair of compasses'),
  ('Geometry', 'Coordinates and graphs', 'The learner should be able to plot points on a Cartesian plane using given coordinates'),
  ('Geometry', 'Coordinates and graphs', 'The learner should be able to draw and interpret graphs of linear equations'),
  ('Geometry', 'Coordinates and graphs', 'The learner should be able to determine the gradient of a straight line'),
  ('Geometry', 'Scale Drawing', 'The learner should be able to interpret and use scale in map reading'),
  ('Geometry', 'Scale Drawing', 'The learner should be able to draw scale diagrams of given objects or regions'),
  ('Geometry', 'Scale Drawing', 'The learner should be able to determine actual distances or areas from scale drawings'),
  ('Geometry', 'Common Solids', 'The learner should be able to identify properties of common solids such as cubes, cylinders and prisms'),
  ('Geometry', 'Common Solids', 'The learner should be able to calculate the surface area of common solids'),
  ('Geometry', 'Common Solids', 'The learner should be able to calculate the volume of common solids'),
  ('Geometry', 'Common Solids', 'The learner should be able to apply knowledge of common solids to solve real-life problems'),
  ('Data Handling and Probability', 'Data Presentation and Interpretation', 'The learner should be able to collect and organise data from real-life situations'),
  ('Data Handling and Probability', 'Data Presentation and Interpretation', 'The learner should be able to represent data using tables, bar graphs, pie charts and line graphs'),
  ('Data Handling and Probability', 'Data Presentation and Interpretation', 'The learner should be able to calculate measures of central tendency (mean, median, mode) from given data'),
  ('Data Handling and Probability', 'Probability', 'The learner should be able to identify outcomes of simple experiments'),
  ('Data Handling and Probability', 'Probability', 'The learner should be able to determine the probability of single events'),
  ('Data Handling and Probability', 'Probability', 'The learner should be able to distinguish between certain, impossible and likely events')
) as v(strand_name, sub_name, description)
join strands st on st.name = v.strand_name
  and st.subject_id = (select id from subjects where name = 'Mathematics')
  and st.grade_id = (select id from grades where name = 'Grade 8')
join sub_strands ss on ss.name = v.sub_name and ss.strand_id = st.id;

