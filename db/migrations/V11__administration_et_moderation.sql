ALTER TABLE accounts DROP CONSTRAINT accounts_role_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_role_check CHECK(role IN ('LEARNER','TEACHER','ADMIN','REGULATOR','SUPER_ADMIN'));
ALTER TABLE accounts ADD COLUMN suspended_at timestamptz;
ALTER TABLE accounts ADD COLUMN admin_revision integer NOT NULL DEFAULT 1;
ALTER TABLE courses ADD COLUMN moderation varchar(20) NOT NULL DEFAULT 'CLEAR' CHECK(moderation IN ('CLEAR','WITHDRAWN','DELETED'));
CREATE TABLE administration_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_id uuid, actor_name text NOT NULL, action varchar(40) NOT NULL,
 target text NOT NULL, reason text NOT NULL, before_state jsonb, after_state jsonb,
 request_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX administration_audit_date ON administration_audit(created_at DESC,id DESC);
CREATE FUNCTION preserve_administration_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Le journal d’administration ne peut pas être modifié.'; END $$;
CREATE TRIGGER immutable_administration_audit BEFORE UPDATE OR DELETE OR TRUNCATE ON administration_audit
FOR EACH STATEMENT EXECUTE FUNCTION preserve_administration_audit();
CREATE FUNCTION prevent_moderation_bypass() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.moderation <> 'CLEAR' AND NEW.status <> 'ARCHIVED' THEN
  RAISE EXCEPTION 'Un contenu modéré doit rester archivé.';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER course_moderation_guard BEFORE INSERT OR UPDATE ON courses
FOR EACH ROW EXECUTE FUNCTION prevent_moderation_bypass();
