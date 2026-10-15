CREATE TABLE resources (
    id uuid PRIMARY KEY,
    course_id varchar(100) NOT NULL,
    lesson_id varchar(100) NOT NULL,
    title varchar(200) NOT NULL,
    file_name varchar(200) NOT NULL,
    media_type varchar(40) NOT NULL CHECK (media_type IN ('application/pdf','text/plain')),
    size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
    storage_key uuid NOT NULL UNIQUE,
    uploaded_by uuid NOT NULL REFERENCES accounts(id),
    request_key varchar(200) NOT NULL,
    request_hash char(64) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    removed_at timestamptz,
    FOREIGN KEY(course_id,lesson_id) REFERENCES lessons(course_id,id),
    UNIQUE(uploaded_by,request_key)
);
CREATE INDEX resources_lesson_idx ON resources(course_id,lesson_id,created_at) WHERE removed_at IS NULL;
