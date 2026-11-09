-- Reference SQL hardening script (SDD Appendix B)
-- Apply via: npx prisma migrate dev --create-only --name hardening

-- 1. Data integrity CHECK constraints
ALTER TABLE users
  ADD CONSTRAINT users_username_lowercase CHECK (username = lower(username));

ALTER TABLE sections
  ADD CONSTRAINT sections_year_level_range CHECK (year_level BETWEEN 1 AND 6),
  ADD CONSTRAINT sections_capacity_positive CHECK (capacity IS NULL OR capacity > 0);

ALTER TABLE students
  ADD CONSTRAINT students_year_level_range CHECK (year_level BETWEEN 1 AND 6),
  ADD CONSTRAINT students_birth_date_past CHECK (birth_date < CURRENT_DATE),
  ADD CONSTRAINT students_number_format CHECK (student_number ~ '^[A-Za-z0-9-]{6,20}$');

ALTER TABLE enrollments
  ADD CONSTRAINT enrollments_year_level_range CHECK (year_level BETWEEN 1 AND 6);

ALTER TABLE academic_records
  ADD CONSTRAINT academic_units_nonnegative CHECK (units >= 0);

-- 2. Immutable (append-only) audit log
CREATE OR REPLACE FUNCTION audit_logs_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only (% not allowed)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_no_update_delete
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_block_mutation();

CREATE TRIGGER trg_audit_logs_no_truncate
  BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_block_mutation();
