-- ==============================================================================
-- P4I OFFICE v1.0 — ROLLBACK 0001_sprint1a_core.rollback.sql
-- ==============================================================================

BEGIN;

DROP TRIGGER IF EXISTS trg_audit_no_update_delete ON audit_events;
DROP FUNCTION IF EXISTS reject_audit_mutation();

DROP TABLE IF EXISTS audit_events CASCADE;
DROP TABLE IF EXISTS letter_revisions CASCADE;
DROP TABLE IF EXISTS letters CASCADE;
DROP TABLE IF EXISTS letter_templates CASCADE;
DROP TABLE IF EXISTS letter_types CASCADE;
DROP TABLE IF EXISTS numbering_policies CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS org_units CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

COMMIT;
