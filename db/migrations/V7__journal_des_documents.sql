ALTER TABLE course_audit ADD COLUMN details jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(details) = 'object');
