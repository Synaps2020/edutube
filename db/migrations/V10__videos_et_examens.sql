ALTER TABLE lessons ADD COLUMN requires_quiz boolean NOT NULL DEFAULT false;
ALTER TABLE quizzes ADD COLUMN passing_score integer NOT NULL DEFAULT 70 CHECK (passing_score BETWEEN 1 AND 100);
CREATE TABLE lesson_videos (
 id uuid PRIMARY KEY,
 course_id varchar(100) NOT NULL,
 lesson_id varchar(100) NOT NULL,
 uploaded_by uuid NOT NULL REFERENCES accounts(id),
 storage_driver varchar(40) NOT NULL,
 source_key text NOT NULL,
 file_name varchar(200) NOT NULL,
 size_bytes bigint NOT NULL CHECK(size_bytes>0),
 status varchar(20) NOT NULL CHECK(status IN ('QUEUED','PROCESSING','READY','FAILED','REMOVED')),
 duration_seconds numeric,
 error_message text,
 lease_until timestamptz,
 processing_token uuid,
 attempts integer NOT NULL DEFAULT 0,
 request_key varchar(200) NOT NULL,
 request_hash varchar(64) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(course_id,lesson_id) REFERENCES lessons(course_id,id),
 UNIQUE(uploaded_by,request_key)
);
CREATE UNIQUE INDEX lesson_video_active_idx ON lesson_videos(lesson_id) WHERE status <> 'REMOVED';
CREATE INDEX lesson_video_jobs_idx ON lesson_videos(status,lease_until) WHERE status IN ('QUEUED','PROCESSING');
CREATE TABLE video_assets (
 video_id uuid NOT NULL REFERENCES lesson_videos(id) ON DELETE CASCADE,
 name varchar(100) NOT NULL,
 storage_key text NOT NULL,
 media_type varchar(60) NOT NULL,
 size_bytes integer NOT NULL CHECK(size_bytes>0),
 PRIMARY KEY(video_id,name)
);
