-- ==============================================================================
-- P4I OFFICE v1.0 — ROLLBACK 0002_sprint1b_persistence.rollback.sql
-- ==============================================================================

BEGIN;

DROP INDEX IF EXISTS idx_letter_revisions_created_by;
DROP INDEX IF EXISTS idx_letters_classification;
DROP INDEX IF EXISTS idx_letters_author_status;

ALTER TABLE letter_types DROP COLUMN IF EXISTS priority;

DROP TABLE IF EXISTS schema_migrations CASCADE;

COMMIT;
