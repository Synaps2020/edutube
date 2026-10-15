CREATE INDEX enrollments_course_idx ON enrollments(course_id);
CREATE INDEX lesson_completions_course_idx ON lesson_completions(account_id, course_id);
