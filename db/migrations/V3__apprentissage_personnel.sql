CREATE TABLE enrollments (
    id uuid PRIMARY KEY,
    account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    course_id varchar(100) NOT NULL REFERENCES courses(id),
    enrolled_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(account_id, course_id)
);
CREATE TABLE lesson_completions (
    account_id uuid NOT NULL,
    course_id varchar(100) NOT NULL,
    lesson_id varchar(100) NOT NULL,
    completed_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(account_id, lesson_id),
    FOREIGN KEY(account_id, course_id) REFERENCES enrollments(account_id, course_id) ON DELETE CASCADE,
    FOREIGN KEY(course_id, lesson_id) REFERENCES lessons(course_id, id) ON DELETE CASCADE
);
CREATE TABLE favorites (
    account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    course_id varchar(100) NOT NULL REFERENCES courses(id),
    saved_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(account_id, course_id)
);
CREATE TABLE notes (
    id uuid PRIMARY KEY,
    account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    course_id varchar(100) NOT NULL,
    lesson_id varchar(100) NOT NULL,
    text text NOT NULL CHECK (char_length(text) <= 20000),
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(account_id, lesson_id),
    FOREIGN KEY(course_id, lesson_id) REFERENCES lessons(course_id, id)
);
CREATE TABLE learning_resume (
    account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    course_id varchar(100) NOT NULL,
    lesson_id varchar(100) NOT NULL,
    visited_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY(course_id, lesson_id) REFERENCES lessons(course_id, id)
);
CREATE TABLE learning_requests (
    account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    scope varchar(10) NOT NULL CHECK (scope IN ('COURSE', 'PATH')),
    request_key varchar(200) NOT NULL,
    target_id varchar(100) NOT NULL,
    course_ids varchar(100)[] NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(account_id, scope, request_key)
);
CREATE INDEX enrollments_library_idx ON enrollments(account_id, enrolled_at DESC, id);
CREATE INDEX notes_notebook_idx ON notes(account_id, updated_at DESC, id);
CREATE INDEX quiz_attempts_history_idx ON quiz_attempts(account_id, created_at DESC, id);
