ALTER TABLE accounts ADD COLUMN role varchar(20) NOT NULL DEFAULT 'LEARNER' CHECK (role IN ('LEARNER','TEACHER','ADMIN'));
ALTER TABLE courses ADD COLUMN owner_id uuid REFERENCES accounts(id);
CREATE INDEX courses_owner_idx ON courses(owner_id);
CREATE TABLE course_audit (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    course_id varchar(100) NOT NULL REFERENCES courses(id),
    account_id uuid NOT NULL REFERENCES accounts(id),
    action varchar(30) NOT NULL,
    revision integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
