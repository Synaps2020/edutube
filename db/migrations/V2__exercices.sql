CREATE TABLE quizzes (
    id varchar(100) PRIMARY KEY,
    course_id varchar(100) NOT NULL UNIQUE REFERENCES courses(id) ON DELETE CASCADE,
    title varchar(200) NOT NULL,
    revision integer NOT NULL DEFAULT 1 CHECK (revision > 0)
);
CREATE TABLE quiz_questions (
    id varchar(100) PRIMARY KEY,
    quiz_id varchar(100) NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    position integer NOT NULL CHECK (position >= 0),
    prompt text NOT NULL,
    options jsonb NOT NULL CHECK (jsonb_typeof(options)='array' AND jsonb_array_length(options)>=2),
    correct_option_id varchar(100) NOT NULL,
    explanation text NOT NULL,
    UNIQUE(quiz_id,position)
);
CREATE TABLE quiz_attempts (
    id uuid PRIMARY KEY,
    account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    quiz_id varchar(100) NOT NULL REFERENCES quizzes(id),
    request_key varchar(200) NOT NULL,
    request_hash varchar(64) NOT NULL,
    result jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(account_id, quiz_id, request_key)
);
