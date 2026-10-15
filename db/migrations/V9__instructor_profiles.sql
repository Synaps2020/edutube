ALTER TABLE instructors ADD COLUMN biography text NOT NULL DEFAULT '';
UPDATE instructors SET biography=CASE id
 WHEN 'instructor-1' THEN 'Professeur de mathématiques. Je vous accompagne pour comprendre les notions, construire un raisonnement et préparer vos exercices.'
 WHEN 'instructor-2' THEN 'Enseignante en sciences. Observer, expérimenter et expliquer le vivant : des activités progressives pour développer votre curiosité.'
 WHEN 'instructor-3' THEN 'Enseignante de français. Lecture, expression et écriture : des méthodes pour gagner en confiance et préciser vos idées.'
 ELSE 'Des cours et des exercices pour comprendre et pratiquer à votre rythme.' END;
