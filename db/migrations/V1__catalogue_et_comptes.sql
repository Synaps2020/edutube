CREATE TABLE subjects (
    id varchar(100) PRIMARY KEY,
    code varchar(40) NOT NULL UNIQUE,
    name varchar(100) NOT NULL
);
CREATE TABLE instructors (
    id varchar(100) PRIMARY KEY,
    display_name varchar(100) NOT NULL,
    avatar_url text
);
CREATE TABLE courses (
    id varchar(100) PRIMARY KEY,
    slug varchar(150) NOT NULL UNIQUE,
    title varchar(200) NOT NULL,
    short_description text NOT NULL,
    description text NOT NULL,
    subject_id varchar(100) NOT NULL REFERENCES subjects(id),
    instructor_id varchar(100) NOT NULL REFERENCES instructors(id),
    school_level varchar(20) NOT NULL CHECK (school_level IN ('PRIMARY','MIDDLE','SECONDARY')),
    status varchar(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED')),
    revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
    language varchar(2) NOT NULL DEFAULT 'fr' CHECK (language IN ('fr','wo','ar','en')),
    outcomes text[] NOT NULL CHECK (cardinality(outcomes) > 0),
    prerequisites text[] NOT NULL DEFAULT '{}',
    palette varchar(10) NOT NULL CHECK (palette IN ('blue','green','orange','purple')),
    illustration varchar(20) CHECK (illustration IN ('geometry','plant','writing','code')),
    image_url text,
    featured boolean NOT NULL DEFAULT false,
    published_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (status <> 'PUBLISHED' OR published_at IS NOT NULL)
);
CREATE INDEX courses_discovery_idx ON courses(status, school_level, subject_id);
CREATE TABLE lessons (
    id varchar(100) PRIMARY KEY,
    course_id varchar(100) NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title varchar(200) NOT NULL,
    position integer NOT NULL CHECK (position >= 0),
    kind varchar(20) NOT NULL CHECK (kind IN ('VIDEO','READING','PRACTICE')),
    estimated_minutes integer NOT NULL CHECK (estimated_minutes > 0),
    preview_allowed boolean NOT NULL DEFAULT false,
    revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
    blocks jsonb NOT NULL CHECK (jsonb_typeof(blocks) = 'array'),
    UNIQUE(course_id, position),
    UNIQUE(course_id, id)
);
CREATE TABLE learning_paths (
    id varchar(100) PRIMARY KEY,
    slug varchar(150) NOT NULL UNIQUE,
    title varchar(200) NOT NULL,
    description text NOT NULL,
    goal varchar(20) NOT NULL CHECK (goal IN ('EXAM','DISCOVERY','FOUNDATIONS')),
    revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
    published boolean NOT NULL DEFAULT false,
    palette varchar(10) NOT NULL CHECK (palette IN ('blue','green','orange','purple'))
);
CREATE TABLE path_courses (
    path_id varchar(100) NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
    course_id varchar(100) NOT NULL REFERENCES courses(id),
    position integer NOT NULL CHECK (position >= 0),
    PRIMARY KEY(path_id, course_id),
    UNIQUE(path_id, position)
);
CREATE TABLE accounts (
    id uuid PRIMARY KEY,
    email varchar(254) NOT NULL UNIQUE CHECK (email = lower(email)),
    display_name varchar(100) NOT NULL,
    password_hash text NOT NULL,
    school_level varchar(20) CHECK (school_level IN ('PRIMARY','MIDDLE','SECONDARY')),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
    token_hash varchar(64) PRIMARY KEY,
    account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    csrf_token varchar(64) NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_expiration_idx ON sessions(expires_at);
